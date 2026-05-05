const fs = require("fs/promises");
const path = require("path");

const DEFAULT_CONFIG = {
  runtime: {
    outputPath: "outputs",
    reportPath: "outputs",
    snapshotPath: "outputs/snapshots",
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

/**
 * Load environment-style key/value pairs from a .env file.
 * @param {string} envPath - Path to the .env file.
 * @returns {Promise<object>} Parsed variables.
 */
async function loadDotEnv(envPath = path.resolve(process.cwd(), ".env")) {
  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key) {
        parsed[key] = value;
      }
    }

    return parsed;
  } catch {
    return {};
  }
}

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "") return "";
  if (!Number.isNaN(Number(value)) && value.trim() !== "") return Number(value);
  return value;
}

function applyEnvOverrides(target, envSource = process.env) {
  const envMap = [
    [["SIM_RUNTIME_OUTPUT_PATH", "RUNTIME_OUTPUT_PATH"], ["runtime", "outputPath"]],
    [["SIM_RUNTIME_REPORT_PATH", "RUNTIME_REPORT_PATH"], ["runtime", "reportPath"]],
    [["SIM_RUNTIME_SNAPSHOT_PATH", "RUNTIME_SNAPSHOT_PATH"], ["runtime", "snapshotPath"]],
    [["SIM_RUNTIME_QUEUE_CONCURRENCY", "RUNTIME_QUEUE_CONCURRENCY"], ["runtime", "queueConcurrency"]],
    [["SIM_RUNTIME_QUEUE_RATE_LIMIT", "RUNTIME_QUEUE_RATE_LIMIT"], ["runtime", "queueRateLimit"]],
    [["SIM_RUNTIME_QUEUE_RATE_WINDOW_MS", "RUNTIME_QUEUE_RATE_WINDOW_MS"], ["runtime", "queueRateWindowMs"]],
    [["SIM_RUNTIME_MONITOR_REFRESH_MS", "RUNTIME_MONITOR_REFRESH_MS"], ["runtime", "monitorRefreshMs"]],
    [["SIM_AUTH_TYPE", "AUTH_TYPE"], ["authProxy", "type"]],
    [["SIM_AUTH_API_KEY", "AUTH_API_KEY"], ["authProxy", "apiKey"]],
    [["SIM_AUTH_TOKEN", "AUTH_TOKEN"], ["authProxy", "token"]],
    [["SIM_AUTH_ACCESS_TOKEN", "AUTH_ACCESS_TOKEN"], ["authProxy", "accessToken"]],
    [["SIM_AUTH_REFRESH_TOKEN", "AUTH_REFRESH_TOKEN"], ["authProxy", "refreshToken"]],
    [["SIM_LOG_LEVEL", "LOG_LEVEL"], ["logging", "level"]],
    [["SIM_LOG_DESTINATION", "LOG_DESTINATION"], ["logging", "destination"]],
    [["SIM_DEMO_BATCH_SIZE", "DEMO_BATCH_SIZE"], ["demo", "batchSize"]],
    [["SIM_DEMO_ROUND_ROBIN_CYCLES", "DEMO_ROUND_ROBIN_CYCLES"], ["demo", "roundRobinCycles"]],
    [["SIM_DEMO_CLIENTS", "DEMO_CLIENTS"], ["demo", "clients"]],
    [["SIM_DEMO_REQUESTS_PER_CLIENT", "DEMO_REQUESTS_PER_CLIENT"], ["demo", "requestsPerClient"]],
    [["SIM_DEMO_VIP_RATE", "DEMO_VIP_RATE"], ["demo", "vipRate"]],
    [["SIM_DEMO_TOTAL_REQUESTS", "DEMO_TOTAL_REQUESTS"], ["demo", "totalRequests"]]
  ];

  for (const [keys, pathParts] of envMap) {
    const envKey = keys.find((key) => envSource[key] !== undefined);
    if (envKey) {
      let cursor = target;
      for (let index = 0; index < pathParts.length - 1; index += 1) {
        cursor = cursor[pathParts[index]];
      }
      cursor[pathParts[pathParts.length - 1]] = parseValue(envSource[envKey]);
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

/**
 * Load config.json, then overlay .env and process environment values.
 * @param {string} [configPath] - Path to config.json.
 * @param {string} [envPath] - Path to .env.
 * @returns {Promise<object>} Resolved configuration.
 */
async function loadConfig(configPath = path.resolve(process.cwd(), "config.json"), envPath = path.resolve(process.cwd(), ".env")) {
  let fileConfig = {};

  try {
    const raw = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }

  const config = deepMerge(DEFAULT_CONFIG, fileConfig);
  const dotenvConfig = await loadDotEnv(envPath);
  applyEnvOverrides(config, { ...dotenvConfig, ...process.env });
  return config;
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  loadDotEnv
};
