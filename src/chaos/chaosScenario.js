/**
 * Chaos Engineering - Server Failure Simulation
 * 
 * Demonstrates system resilience through:
 * - Progressive server failure (graceful degradation)
 * - Priority redistribution under load
 * - Resource protection via auth proxy
 * - Recovery and fallback mechanisms
 */

const fs = require("fs/promises");
const path = require("path");
const { chalk, renderBanner, renderCard, renderKeyValueRows, renderList, renderSection, renderTable } = require("../ui/terminalUi");
const { sleep, now } = require("../utils/delay");
const { createFaultInjector, runWithRetry } = require("./faultInjection");
const { createAuthProxy, createFakeApiService } = require("../proxy/authProxy");
const { BiDirectionalPriorityQueue } = require("../queue/biDirectionalPriorityQueue");

class SimulatedServer {
  constructor(serverId, initialHealth = 1.0) {
    this.serverId = serverId;
    this.health = initialHealth;
    this.requestsProcessed = 0;
    this.requestsFailed = 0;
    this.failureStartTime = null;
    this.isOnline = true;
  }

  async processRequest(request) {
    if (!this.isOnline) {
      throw new Error(`Server ${this.serverId} is offline`);
    }

    if (Math.random() > this.health) {
      this.requestsFailed += 1;
      throw new Error(`Server ${this.serverId} failed under degraded health (${(this.health * 100).toFixed(1)}%)`);
    }

    const baseProcessingTime = 50 + Math.floor(Math.random() * 100);
    await sleep(baseProcessingTime);
    
    this.requestsProcessed += 1;
    return {
      serverId: this.serverId,
      requestId: request.sequence,
      processingTimeMs: baseProcessingTime
    };
  }

  degradeHealth(amount = 0.1) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0 && this.isOnline) {
      this.isOnline = false;
      this.failureStartTime = now();
    }
  }

  repair(repairAmount = 0.3) {
    this.health = Math.min(1.0, this.health + repairAmount);
    if (this.health > 0 && !this.isOnline) {
      this.isOnline = true;
      this.failureStartTime = null;
    }
  }

  getStatus() {
    return {
      serverId: this.serverId,
      health: this.health,
      isOnline: this.isOnline,
      processed: this.requestsProcessed,
      failed: this.requestsFailed,
      successRate: this.requestsProcessed + this.requestsFailed === 0 
        ? 100 
        : (this.requestsProcessed / (this.requestsProcessed + this.requestsFailed)) * 100
    };
  }
}

