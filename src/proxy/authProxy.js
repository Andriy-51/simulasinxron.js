const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { logLine } = require("../logs/logger");
const { sleep, now } = require("../utils/delay");

class ApiKeyStrategy {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = "api-key";
  }

  apply(request) {
    return {
      ...request,
      headers: {
        ...(request.headers || {}),
        "x-api-key": this.apiKey
      }
    };
  }
}

class JwtStrategy {
  constructor(token, expiresAt = Date.now() + 1_000) {
    this.token = token;
    this.expiresAt = expiresAt;
    this.name = "jwt";
  }

  isExpired() {
    return Date.now() >= this.expiresAt;
  }

  async renew() {
    await sleep(120);
    this.token = `jwt-${Math.random().toString(36).slice(2, 8)}`;
    this.expiresAt = Date.now() + 1_200;
    return this.token;
  }

  apply(request) {
    return {
      ...request,
      headers: {
        ...(request.headers || {}),
        authorization: `Bearer ${this.token}`
      }
    };
  }
}

class OAuthStrategy {
  constructor(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.name = "oauth";
    this.expiresAt = Date.now() + 900;
  }

  isExpired() {
    return Date.now() >= this.expiresAt;
  }

  async renew() {
    await sleep(150);
    this.accessToken = `oauth-${Math.random().toString(36).slice(2, 8)}`;
    this.expiresAt = Date.now() + 1_500;
    return this.accessToken;
  }

  apply(request) {
    return {
      ...request,
      headers: {
        ...(request.headers || {}),
        authorization: `Bearer ${this.accessToken}`,
        "x-refresh-token": this.refreshToken
      }
    };
  }
}

function createAuthStrategy(options = {}) {
  const type = String(options.type || "api-key").toLowerCase();

  if (type === "jwt") {
    return new JwtStrategy(options.token || "jwt-demo-token", options.expiresAt);
  }

  if (type === "oauth") {
    return new OAuthStrategy(options.accessToken || "oauth-demo-token", options.refreshToken || "refresh-demo-token");
  }

  return new ApiKeyStrategy(options.apiKey || "demo-api-key");
}

function createFakeApiService(name = "orders-api") {
  return {
    name,
    async request(request) {
      await sleep(80 + Math.floor(Math.random() * 120));
      return {
        ok: true,
        service: name,
        path: request.path,
        method: request.method || "GET",
        receivedHeaders: request.headers || {},
        payload: request.payload || null,
        ts: now()
      };
    }
  };
}

function createAuthProxy(service, options = {}) {
  if (!service || typeof service.request !== "function") {
    throw new Error("service must expose request()");
  }

  let strategy = createAuthStrategy(options.strategy || options);
  const limit = Math.max(1, Number(options.rateLimit || 5));
  const windowMs = Math.max(100, Number(options.rateWindowMs || 1_000));
  let requestTimestamps = [];
  const events = [];

  const record = (type, detail) => {
    const entry = {
      ts: now(),
      type,
      detail
    };
    events.push(entry);
    if (options.verbose !== false) {
      logLine(`[proxy:${strategy.name}] ${type}`, detail);
    }
  };

  const checkRateLimit = async () => {
    const current = now();
    requestTimestamps = requestTimestamps.filter((timestamp) => current - timestamp < windowMs);

    if (requestTimestamps.length >= limit) {
      const waitMs = windowMs - (current - requestTimestamps[0]);
      record("rate-limit", { waitMs });
      await sleep(waitMs);
      requestTimestamps = requestTimestamps.filter((timestamp) => now() - timestamp < windowMs);
    }

    requestTimestamps.push(now());
  };

  const proxy = {
    name: `${service.name || "api"}-proxy`,
    async request(request) {
      await checkRateLimit();

      if (typeof strategy.isExpired === "function" && strategy.isExpired()) {
        record("token-expired", { strategy: strategy.name });
        if (typeof strategy.renew === "function") {
          const renewed = await strategy.renew();
          record("token-renewed", { token: renewed });
        }
      }

      const adaptedRequest = strategy.apply(request);
      record("forward", {
        method: adaptedRequest.method || "GET",
        path: adaptedRequest.path,
        strategy: strategy.name
      });

      const response = await service.request(adaptedRequest);
      record("response", { path: adaptedRequest.path, ok: response.ok });
      return response;
    },
    async get(path, options = {}) {
      return proxy.request({ path, method: "GET", ...options });
    },
    async post(path, payload, options = {}) {
      return proxy.request({ path, method: "POST", payload, ...options });
    },
    useStrategy(nextStrategyOptions) {
      strategy = createAuthStrategy(nextStrategyOptions);
      record("strategy-switched", { strategy: strategy.name });
    },
    getEvents() {
      return [...events];
    },
    getStrategyName() {
      return strategy.name;
    }
  };

  return proxy;
}

