const fs = require("fs/promises");
const path = require("path");
const { memoize } = require("../cache/memoize");
const { QueueManager } = require("../server/queue");
const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { loadConfig } = require("../system/config");
const { SystemMonitor } = require("../system/monitor");
const { createRoundRobinState, saveSnapshot, loadSnapshot } = require("../system/snapshot");
const { chalk, colorForPriority, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { sleep, now } = require("../utils/delay");

function createWorkloadTemplates() {
  return [
    { id: "WL-01", title: "cache warmup", priority: 1, baseMs: 120, domain: "api" },
    { id: "WL-02", title: "batch import", priority: 0, baseMs: 210, domain: "jobs" },
    { id: "WL-03", title: "priority sync", priority: 1, baseMs: 180, domain: "realtime" },
    { id: "WL-04", title: "report rebuild", priority: 0, baseMs: 260, domain: "analytics" },
    { id: "WL-05", title: "token refresh", priority: 1, baseMs: 140, domain: "auth" },
    { id: "WL-06", title: "cleanup pass", priority: 0, baseMs: 190, domain: "maintenance" }
  ];
}

function createCachedEstimator() {
  return memoize(
    (domain, baseMs) => {
      let score = 0;
      for (let index = 0; index < 45_000; index += 1) {
        score += (index % 7) * (baseMs % 5);
      }
      return { domain, estimateMs: baseMs + (score % 30) };
    },
    { maxSize: 16, evictionPolicy: "lru", ttlMs: 5_000 }
  );
}

async function runPlatformDemo() {
  const config = await loadConfig();
  const monitor = new SystemMonitor("Simulation platform dashboard");
  const channel = createReactiveChannel();
  const templates = createWorkloadTemplates();
  const estimator = createCachedEstimator();
  const cursor = createRoundRobinState(templates);
  const seenCacheKeys = new Set();
  const snapshotDir = path.resolve(process.cwd(), config.runtime.snapshotPath || "snapshots");
  const reportDir = path.resolve(process.cwd(), config.runtime.reportPath || "reports");
  const snapshotPath = path.join(snapshotDir, "platform-snapshot.json");
  const reportPath = path.join(reportDir, `platform-report-${Date.now()}.json`);
  const queueSnapshots = [];
  const queue = new QueueManager({
    concurrency: config.runtime.queueConcurrency,
    totalRequests: config.demo.totalRequests,
    processRequest: async (request) => {
      const [domain, baseMs] = [request.domain, request.baseMs];
      const cachedEstimate = estimator(domain, baseMs);
      monitor.trackCache(seenCacheKeys.has(`${domain}:${baseMs}`));
      seenCacheKeys.add(`${domain}:${baseMs}`);
      const processingTimeMs = Math.max(90, cachedEstimate.estimateMs + (request.priority > 0 ? -15 : 20));
      await sleep(processingTimeMs);
      return processingTimeMs;
    }
  });

  renderBanner("Simulation platform", "config + monitor + snapshot/resume");
  renderSection("Loaded configuration", chalk.cyan);
  renderCard(
    "Runtime",
    [
      ["Concurrency", String(config.runtime.queueConcurrency)],
      ["Queue limit", String(config.runtime.queueRateLimit)],
      ["Snapshot path", config.runtime.snapshotPath],
      ["Report path", config.runtime.reportPath]
    ],
    chalk.blue
  );

  renderList([
    "The platform loads runtime options from config.json or environment variables.",
    "It collects live metrics for queue length, cache usage and processing latency.",
    "It saves a snapshot, reloads it and continues the same workload cursor."
  ], chalk.whiteBright);

  channel.on("request", (request) => {
    queue.enqueue(request);
    monitor.trackQueueLength(queue.queue.length + queue.active);
    monitor.trackEvent("request", `${request.id} -> ${request.title}`);
  });

  const emitWorkload = async (count, label) => {
    for (let index = 0; index < count; index += 1) {
      const template = cursor.next();
      const estimate = estimator(template.domain, template.baseMs);
      const request = {
        sequence: index + 1,
        id: `${label}-${index + 1}`,
        clientId: template.domain,
        title: template.title,
        category: template.domain,
        priority: template.priority,
        arrivedAt: now(),
        baseMs: estimate.estimateMs,
        domain: template.domain
      };

      channel.emit("request", request);
      await sleep(45 + Math.floor(Math.random() * 40));
    }
  };

  const firstWave = Math.max(4, Math.floor(config.demo.totalRequests / 2));
  await emitWorkload(firstWave, "WL");

  const snapshot = {
    cursor: cursor.snapshot(),
    queue: queue.snapshot(),
    createdAt: new Date().toISOString(),
    config: {
      concurrency: config.runtime.queueConcurrency,
      totalRequests: config.demo.totalRequests
    }
  };

  await fs.mkdir(snapshotDir, { recursive: true });
  await saveSnapshot(snapshotPath, snapshot);
  queueSnapshots.push(snapshotPath);
  monitor.trackSnapshot();

  const loadedSnapshot = await loadSnapshot(snapshotPath);
  cursor.restore(loadedSnapshot.cursor);
  queue.restore(loadedSnapshot.queue);
  monitor.trackRestore();
  monitor.trackEvent("snapshot", `saved and restored from ${snapshotPath}`);

  const remaining = Math.max(0, config.demo.totalRequests - firstWave);
  await emitWorkload(remaining, "RESUME");
  await queue.waitForDone();

  const summary = queue.summary();
  const dashboard = monitor.getSummary();
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ summary, dashboard, snapshotPath, generatedAt: new Date().toISOString() }, null, 2), "utf8");

  renderSection("Platform results", chalk.green);
  renderTable(
    ["Metric", "Value"],
    [
      ["Processed", String(summary.processed)],
      ["Avg wait", `${summary.avgWaitingMs.toFixed(2)} ms`],
      ["Avg processing", `${summary.avgProcessingMs.toFixed(2)} ms`],
      ["Peak queue", String(summary.peakQueueSize)],
      ["Cache hit rate", `${(dashboard.cacheHitRate * 100).toFixed(1)}%`],
      ["Snapshots", String(dashboard.snapshots)],
      ["Restored", String(dashboard.restored)]
    ]
  );

  renderCard(
    "Artifacts",
    [
      ["Snapshot", snapshotPath],
      ["Report", reportPath],
      ["Queue snapshots", String(queueSnapshots.length)]
    ],
    chalk.magenta
  );

  monitor.render();

  return {
    summary,
    dashboard,
    snapshotPath,
    reportPath
  };
}

module.exports = {
  runPlatformDemo
};

if (require.main === module) {
  runPlatformDemo().catch((error) => {
    console.error("Simulation platform demo failed:", error);
    process.exitCode = 1;
  });
}