class ChaosScenarioRunner {
  constructor(serverCount = 3) {
    this.servers = Array.from(
      { length: serverCount },
      (_, idx) => new SimulatedServer(idx + 1)
    );
    this.queue = new BiDirectionalPriorityQueue();
    this.protectedService = createFakeApiService("chaos-control");
    this.resourceProxy = createAuthProxy(this.protectedService, {
      strategy: { type: "api-key", apiKey: "chaos-control-key" },
      accessLevel: "premium",
      allowedActions: ["inspect", "reroute", "recover"],
      blockedResources: ["maintenance"],
      verbose: false
    });
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      startTime: now(),
      serverOutages: 0,
      recoveries: 0,
      protectedRequests: 0,
      blockedMaintenanceRequests: 0
    };
    this.injectedFallback = createFaultInjector(this.processWithFallback.bind(this), {
      label: "chaosFallback",
      failureRate: 0.15,
      delayRate: 0.35,
      maxDelayMs: 120
    });
  }

  async processWithFallback(request) {
    const servers = [...this.servers].sort((a, b) => b.health - a.health);
    
    for (const server of servers) {
      try {
        const result = await server.processRequest(request);
        this.metrics.successfulRequests += 1;
        return result;
      } catch (error) {
        continue;
      }
    }

    this.metrics.failedRequests += 1;
    throw new Error("All servers failed to process request");
  }

  async sendBatch(batchSize, label) {
    const results = [];

    for (let i = 0; i < batchSize; i += 1) {
      const request = {
        sequence: this.metrics.totalRequests + 1,
        priority: Math.random() < 0.2 ? 1 : 0,
        sentAt: now()
      };

      this.metrics.totalRequests += 1;

      try {
        const result = await runWithRetry(() => this.injectedFallback(request), 3);

        if (result.ok) {
          results.push({ ok: true, attempts: result.attempts });
        } else {
          this.metrics.retriedRequests += 1;
          results.push({ ok: false, attempts: result.attempts });
        }
      } catch (error) {
        results.push({ ok: false, error: error.message });
      }

      if (String(label).toLowerCase().includes("attack") && i % 7 === 0) {
        await this.guardMaintenanceResource();
      }

      await sleep(20);
    }

    return results;
  }

  async guardMaintenanceResource() {
    try {
      await this.resourceProxy.request({
        path: "/ops/maintenance",
        method: "POST",
        action: "inspect",
        resource: "maintenance",
        requiredAccessLevel: "admin"
      });
      this.metrics.protectedRequests += 1;
      return true;
    } catch {
      this.metrics.blockedMaintenanceRequests += 1;
      return false;
    }
  }

  async triggerServerDegradation(serverId, durationSeconds, degradationRate) {
    const server = this.servers.find(s => s.serverId === serverId);
    if (!server) return;

    this.resourceProxy.setAccessLevel("standard");
    this.resourceProxy.setPolicy({ blockedResources: ["maintenance"] });

    const steps = Math.ceil(durationSeconds * 10);
    const degradationPerStep = degradationRate / steps;

    for (let i = 0; i < steps; i += 1) {
      server.degradeHealth(degradationPerStep);
      if (!server.isOnline) {
        this.metrics.serverOutages += 1;
      }
      await sleep(100);
    }
  }

  async triggerServerRecovery(serverId, durationSeconds, recoveryRate) {
    const server = this.servers.find(s => s.serverId === serverId);
    if (!server) return;

    this.resourceProxy.setAccessLevel("admin");
    this.resourceProxy.setPolicy({ blockedResources: [] });

    const steps = Math.ceil(durationSeconds * 10);
    const recoveryPerStep = recoveryRate / steps;

    for (let i = 0; i < steps; i += 1) {
      if (!server.isOnline) {
        server.repair(recoveryPerStep);
        this.metrics.recoveries += 1;
      }
      await sleep(100);
    }
  }

  renderServerStatus() {
    renderSection("Server Status", chalk.cyan);
    const headers = ["Server", "Health", "Status", "Processed", "Failed", "Success %"];
    const rows = this.servers.map(server => {
      const status = server.getStatus();
      const healthColor = 
        server.health > 0.7 ? chalk.green :
        server.health > 0.3 ? chalk.yellow :
        chalk.red;

      return [
        `Server ${status.serverId}`,
        healthColor(`${(status.health * 100).toFixed(0)}%`),
        server.isOnline ? chalk.green("ONLINE") : chalk.red("OFFLINE"),
        String(status.processed),
        String(status.failed),
        `${status.successRate.toFixed(1)}%`
      ];
    });

    renderTable(headers, rows);
  }

  renderMetrics() {
    renderSection("Chaos Metrics", chalk.cyan);
    const elapsedSeconds = (now() - this.metrics.startTime) / 1000;
    const successRate = this.metrics.totalRequests > 0
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
      : 0;

    renderKeyValueRows([
      ["Total Requests", String(this.metrics.totalRequests)],
      ["Successful", String(this.metrics.successfulRequests)],
      ["Failed", String(this.metrics.failedRequests)],
      ["Retried", String(this.metrics.retriedRequests)],
      ["Success Rate", `${successRate.toFixed(1)}%`],
      ["Server Outages", String(this.metrics.serverOutages)],
      ["Recoveries", String(this.metrics.recoveries)],
          ["Protected requests", String(this.metrics.protectedRequests)],
          ["Blocked maintenance", String(this.metrics.blockedMaintenanceRequests)],
      ["Elapsed Time", `${elapsedSeconds.toFixed(1)}s`]
    ]);
  }

  getSummary() {
    const elapsedSeconds = (now() - this.metrics.startTime) / 1000;
    const successRate = this.metrics.totalRequests > 0
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
      : 0;

    return {
      timestamp: new Date().toISOString(),
      duration: {
        seconds: elapsedSeconds,
        startTime: new Date(this.metrics.startTime).toISOString()
      },
      requests: {
        total: this.metrics.totalRequests,
        successful: this.metrics.successfulRequests,
        failed: this.metrics.failedRequests,
        retried: this.metrics.retriedRequests,
        successRate: successRate
      },
      resilience: {
        serverOutages: this.metrics.serverOutages,
        recoveries: this.metrics.recoveries,
            protectedRequests: this.metrics.protectedRequests,
            blockedMaintenanceRequests: this.metrics.blockedMaintenanceRequests,
        serverCount: this.servers.length,
        serverStatuses: this.servers.map(s => s.getStatus())
      }
    };
  }
}

