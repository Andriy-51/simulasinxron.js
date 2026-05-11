/**
 * Enhancement #1 Demo: Dashboard Metrics
 * 
 * Demonstrates real-time system monitoring capabilities
 * 
 * Run with: npm run demo:dashboard
 */

const { chalk, renderBanner, renderSection, renderList, renderCard } = require("../ui/terminalUi");
const { DashboardMetrics } = require("../system/dashboardMetrics");
const { sleep } = require("../utils/delay");

async function runDashboardDemo() {
  renderBanner("Dashboard Metrics System", "Real-time Monitoring Demo");

  renderSection("What is Dashboard Metrics?", chalk.cyan);
  renderList([
    "Tracks queue operations: size, throughput, latency",
    "Monitors cache performance: hit rate, evictions, efficiency",
    "Observes iterator processing: active count, timeouts, completions",
    "Reports system health: error tracking, warnings, overall score"
  ]);

  await sleep(1000);

  // Create dashboard
  const dashboard = new DashboardMetrics("Production System Monitor");

  // Simulate queue operations
  renderSection("Phase 1: Simulating Queue Operations", chalk.bold.cyan);
  for (let i = 0; i < 5; i += 1) {
    dashboard.trackQueueSize(Math.floor(Math.random() * 15));
    dashboard.trackQueueProcessed(Math.random() > 0.3 ? 1 : 0);
    dashboard.trackProcessingTime(50 + Math.floor(Math.random() * 100));
    await sleep(200);
  }

  console.log();
  dashboard.renderQueueMetrics();
  await sleep(500);

  // Simulate cache hits
  renderSection("Phase 2: Cache Performance", chalk.bold.cyan);
  for (let i = 0; i < 15; i += 1) {
    if (Math.random() > 0.25) {
      dashboard.trackCacheHit();
    } else {
      dashboard.trackCacheMiss();
    }

    if (Math.random() > 0.85) {
      dashboard.trackCacheEviction();
    }
  }
  dashboard.trackCacheSize(12, 20);

  console.log();
  dashboard.renderCacheMetrics();
  await sleep(500);

  // Simulate iterators
  renderSection("Phase 3: Iterator Processing", chalk.bold.cyan);
  for (let i = 0; i < 8; i += 1) {
    dashboard.trackIteratorStart();
    await sleep(100);
    dashboard.trackIteratorComplete();
  }

  console.log();
  dashboard.renderIteratorMetrics();
  await sleep(500);

  // Simulate some errors
  renderSection("Phase 4: System Health Tracking", chalk.bold.cyan);
  dashboard.recordWarning("High memory usage detected");
  dashboard.recordError("Request timeout on queue operation");

  console.log();
  dashboard.renderSystemHealth();
  await sleep(500);

  // Final full dashboard
  renderSection("Final Dashboard State", chalk.bold.green);
  dashboard.renderFullDashboard();

  // Summary
  renderSection("Dashboard Capabilities Summary", chalk.cyan);
  renderCard(
    "Key Features",
    [
      ["Real-time Metrics", "Track metrics as events occur"],
      ["Automatic Calculations", "Derived metrics (throughput, hit rate, etc.)"],
      ["Health Scoring", "Automatic system health assessment"],
      ["Color-coded Output", "Visual indicators for quick status check"],
      ["JSON Export", "Get summary data for programmatic use"]
    ],
    chalk.blue
  );

  renderSection("Dashboard Summary Data", chalk.cyan);
  const summary = dashboard.getSummary();
  console.log(chalk.whiteBright(JSON.stringify(summary, null, 2)));

  renderList([
    "✓ Dashboard provides real-time visibility into system operations",
    "✓ Suitable for monitoring production systems",
    "✓ Can be integrated with alerting systems",
    "✓ Minimal performance overhead"
  ], chalk.green);
}

if (require.main === module) {
  runDashboardDemo().catch(console.error);
}

module.exports = { runDashboardDemo };
