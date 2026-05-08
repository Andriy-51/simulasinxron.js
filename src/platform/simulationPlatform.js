const fs = require("fs/promises");
const path = require("path");
const { memoize } = require("../cache/memoize");
const { consumeIteratorWithTimeout } = require("../consumers/consumeIteratorWithTimeout");
const { QueueManager } = require("../server/queue");
const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { loadConfig } = require("../system/config");
const { DashboardMetrics } = require("../system/dashboardMetrics");
const { createRoundRobinState, saveSnapshot, loadSnapshot } = require("../system/snapshot");
const { chalk, colorForPriority, renderBanner, renderCard, renderDashboardSnapshot, renderList, renderSection, renderTable } = require("../ui/terminalUi");
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

function createRawEstimator(domain, baseMs) {
  let score = 0;

  for (let index = 0; index < 45_000; index += 1) {
    score += (index % 7) * (baseMs % 5);
  }

  return { domain, estimateMs: baseMs + (score % 30) };
}

function createCachedEstimator() {
  return memoize(createRawEstimator, { maxSize: 16, evictionPolicy: "lru", ttlMs: 5_000 });
}

function benchmarkEstimator(runFn, workload) {
  const startedAt = now();

  for (const template of workload) {
    runFn(template.domain, template.baseMs);
  }

  return now() - startedAt;
}

function runIteratorThroughputProbe(dashboard, values) {
  dashboard.trackIteratorStart();

  const stats = consumeIteratorWithTimeout(values[Symbol.iterator](), 0.2, () => {}, 18, {
    onTimeout: () => dashboard.trackIteratorTimeout(),
    onComplete: ({ timeoutReached }) => {
      if (!timeoutReached) {
        dashboard.trackIteratorComplete();
      }
    }
  });

  return stats;
}

function snapshotDashboard(dashboard, label, subtitle) {
  renderDashboardSnapshot({
    ...dashboard.getSummary(),
    label,
    subtitle
  });
}

