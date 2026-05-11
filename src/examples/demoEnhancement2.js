/**
 * Enhancement #2 Demo: Chaos Engineering
 * 
 * Demonstrates server resilience testing under failure conditions
 * 
 * Run with: npm run demo:chaos
 */

const { chalk, renderBanner, renderSection, renderList, renderCard } = require("../ui/terminalUi");
const { runChaosEngineeringLab } = require("../chaos/chaosScenario");
const { sleep } = require("../utils/delay");

async function runChaosEngineeringDemo() {
  renderBanner("Chaos Engineering Lab", "System Resilience Testing");

  renderSection("What is Chaos Engineering?", chalk.cyan);
  renderList([
    "Deliberately injects failures into systems to test resilience",
    "Validates automatic failover and recovery mechanisms",
    "Measures system behavior under degraded conditions",
    "Identifies bottlenecks and single points of failure"
  ]);

  await sleep(1000);

  renderSection("Chaos Engineering Demo Goals", chalk.cyan);
  renderList([
    "1. Establish baseline with all servers healthy",
    "2. Gradually degrade Server #1 to simulate hardware failure",
    "3. Monitor load redistribution to healthy servers",
    "4. Trigger recovery sequence and verify restoration",
    "5. Analyze system resilience metrics"
  ]);

  await sleep(1500);

  // Run the chaos lab
  const results = await runChaosEngineeringLab();

  // Analysis
  renderSection("Chaos Test Analysis", chalk.bold.cyan);

  renderCard(
    "Success Rate Analysis",
    [
      ["Total Requests Sent", String(results.requests.total)],
      ["Successful Completions", String(results.requests.successful)],
      ["Overall Success Rate", `${results.requests.successRate.toFixed(2)}%`],
      ["Failed Requests", String(results.requests.failed)],
      ["Retried Requests", String(results.requests.retried)]
    ],
    chalk.blue
  );

  renderCard(
    "System Resilience Metrics",
    [
      ["Server Outages Detected", String(results.resilience.serverOutages)],
      ["Recovery Operations", String(results.resilience.recoveries)],
      ["Total Servers", String(results.resilience.serverCount)],
      ["Test Duration", `${results.duration.seconds.toFixed(1)} seconds`]
    ],
    chalk.blue
  );

  // Server details
  renderSection("Server Performance Summary", chalk.cyan);
  const servers = results.resilience.serverStatuses;
  servers.forEach((server) => {
    const healthColor = 
      server.health > 0.7 ? chalk.green :
      server.health > 0.3 ? chalk.yellow :
      chalk.red;

    renderCard(
      `Server ${server.serverId}`,
      [
        ["Health Status", healthColor(`${(server.health * 100).toFixed(0)}%`)],
        ["Is Online", server.isOnline ? chalk.green("YES") : chalk.red("NO")],
        ["Processed Requests", String(server.processed)],
        ["Failed Requests", String(server.failed)],
        ["Success Rate", `${server.successRate.toFixed(1)}%`]
      ],
      chalk.blue
    );
  });

  // Key insights
  renderSection("Key Findings", chalk.bold.cyan);
  renderList([
    "The system maintained " + chalk.green(`${results.requests.successRate.toFixed(1)}%`) + " success rate despite server failures",
    "Load was automatically redistributed to healthy servers through priority queue",
    "Retry mechanism recovered " + chalk.green(String(results.requests.retried)) + " requests from transient failures",
    "System gracefully degraded instead of complete failure (graceful degradation)",
    "Recovery was automatic once server health improved (self-healing)"
  ]);

  // Usage recommendations
  renderSection("Recommended Practices", chalk.cyan);
  renderList([
    "Deploy load balancers to distribute traffic across servers",
    "Implement health checks to detect failures quickly",
    "Use circuit breakers to prevent cascade failures",
    "Design for graceful degradation (partial functionality)",
    "Monitor server health metrics in real-time",
    "Test failover procedures regularly"
  ]);

  renderList([
    "✓ Chaos engineering validates system resilience",
    "✓ Identifies automatic recovery capabilities",
    "✓ Proves system stability under failure conditions",
    "✓ Builds confidence in production deployments"
  ], chalk.green);
}

if (require.main === module) {
  runChaosEngineeringDemo().catch(console.error);
}

module.exports = { runChaosEngineeringDemo };
