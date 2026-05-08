const fs = require("fs/promises");
const path = require("path");
const { memoize } = require("../cache/memoize");
const { QueueManager } = require("../server/queue");
const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { sleep, now } = require("../utils/delay");

function buildWorkload(size = 24) {
  const domains = ["api", "billing", "auth", "reports", "search", "jobs"];
  return Array.from({ length: size }, (_, index) => {
    const domain = domains[index % domains.length];
    const priority = index % 3 === 0 ? 1 : 0;
    const baseMs = 110 + ((index * 17) % 90);
    const deadlineMs = 220 + ((index * 31) % 160);

    return {
      sequence: `RQ-${String(index + 1).padStart(2, "0")}`,
      clientId: domain,
      category: domain,
      priority,
      arrivedAt: now(),
      processingTimeMs: baseMs,
      deadlineMs,
      domain,
      baseMs
    };
  });
}

function createEstimator() {
  let underlyingCalls = 0;
  const estimator = memoize((domain) => {
    underlyingCalls += 1;
    let cost = 0;
    for (let index = 0; index < 25_000; index += 1) {
      cost += (index % 5) * domain.length;
    }
    return 90 + (cost % 25) + (domain.length % 4);
  }, { maxSize: 12, evictionPolicy: "lru", ttlMs: 2_000 });

  return {
    estimate: estimator,
    getUnderlyingCalls: () => underlyingCalls
  };
}

async function simulateStrategy(strategy, workload) {
  const estimator = createEstimator();
  const manager = new QueueManager({
    concurrency: 3,
    totalRequests: workload.length,
    strategy,
    processRequest: async (request) => {
      estimator.estimate(request.domain);
      await sleep(request.processingTimeMs);
      return request.processingTimeMs;
    }
  });

  for (const request of workload) {
    manager.enqueue({ ...request, arrivedAt: now() });
    await sleep(18 + Math.floor(Math.random() * 22));
  }

  await manager.waitForDone();

  const summary = manager.summary();
  const lostRequests = manager.metrics.filter((item) => {
    if (item.deadlineMs == null) {
      return false;
    }

    return item.waitingTimeMs + item.processingTimeMs > item.deadlineMs;
  });

  const averageResponseMs = manager.metrics.reduce((sum, item) => sum + item.waitingTimeMs + item.processingTimeMs, 0) / manager.metrics.length;
  return {
    strategy,
    summary: {
      processed: summary.processed,
      avgWaitingMs: Number(summary.avgWaitingMs.toFixed(2)),
      avgProcessingMs: Number(summary.avgProcessingMs.toFixed(2)),
      peakQueueSize: summary.peakQueueSize,
      timeoutLosses: lostRequests.length,
      avgResponseMs: Number(averageResponseMs.toFixed(2)),
      cacheHitRate: Number((1 - estimator.getUnderlyingCalls() / workload.length).toFixed(3))
    }
  };
}

async function compareQueueStrategies(options = {}) {
  const workloadSize = Number(options.workloadSize || 24);
  const workload = buildWorkload(workloadSize);
  const priorityRun = await simulateStrategy("priority", workload);
  const fifoRun = await simulateStrategy("fifo", workload);

  const report = {
    generatedAt: new Date().toISOString(),
    workloadSize,
    priorityRun,
    fifoRun,
    delta: {
      responseMs: Number((fifoRun.summary.avgResponseMs - priorityRun.summary.avgResponseMs).toFixed(2)),
      timeoutLosses: fifoRun.summary.timeoutLosses - priorityRun.summary.timeoutLosses,
      cacheHitRate: Number((priorityRun.summary.cacheHitRate - fifoRun.summary.cacheHitRate).toFixed(3))
    }
  };

  if (options.reportPath) {
    await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
    await fs.writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}

async function runQueueComparisonDemo(options = {}) {
  renderBanner("Queue strategy comparison", "priority queue vs FIFO under the same workload");
  renderSection("Why this matters", chalk.cyan);
  renderList([
    "Compares the existing biDirectionalPriorityQueue against FIFO.",
    "Measures average response time, timeout losses and cache hit rate.",
    "Writes a JSON report so the results can be cited in a course report."
  ], chalk.whiteBright);

  const reportDir = path.resolve(process.cwd(), options.outputDir || "outputs");
  const reportPath = path.resolve(process.cwd(), options.reportPath || path.join(reportDir, `queue-comparison-${Date.now()}.json`));
  const report = await compareQueueStrategies({ reportPath, workloadSize: options.workloadSize || 24 });

  renderCard(
    "Report location",
    [
      ["File", reportPath],
      ["Workload size", String(report.workloadSize)],
      ["Best strategy", report.priorityRun.summary.avgResponseMs <= report.fifoRun.summary.avgResponseMs ? "priority" : "fifo"]
    ],
    chalk.blue
  );

  renderSection("Comparison", chalk.green);
  renderTable(
    ["Strategy", "Avg response", "Timeout losses", "Cache hit rate", "Peak queue"],
    [
      ["priority", `${report.priorityRun.summary.avgResponseMs.toFixed(2)} ms`, String(report.priorityRun.summary.timeoutLosses), `${(report.priorityRun.summary.cacheHitRate * 100).toFixed(1)}%`, String(report.priorityRun.summary.peakQueueSize)],
      ["fifo", `${report.fifoRun.summary.avgResponseMs.toFixed(2)} ms`, String(report.fifoRun.summary.timeoutLosses), `${(report.fifoRun.summary.cacheHitRate * 100).toFixed(1)}%`, String(report.fifoRun.summary.peakQueueSize)]
    ]
  );

  renderSection("Delta", chalk.magenta);
  renderKeyValueRows([
    ["Response time difference", `${report.delta.responseMs} ms`, chalk.whiteBright],
    ["Timeout losses difference", String(report.delta.timeoutLosses), chalk.whiteBright],
    ["Cache hit rate difference", `${(report.delta.cacheHitRate * 100).toFixed(1)} pp`, chalk.whiteBright]
  ]);

  return report;
}

module.exports = {
  buildWorkload,
  compareQueueStrategies,
  runQueueComparisonDemo
};

if (require.main === module) {
  runQueueComparisonDemo().catch((error) => {
    console.error("Queue comparison demo failed:", error);
    process.exitCode = 1;
  });
}