async function runAuthProxyDemo() {
  renderBanner("Auth proxy demo", "API credentials injection and strategy switching");
  renderSection("What this demonstrates", chalk.cyan);
  renderList([
    "Proxy intercepts outgoing API calls and injects credentials.",
    "Supports API key, JWT, and OAuth strategies.",
    "Rate limiting and token renewal are handled automatically.",
    "Authentication strategy can be switched at runtime."
  ], chalk.whiteBright);

  const service = createFakeApiService("billing-api");
  const proxy = createAuthProxy(service, {
    strategy: { type: "oauth", accessToken: "oauth-init", refreshToken: "refresh-001" },
    rateLimit: 3,
    rateWindowMs: 650,
    verbose: false
  });

  renderCard(
    "Proxy settings",
    [
      ["Service", service.name],
      ["Strategy", proxy.getStrategyName()],
      ["Rate limit", "3 requests / 650 ms"],
      ["Scenario", "Client -> auth proxy -> API"]
    ],
    chalk.blue
  );

  const steps = [
    { method: "GET", path: "/v1/orders" },
    { method: "POST", path: "/v1/orders", payload: { sku: "BK-12", quantity: 2 } },
    { method: "GET", path: "/v1/invoices" },
    { method: "GET", path: "/v1/reports" }
  ];

  const results = [];
  for (const step of steps) {
    results.push(await proxy.request(step));
  }

  proxy.useStrategy({ type: "jwt", token: "jwt-initial-token" });
  results.push(await proxy.get("/v1/profile"));

  renderSection("API call results", chalk.green);
  renderTable(
    ["Method", "Path", "Auth header", "Status"],
    results.map((result) => [
      result.method,
      result.path,
      result.receivedHeaders.authorization || result.receivedHeaders["x-api-key"] || result.receivedHeaders["x-refresh-token"] ? "present" : "missing",
      result.ok ? "ok" : "fail"
    ])
  );

  const events = proxy.getEvents();
  const summary = events.reduce((accumulator, event) => {
    accumulator[event.type] = (accumulator[event.type] || 0) + 1;
    return accumulator;
  }, {});

  renderSection("Proxy telemetry", chalk.magenta);
  renderKeyValueRows([
    ["Strategy changes", String(summary["strategy-switched"] || 0), chalk.whiteBright],
    ["Forwarded calls", String(summary.forward || 0), chalk.whiteBright],
    ["Rate-limit pauses", String(summary["rate-limit"] || 0), chalk.whiteBright],
    ["Token renewals", String(summary["token-renewed"] || 0), chalk.whiteBright]
  ]);
}

module.exports = {
  ApiKeyStrategy,
  JwtStrategy,
  OAuthStrategy,
  createAuthStrategy,
  createFakeApiService,
  createAuthProxy,
  runAuthProxyDemo
};

if (require.main === module) {
  runAuthProxyDemo().catch((error) => {
    console.error("Auth proxy demo failed:", error);
    process.exitCode = 1;
  });
}
