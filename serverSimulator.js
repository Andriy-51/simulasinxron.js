const { runServerSimulation } = require("./src/server/server");

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatInRange(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function printHelp() {
  console.log(`
Server simulation usage:
  node serverSimulator.js [options]

Options:
  --demo                 Use a random demo stream of requests
  --clients=N            Number of clients (default: 5)
  --requests=N           Requests per client (default: 6)
  --concurrency=N        Max parallel workers (default: 3)
  --vip=F                VIP request ratio from 0 to 1 (default: 0.25)
  --total=N              Total requests in demo mode
  --label=TEXT           Custom title shown in the report
  --report=PATH          Write metrics report to a JSON file
  --help                 Show this help message
`);
}

function parseCliOptions(argv) {
  const opts = {
    clients: 5,
    requestsPerClient: 6,
    concurrency: 3,
    vipRate: 0.25,
    demo: false,
    totalRequests: null,
    label: null,
    reportPath: null,
    help: false
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--demo") {
      opts.demo = true;
      continue;
    }
    if (arg.startsWith("--clients=")) {
      opts.clients = parseInteger(arg.split("=")[1], opts.clients);
      continue;
    }
    if (arg.startsWith("--requests=")) {
      opts.requestsPerClient = parseInteger(arg.split("=")[1], opts.requestsPerClient);
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      opts.concurrency = parseInteger(arg.split("=")[1], opts.concurrency);
      continue;
    }
    if (arg.startsWith("--vip=")) {
      const v = Number.parseFloat(arg.split("=")[1]);
      if (Number.isFinite(v) && v >= 0 && v <= 1) opts.vipRate = v;
      continue;
    }
    if (arg.startsWith("--total=")) {
      opts.totalRequests = parseInteger(arg.split("=")[1], null);
      continue;
    }
    if (arg.startsWith("--label=")) {
      const value = arg.split("=").slice(1).join("=").trim();
      if (value) {
        opts.label = value;
      }
      continue;
    }
    if (arg.startsWith("--report=")) {
      const value = arg.split("=").slice(1).join("=").trim();
      if (value) {
        opts.reportPath = value;
      }
      continue;
    }
  }

  return opts;
}

function validateOptions(options) {
  if (!options.demo && options.totalRequests !== null) {
    return "--total is only used with --demo";
  }
  if (options.vipRate < 0 || options.vipRate > 1) {
    return "--vip must be between 0 and 1";
  }
  return null;
}

if (require.main === module) {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const validationError = validateOptions(options);
  if (validationError) {
    console.error(`Invalid options: ${validationError}`);
    printHelp();
    process.exit(1);
  }

  runServerSimulation(options).catch((err) => {
    console.error("Server simulation failed:", err);
    process.exitCode = 1;
  });
}

module.exports = { runServerSimulation };