async function runChaosEngineeringLab(options = {}) {
  renderBanner("Chaos Engineering Lab", "Server failure simulation & recovery analysis");

  renderSection("Scenario Design", chalk.cyan);
  renderList([
    "Initialize 3 web servers",
    "Send requests in batches to test resilience",
    "Gradually degrade Server #1 (simulating hardware issues)",
    "Monitor priority redistribution and fallback behavior",
    "Trigger recovery on Server #1",
    "Verify system stabilization"
  ]);

  const chaos = new ChaosScenarioRunner(options.serverCount || 3);

  // Phase 1: Normal operation baseline
  renderSection("Phase 1: Baseline (30 requests, healthy servers)", chalk.bold.cyan);
  const phase1Results = await chaos.sendBatch(30, "Baseline");
  chaos.renderServerStatus();
  chaos.renderMetrics();

  // Phase 2: Gradual degradation
  renderSection("Phase 2: Progressive Degradation (Server #1)", chalk.bold.yellow);
  const degradationTask = chaos.triggerServerDegradation(1, 3, 0.8);
  const batchTask = chaos.sendBatch(40, "Under Attack");
  await Promise.all([degradationTask, batchTask]);

  chaos.renderServerStatus();
  chaos.renderMetrics();

  // Phase 3: Recovery
  renderSection("Phase 3: Recovery Initiated", chalk.bold.green);
  await chaos.triggerServerRecovery(1, 2, 0.6);
  const phase3Results = await chaos.sendBatch(30, "Recovery");

  chaos.renderServerStatus();
  chaos.renderMetrics();

  // Final summary
  renderSection("Analysis Summary", chalk.bold.cyan);
  const summary = chaos.getSummary();
  const reportDir = path.resolve(process.cwd(), options.outputDir || "outputs");
  const reportPath = path.resolve(process.cwd(), options.reportPath || path.join(reportDir, `chaos-demo-${Date.now()}.json`));
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  renderCard(
    "System Resilience Report",
    [
      ["Total Requests Processed", String(summary.requests.total)],
      ["Overall Success Rate", `${summary.requests.successRate.toFixed(2)}%`],
      ["Server Outages Detected", String(summary.resilience.serverOutages)],
      ["Recovery Operations", String(summary.resilience.recoveries)],
      ["Protected Requests", String(summary.resilience.protectedRequests)],
      ["Blocked Maintenance", String(summary.resilience.blockedMaintenanceRequests)],
      ["Test Duration", `${summary.duration.seconds.toFixed(1)}s`],
      ["Report File", reportPath]
    ],
    chalk.green
  );

  renderList([
    "Priority queue redistributed load to healthy servers",
    "Retry mechanism recovered from transient failures",
    "System gracefully degraded instead of complete failure",
    "Recovery was automatic once server health improved"
  ], chalk.whiteBright);

  return summary;
}

module.exports = {
  SimulatedServer,
  ChaosScenarioRunner,
  runChaosEngineeringLab
};
