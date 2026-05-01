const fs = require("fs/promises");
const path = require("path");

const DEFAULT_CONFIG = {
  runtime: {
    reportPath: "reports",
    snapshotPath: "snapshots",
    queueConcurrency: 3,
    queueRateLimit: 5,
    queueRateWindowMs: 1000,
    monitorRefreshMs: 500
  },
  authProxy: {
    type: "oauth",
    apiKey: "demo-api-key",
    token: "jwt-demo-token",
    accessToken: "oauth-demo-token",
    refreshToken: "refresh-demo-token"
  },
  logging: {
    level: "INFO",
    destination: "console"
  },
  demo: {
    batchSize: 8,
    roundRobinCycles: 12,
    clients: 4,
    requestsPerClient: 5,
    vipRate: 0.25,
    totalRequests: 40
  }
};

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "") return "";
  if (!Number.isNaN(Number(value)) && value.trim() !== "") return Number(value);
  return value;
}

function applyEnvOverrides(target) {
  const envMap = {
    SIM_RUNTIME_QUEUE_CONCURRENCY: ["runtime", "queueConcurrency"],
    SIM_RUNTIME_QUEUE_RATE_LIMIT: ["runtime", "queueRateLimit"],
    SIM_RUNTIME_QUEUE_RATE_WINDOW_MS: ["runtime", "queueRateWindowMs"],
    SIM_RUNTIME_MONITOR_REFRESH_MS: ["runtime", "monitorRefreshMs"],
    SIM_AUTH_TYPE: ["authProxy", "type"],
    SIM_AUTH_API_KEY: ["authProxy", "apiKey"],
    SIM_AUTH_TOKEN: ["authProxy", "token"],
    SIM_AUTH_ACCESS_TOKEN: ["authProxy", "accessToken"],
    SIM_AUTH_REFRESH_TOKEN: ["authProxy", "refreshToken"],
    SIM_LOG_LEVEL: ["logging", "level"],
    SIM_LOG_DESTINATION: ["logging", "destination"],
    SIM_DEMO_BATCH_SIZE: ["demo", "batchSize"],
    SIM_DEMO_ROUND_ROBIN_CYCLES: ["demo", "roundRobinCycles"],
    SIM_DEMO_CLIENTS: ["demo", "clients"],
    SIM_DEMO_REQUESTS_PER_CLIENT: ["demo", "requestsPerClient"],
    SIM_DEMO_VIP_RATE: ["demo", "vipRate"],
    SIM_DEMO_TOTAL_REQUESTS: ["demo", "totalRequests"]
  };

  for (const [envKey, pathParts] of Object.entries(envMap)) {
    if (process.env[envKey] !== undefined) {
      let cursor = target;
      for (let index = 0; index < pathParts.length - 1; index += 1) {
        cursor = cursor[pathParts[index]];
      }
      cursor[pathParts[pathParts.length - 1]] = parseValue(process.env[envKey]);
    }
  }
}

function deepMerge(base, patch) {
  const result = Array.isArray(base) ? [...base] : { ...base };

  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function loadConfig(configPath = path.resolve(process.cwd(), "config.json")) {
  let fileConfig = {};

  try {
    const raw = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }

  const config = deepMerge(DEFAULT_CONFIG, fileConfig);
  applyEnvOverrides(config);
  return config;
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig
};
