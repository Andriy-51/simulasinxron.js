const fs = require("fs/promises");
const path = require("path");
const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { produceByClients, produceDemo } = require("../simulation/requestGenerator");
const { consumeIteratorWithTimeout } = require("../consumers/consumeIteratorWithTimeout");
const { createFaultInjector } = require("../chaos/faultInjection");
const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { sleep, now } = require("../utils/delay");

/**
 * Collects workload items using the existing request generator.
 * @param {object} options - Workload options.
 * @returns {Promise<Array<object>>} Collected requests.
 */
async function collectStressWorkload(options = {}) {
  const channel = createReactiveChannel();
  const requests = [];

  channel.on("request", (request) => {
    requests.push({ ...request });
  });

  if (options.mode === "clients") {
    await produceByClients(
      channel,
      options.clients ?? 6,
      options.requestsPerClient ?? 10,
      options.vipRate ?? 0.35
    );
    return requests;
  }

  await produceDemo(
    channel,
    options.totalRequests ?? 80,
    options.clients ?? 8,
    options.vipRate ?? 0.35
  );
  return requests;
}

/**
 * Run the stress test mode that combines request generation, injected faults,
 * and timeout-based iterator consumption.
 * @param {object} options - Runtime options for the stress test.
 * @returns {Promise<object>} Structured stress test report.
 */
async function runStressTestMode(options = {}) {
  const reportDir = path.resolve(process.cwd(), options.outputDir || "outputs");
  const reportPath = path.join(reportDir, options.reportName || "stress-test-report.json");
  const startedAt = now();
  const workload = await collectStressWorkload(options);
  let pending = 0;
  let maxPending = 0;
  let processed = 0;
  let failed = 0;
  const inFlight = [];

  const injectedProcessor = createFaultInjector(
    async (request) => {
      const delayMs = Math.max(1, Number(options.delayMs || 10));
      await sleep(delayMs + Math.floor(Math.random() * Math.max(5, delayMs)));
      return request.sequence;
    },
    {
      label: "stressProcessor",
      failureRate: Math.min(1, Math.max(0, Number(options.failureRate ?? 0.18))),
      delayRate: Math.min(1, Math.max(0, Number(options.delayRate ?? 0.35))),
      maxDelayMs: Math.max(0, Number(options.maxDelayMs ?? 60))
    }
  );

  const iteratorStats = consumeIteratorWithTimeout(
    workload[Symbol.iterator](),
    Number(options.timeoutSeconds ?? 0.2),
    (request) => {
      pending += 1;
      maxPending = Math.max(maxPending, pending);

      const job = injectedProcessor(request)
        .then(() => {
          processed += 1;
        })
        .catch(() => {
          failed += 1;
        })
        .finally(() => {
          pending = Math.max(0, pending - 1);
        });

      inFlight.push(job);
    },
    Number(options.pauseMs ?? 0)
  );

  await Promise.allSettled(inFlight);

  const report = {
    generatedAt: new Date().toISOString(),
    workload: {
      mode: options.mode === "clients" ? "clients" : "demo",
      totalRequests: workload.length,
      clients: options.clients ?? 8,
      requestsPerClient: options.requestsPerClient ?? 10,
      vipRate: Number(options.vipRate ?? 0.35)
    },
    stress: {
      iterationCount: iteratorStats.iterationCount,
      timeoutReached: iteratorStats.timeoutReached,
      elapsedSeconds: Number(iteratorStats.elapsedSeconds.toFixed(3)),
      processed,
      failed,
      maxPending
    },
    performance: {
      throughput: iteratorStats.elapsedSeconds > 0 ? Number((processed / iteratorStats.elapsedSeconds).toFixed(2)) : 0,
      failureRate: processed + failed === 0 ? 0 : Number((failed / (processed + failed)).toFixed(3))
    }
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  renderBanner("Stress test mode", "peak load + fault injection + timeout monitoring");
  renderSection("Scenario", chalk.cyan);
  renderList(
    [
      "Generates a burst workload using requestGenerator.js.",
      "Injects random failures and delays into request handling.",
      "Measures the point where consumeIteratorWithTimeout can no longer keep up."
    ],
    chalk.whiteBright
  );

  renderSection("Stress report", chalk.green);
  renderTable(
    ["Metric", "Value"],
    [
      ["Workload", String(report.workload.totalRequests)],
      ["Iterations", String(report.stress.iterationCount)],
      ["Timeout reached", report.stress.timeoutReached ? "yes" : "no"],
      ["Processed", String(report.stress.processed)],
      ["Failures", String(report.stress.failed)],
      ["Max pending", String(report.stress.maxPending)]
    ]
  );

  renderCard(
    "Stress output",
    [
      ["Report file", reportPath],
      ["Throughput", `${report.performance.throughput} req/s`],
      ["Failure rate", `${(report.performance.failureRate * 100).toFixed(1)}%`]
    ],
    chalk.blue
  );

  renderKeyValueRows([
    ["Elapsed", `${report.stress.elapsedSeconds} s`, chalk.whiteBright],
    ["Pending at end", String(pending), chalk.whiteBright]
  ]);

  return report;
}

module.exports = {
  collectStressWorkload,
  runStressTestMode
};

if (require.main === module) {
  runStressTestMode().catch((error) => {
    console.error("Stress test mode failed:", error);
    process.exitCode = 1;
  });
}