async function runPlatformDemo(options = {}) {
  const config = await loadConfig();
  const runtimeConfig = {
    ...config.runtime,
    ...(options.runtime || {})
  };
  const demoConfig = {
    ...config.demo,
    ...(options.demo || {})
  };
  const dashboard = new DashboardMetrics("Simulation platform dashboard");
  const channel = createReactiveChannel();
  const templates = createWorkloadTemplates();
  const estimator = createCachedEstimator();
  const cursor = createRoundRobinState(templates);
  const outputDir = path.resolve(process.cwd(), options.outputDir || runtimeConfig.outputPath || runtimeConfig.reportPath || "outputs");
  const snapshotDir = path.resolve(process.cwd(), options.snapshotDir || runtimeConfig.snapshotPath || path.join(outputDir, "snapshots"));
  const reportDir = path.resolve(process.cwd(), options.reportDir || outputDir);
  const snapshotPath = path.resolve(process.cwd(), options.snapshotPath || path.join(snapshotDir, "platform-snapshot.json"));
  const reportPath = path.resolve(process.cwd(), options.reportPath || path.join(reportDir, "platform-report.json"));
  const liveRefreshMs = Math.max(100, Number(options.monitorRefreshMs ?? runtimeConfig.monitorRefreshMs ?? 500));
  let previousCacheStats = estimator.getStats();

  const queue = new QueueManager({
    concurrency: Number(options.queueConcurrency ?? runtimeConfig.queueConcurrency),
    totalRequests: Number(demoConfig.totalRequests),
    processRequest: async (request) => {
      const [domain, baseMs] = [request.domain, request.baseMs];
      const cachedEstimate = estimator(domain, baseMs);
      const cacheStats = estimator.getStats();
      if (cacheStats.hits > previousCacheStats.hits) {
        dashboard.trackCacheHit();
      } else {
        dashboard.trackCacheMiss();
      }
      previousCacheStats = cacheStats;

      const processingTimeMs = Math.max(90, cachedEstimate.estimateMs + (request.priority > 0 ? -15 : 20));
      dashboard.trackProcessingTime(processingTimeMs);
      await sleep(processingTimeMs);
      dashboard.trackQueueProcessed();
      dashboard.trackQueueSize(queue.queue.length + queue.active);
      dashboard.trackQueuePending(queue.queue.length);
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
    "It compares memoized and non-memoized computation time.",
    "It measures iterator throughput until timeout is reached.",
    "It saves a snapshot, reloads it and continues the same workload cursor."
  ], chalk.whiteBright);

  channel.on("request", (request) => {
    queue.enqueue(request);
    dashboard.trackQueueSize(queue.queue.length + queue.active);
    dashboard.trackQueuePending(queue.queue.length);
  });

  const dashboardTimer = setInterval(() => {
    snapshotDashboard(dashboard, "Live platform dashboard", "queue, cache and iterator metrics");
  }, liveRefreshMs);

  if (typeof dashboardTimer.unref === "function") {
    dashboardTimer.unref();
  }

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

  try {
    snapshotDashboard(dashboard, "Live platform dashboard", "initial state before workload");

    const firstWave = Math.max(4, Math.floor(demoConfig.totalRequests / 2));
    await emitWorkload(firstWave, "WL");

    const snapshot = {
      cursor: cursor.snapshot(),
      queue: queue.snapshot(),
      createdAt: new Date().toISOString(),
      config: {
        concurrency: config.runtime.queueConcurrency,
        totalRequests: demoConfig.totalRequests
      }
    };

    await fs.mkdir(snapshotDir, { recursive: true });
    await saveSnapshot(snapshotPath, snapshot);
    dashboard.trackSnapshot();

    const loadedSnapshot = await loadSnapshot(snapshotPath);
    cursor.restore(loadedSnapshot.cursor);
    queue.restore(loadedSnapshot.queue);
    dashboard.trackRestore();

    const remaining = Math.max(0, demoConfig.totalRequests - firstWave);
    await emitWorkload(remaining, "RESUME");
    await queue.waitForDone();

    const memoizedWorkload = templates.flatMap((template) => [template, template, template]);
    const rawDurationMs = benchmarkEstimator(createRawEstimator, memoizedWorkload);
    const memoizedForBenchmark = createCachedEstimator();
    const memoizedDurationMs = benchmarkEstimator(memoizedForBenchmark, memoizedWorkload);
    const memoizedStats = memoizedForBenchmark.getStats();

    const iteratorWorkload = Array.from({ length: config.demo.totalRequests * 2 }, (_, index) => templates[index % templates.length].title);
    const iteratorStats = runIteratorThroughputProbe(dashboard, iteratorWorkload);

    const queueSummary = queue.summary();
    const dashboardSummary = dashboard.getSummary();
    const report = {
      generatedAt: new Date().toISOString(),
      snapshotPath,
      queue: queueSummary,
      dashboard: dashboardSummary,
      performance: {
        memoization: {
          workloadSize: memoizedWorkload.length,
          withoutMemoizeMs: rawDurationMs,
          withMemoizeMs: memoizedDurationMs,
          improvementPercent: rawDurationMs === 0 ? 0 : Number((((rawDurationMs - memoizedDurationMs) / rawDurationMs) * 100).toFixed(2)),
          hitRate: Number((memoizedStats.hitRate * 100).toFixed(1))
        },
        iteratorThroughput: {
          maxRequestsBeforeTimeout: iteratorStats.iterationCount,
          elapsedSeconds: Number(iteratorStats.elapsedSeconds.toFixed(3)),
          timeoutReached: iteratorStats.timeoutReached
        }
      }
    };

    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    renderSection("Platform results", chalk.green);
    renderTable(
      ["Metric", "Value"],
      [
        ["Processed", String(queueSummary.processed)],
        ["Avg wait", `${queueSummary.avgWaitingMs.toFixed(2)} ms`],
        ["Avg processing", `${queueSummary.avgProcessingMs.toFixed(2)} ms`],
        ["Peak queue", String(queueSummary.peakQueueSize)],
        ["Cache hit rate", `${dashboardSummary.cache.hitRate.toFixed(1)}%`],
        ["Iterator timeout", iteratorStats.timeoutReached ? "yes" : "no"],
        ["Snapshot saved", path.basename(snapshotPath)]
      ]
    );

    renderCard(
      "Analytics report",
      [
        ["Report", reportPath],
        ["Memoized speedup", `${report.performance.memoization.improvementPercent.toFixed(2)}%`],
        ["Iterator throughput", String(report.performance.iteratorThroughput.maxRequestsBeforeTimeout)]
      ],
      chalk.magenta
    );

    snapshotDashboard(dashboard, "Final platform dashboard", "post-run metrics snapshot");

    return report;
  } finally {
    clearInterval(dashboardTimer);
  }
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
