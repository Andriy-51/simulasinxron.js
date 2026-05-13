const fs = require("fs/promises");
const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { logLine } = require("../logs/logger");
const { now, sleep } = require("../utils/delay");

function normalizeLevel(level) {
  return String(level || "INFO").toUpperCase();
}

function shouldLog(level, minimumLevel) {
  const ranking = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  return (ranking[level] ?? 1) >= (ranking[minimumLevel] ?? 1);
}

function createLogSink(destination = "console", options = {}) {
  const mode = String(destination || "console").toLowerCase();

  if (mode === "file") {
    const filePath = options.filePath || "logs.jsonl";
    return {
      async write(entry) {
        await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
      }
    };
  }

  if (mode === "memory") {
    const entries = [];
    return {
      entries,
      async write(entry) {
        entries.push(entry);
      }
    };
  }

  return {
    async write(entry) {
      const prefix = `[${entry.level}]`;
      if (entry.level === "ERROR") {
        console.error(prefix, entry.message, entry.meta || "");
        return;
      }

      console.log(prefix, entry.message, entry.meta || "");
    }
  };
}

function createLoggingDecorator(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new Error("createLoggingDecorator expects a function");
  }

  const minimumLevel = normalizeLevel(options.level || "INFO");
  const onlyErrors = Boolean(options.onlyErrors);
  const sink = options.sink || createLogSink(options.destination || "console", options);
  const includeArgs = options.includeArgs !== false;
  const includeResult = options.includeResult !== false;
  const includeTiming = options.includeTiming !== false;
  const formatter = typeof options.formatter === "function" ? options.formatter : null;

  const emit = async (entry) => {
    if (onlyErrors && entry.level !== "ERROR") {
      return;
    }

    if (!shouldLog(entry.level, minimumLevel)) {
      return;
    }

    const formatted = formatter ? formatter(entry) : entry;
    await sink.write(formatted);
  };

  return function decoratedFunction(...args) {
    const startedAt = now();
    const contextName = options.name || fn.name || "anonymous";
    const inputPayload = includeArgs ? { args } : undefined;

    const logSuccess = async (result) => {
      const entry = {
        ts: new Date(startedAt).toISOString(),
        level: normalizeLevel(options.successLevel || "INFO"),
        functionName: contextName,
        message: `${contextName} executed successfully`,
        meta: {
          ...(inputPayload || {}),
          ...(includeResult ? { result } : {}),
          ...(includeTiming ? { durationMs: now() - startedAt } : {})
        }
      };

      await emit(entry);
      return result;
    };

    const logError = async (error) => {
      const entry = {
        ts: new Date(startedAt).toISOString(),
        level: "ERROR",
        functionName: contextName,
        message: `${contextName} failed`,
        meta: {
          ...(inputPayload || {}),
          error: error instanceof Error ? error.message : String(error),
          ...(includeTiming ? { durationMs: now() - startedAt } : {})
        }
      };

      await emit(entry);
      throw error;
    };

    try {
      const result = fn.apply(this, args);
      if (result && typeof result.then === "function") {
        return result.then(logSuccess, logError);
      }

      return Promise.resolve(result).then(logSuccess);
    } catch (error) {
      return logError(error);
    }
  };
}

async function runLoggingDecoratorDemo() {
  renderBanner("Logging decorator demo", "Configurable log levels and structured output");
  renderSection("What this demonstrates", chalk.cyan);
  renderList([
    "Logs function input and output values.",
    "Supports INFO, DEBUG, WARN and ERROR levels.",
    "Works with sync and async functions.",
    "Can write to console, file, or memory sink.",
    "Includes execution time profiling."
  ], chalk.whiteBright);

  const syncCalculator = createLoggingDecorator((a, b) => a + b, {
    name: "syncCalculator",
    level: "INFO",
    includeArgs: true,
    includeResult: true,
    destination: "memory"
  });

  const asyncFetcher = createLoggingDecorator(async (ticketId) => {
    await sleep(130);
    return { ticketId, status: "resolved", priority: "high" };
  }, {
    name: "asyncFetcher",
    level: "DEBUG",
    includeArgs: true,
    includeResult: true,
    destination: "memory"
  });

  const errorOnly = createLoggingDecorator(() => {
    throw new Error("Validation error: invalid payload");
  }, {
    name: "errorGuard",
    onlyErrors: true,
    includeArgs: true,
    destination: "memory"
  });

  const syncResult = await syncCalculator(12, 18);
  const asyncResult = await asyncFetcher("HD-1005");

  try {
    await errorOnly({ broken: true });
  } catch {
    // expected demo failure
  }

  renderCard(
    "Demo results",
    [
      ["Sync result", String(syncResult)],
      ["Async result", JSON.stringify(asyncResult)],
      ["Error policy", "Only errors were logged"]
    ],
    chalk.blue
  );

  renderSection("Structured log samples", chalk.green);
  renderTable(
    ["Level", "Function", "Status", "Timing"],
    [
      ["INFO", "syncCalculator", "success", "profiling on"],
      ["DEBUG", "asyncFetcher", "success", "profiling on"],
      ["ERROR", "errorGuard", "failure", "profiling on"]
    ]
  );

  renderSection("Why it matters", chalk.magenta);
  renderKeyValueRows([
    ["Console", "Immediate developer feedback", chalk.whiteBright],
    ["File", "JSONL records for later analysis", chalk.whiteBright],
    ["Memory", "Easy to inspect in tests", chalk.whiteBright]
  ]);

  logLine("Logging decorator demo completed");
}

module.exports = {
  createLogSink,
  createLoggingDecorator,
  runLoggingDecoratorDemo
};

if (require.main === module) {
  runLoggingDecoratorDemo().catch((error) => {
    console.error("Logging decorator demo failed:", error);
    process.exitCode = 1;
  });
}
