const fs = require("fs/promises");
const path = require("path");
const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { sleep, now } = require("../utils/delay");

function createFaultInjector(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new Error("createFaultInjector expects a function");
  }

  const failureRate = Math.min(1, Math.max(0, Number(options.failureRate ?? 0.2)));
  const delayRate = Math.min(1, Math.max(0, Number(options.delayRate ?? 0.3)));
  const maxDelayMs = Math.max(0, Number(options.maxDelayMs ?? 120));
  const label = options.label || fn.name || "operation";

  return async function injectedOperation(...args) {
    const roll = Math.random();

    if (roll < failureRate) {
      throw new Error(`${label} injected failure`);
    }

    if (roll < failureRate + delayRate) {
      const delayMs = 40 + Math.floor(Math.random() * maxDelayMs);
      await sleep(delayMs);
    }

    return fn.apply(this, args);
  };
}

async function runWithRetry(operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await operation();
      return { ok: true, attempts: attempt, value };
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, attempts, error: lastError };
}

async function runChaosEngineeringDemo() {
  renderBanner("Chaos engineering demo", "fault injection and retry recovery");
  renderSection("Scenario", chalk.cyan);
  renderList([
    "An unstable async operation randomly fails or slows down.",
    "The same workload is tested without and with retries.",
    "The demo shows whether the system recovers under injected faults."
  ], chalk.whiteBright);

  const baseOperation = async (ticket) => {
    await sleep(70 + Math.floor(Math.random() * 80));
    return { ticketId: ticket.id, status: "processed", priority: ticket.priority };
  };

  const unstableOperation = createFaultInjector(baseOperation, {
    label: "ticketHandler",
    failureRate: 0.3,
    delayRate: 0.45,
    maxDelayMs: 150
  });

  const tickets = Array.from({ length: 8 }, (_, index) => ({
    id: `CH-${String(index + 1).padStart(2, "0")}`,
    priority: index % 3 === 0 ? 1 : 0
  }));

  const baselineResults = [];
  const retryResults = [];

  for (const ticket of tickets) {
    const startedAt = now();
    try {
      await unstableOperation(ticket);
      baselineResults.push({ ticket: ticket.id, status: "ok", durationMs: now() - startedAt });
    } catch (error) {
      baselineResults.push({ ticket: ticket.id, status: "fail", durationMs: now() - startedAt, error: error.message });
    }
  }

  const retryingOperation = async (ticket) => {
    const startedAt = now();
    const result = await runWithRetry(() => unstableOperation(ticket), 3);
    retryResults.push({
      ticket: ticket.id,
      status: result.ok ? "ok" : "fail",
      attempts: result.attempts,
      durationMs: now() - startedAt,
      error: result.error ? result.error.message : null
    });
    return result;
  };

  for (const ticket of tickets) {
    await retryingOperation(ticket);
  }

  const baselineSuccess = baselineResults.filter((item) => item.status === "ok").length;
  const retrySuccess = retryResults.filter((item) => item.status === "ok").length;
  const baselineAvg = baselineResults.reduce((sum, item) => sum + item.durationMs, 0) / baselineResults.length;
  const retryAvg = retryResults.reduce((sum, item) => sum + item.durationMs, 0) / retryResults.length;
  const report = {
    generatedAt: new Date().toISOString(),
    baseline: {
      success: baselineSuccess,
      failure: baselineResults.length - baselineSuccess,
      avgDurationMs: Number(baselineAvg.toFixed(2))
    },
    retrying: {
      success: retrySuccess,
      failure: retryResults.length - retrySuccess,
      avgDurationMs: Number(retryAvg.toFixed(2)),
      avgAttempts: Number((retryResults.reduce((sum, item) => sum + item.attempts, 0) / retryResults.length).toFixed(2))
    }
  };

  const reportPath = path.resolve(process.cwd(), "reports", `chaos-demo-${Date.now()}.json`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  renderSection("Recovery impact", chalk.green);
  renderTable(
    ["Mode", "Success", "Failure", "Avg duration"],
    [
      ["baseline", String(report.baseline.success), String(report.baseline.failure), `${report.baseline.avgDurationMs} ms`],
      ["retrying", String(report.retrying.success), String(report.retrying.failure), `${report.retrying.avgDurationMs} ms`]
    ]
  );

  renderCard(
    "Chaos report",
    [
      ["Report file", reportPath],
      ["Avg attempts with retry", String(report.retrying.avgAttempts)],
      ["Recovered tickets", String(retrySuccess - baselineSuccess)]
    ],
    chalk.blue
  );

  renderSection("Sample attempts", chalk.magenta);
  renderKeyValueRows(
    retryResults.slice(0, 4).map((item) => [
      item.ticket,
      `${item.status} in ${item.attempts} attempt(s)`,
      item.status === "ok" ? chalk.whiteBright : chalk.redBright
    ])
  );

  return report;
}

module.exports = {
  createFaultInjector,
  runWithRetry,
  runChaosEngineeringDemo
};

if (require.main === module) {
  runChaosEngineeringDemo().catch((error) => {
    console.error("Chaos engineering demo failed:", error);
    process.exitCode = 1;
  });
}
