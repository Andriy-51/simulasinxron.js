const fs = require("fs/promises");
const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { QueueManager } = require("./queue");
const { produceByClients, produceDemo } = require("../simulation/requestGenerator");
const { sleep } = require("../utils/delay");

let chalk;

function createPassthrough() {
  const passthrough = (...values) => values.map((value) => String(value)).join(" ");
  return new Proxy(passthrough, {
    get: () => createPassthrough(),
    apply: (_, __, args) => args.map((value) => String(value)).join(" ")
  });
}

try {
  chalk = require("chalk");
  if (chalk && chalk.default) {
    chalk = chalk.default;
  }
} catch {
  chalk = createPassthrough();
}

if (!chalk || typeof chalk.bold !== "function" || typeof chalk.bold.blue !== "function") {
  chalk = createPassthrough();
}

async function defaultProcessRequest(req) {
  const processingTimeMs = 80 + Math.floor(Math.random() * 220);
  await sleep(processingTimeMs);
  return processingTimeMs;
}

function formatLine(label, value, width) {
  return `${label.padEnd(width)} : ${value}`;
}

async function maybeWriteReport(reportPath, report) {
  if (!reportPath) {
    return;
  }

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(chalk.green(`\nMetrics exported to ${reportPath}`));
}

async function runServerSimulation({ clients = 5, requestsPerClient = 6, concurrency = 3, vipRate = 0.25, demo = false, totalRequests = null, processRequest = defaultProcessRequest, reportPath = null, label = "Clients -> Queue -> Server simulation" } = {}) {
  const title = label || "Clients -> Queue -> Server simulation";
  console.log(`\n${chalk.bold.blue("=").repeat(title.length + 8)}`);
  console.log(chalk.bold.blue(`=== ${title} ===`));
  console.log(chalk.bold.blue("=").repeat(title.length + 8));
  console.log(chalk.dim(`Mode: ${demo ? "demo" : "client batches"}`));
  console.log(chalk.dim(`Clients: ${clients}, requests/client: ${requestsPerClient}, concurrency limit: ${concurrency}, VIP rate: ${(vipRate * 100).toFixed(0)}%`));

  const channel = createReactiveChannel();
  const computedTotal = totalRequests || (clients * requestsPerClient);
  const manager = new QueueManager({ concurrency, totalRequests: computedTotal, processRequest });

  channel.on("request", (request) => {
    manager.enqueue(request);
  });

  if (demo) {
    await produceDemo(channel, computedTotal, clients, vipRate);
  } else {
    await produceByClients(channel, clients, requestsPerClient, vipRate);
  }

  await manager.waitForDone();

  const stats = manager.summary();
  const report = {
    label: title,
    mode: demo ? "demo" : "client batches",
    clients,
    requestsPerClient,
    concurrency,
    vipRate,
    totalRequests: computedTotal,
    stats: {
      avgWaitingMs: Number(stats.avgWaitingMs.toFixed(2)),
      avgProcessingMs: Number(stats.avgProcessingMs.toFixed(2)),
      processed: stats.processed,
      vipProcessed: stats.vipProcessed,
      peakQueueSize: stats.peakQueueSize,
      vipShare: stats.processed === 0 ? 0 : Number((stats.vipProcessed / stats.processed).toFixed(3))
    },
    generatedAt: new Date().toISOString()
  };

  const lines = [
    ["Average waiting time", `${stats.avgWaitingMs.toFixed(2)} ms`],
    ["Average processing time", `${stats.avgProcessingMs.toFixed(2)} ms`],
    ["Processed requests", String(stats.processed)],
    ["Processed VIP requests", String(stats.vipProcessed)],
    ["Peak queue size", String(stats.peakQueueSize)],
    ["VIP share", `${report.stats.vipShare.toFixed(3)}`]
  ];
  const width = lines.reduce((m, [k]) => Math.max(m, k.length), 0);

  console.log(chalk.bold.green("\n=== Simulation metrics ==="));
  for (const [key, value] of lines) {
    const prettyValue = key.includes("Processed") ? chalk.cyan(value) : chalk.whiteBright(value);
    console.log(formatLine(chalk.gray(key), prettyValue, width));
  }

  await maybeWriteReport(reportPath, report);
  return report;
}

module.exports = { runServerSimulation };
