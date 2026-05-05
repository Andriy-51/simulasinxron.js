# Quick Start Guide: Coursework Enhancements

## Overview

This guide will help you quickly get started with the production-style CLI dashboard, outputs folder, and the major enhancements in the simulasinxron.js project.

---

## Installation & Setup

```bash
cd simulasinxron.js
npm install
```

## Running the Demos

### See All Enhancements at Once

```bash
npm start
```

This opens the centralized CLI dashboard so you can choose a scenario and tune its parameters before launch.

If you want the older one-shot integration demo, run:

```bash
npm run demo:full-integration
```

---

### Individual Enhancement Demos

#### Enhancement 1: Dashboard Metrics
```bash
npm run demo:dashboard
```

**What it shows:**
- Real-time queue monitoring (size, throughput, latency)
- Cache performance tracking (hit rate, evictions)
- Iterator processing metrics
- System health scoring

**Key Output:**
- Live dashboard with all metrics
- Color-coded health status
- Summary statistics
- Reports and snapshots saved to `outputs/`

---

#### Enhancement 2: Chaos Engineering
```bash
npm run demo:chaos
```

**What it shows:**
- Server failure simulation
- Progressive degradation of server health
- Automatic failover to healthy servers
- Recovery and restoration process

**Key Output:**
- Server status table (health, online status, success rate)
- Chaos metrics (success rate, outages, recoveries)
- System resilience analysis
- Outputs saved to `outputs/`

---

#### Enhancement 3: Advanced Helpdesk
```bash
npm run demo:helpdesk-advanced
```

**What it shows:**
- Role-Based Access Control (RBAC)
- Client tier management (STANDARD, PREMIUM, VIP)
- SLA tracking and compliance
- Audit logging of all operations

**Key Output:**
- Ticket processing results
- Support agent performance
- Audit trail summary
- SLA compliance by tier
- Helpdesk report saved to `outputs/helpdesk-report.json`

---

#### Enhancement 4: Analytics Reports
```bash
npm run demo:analytics
```

**What it shows:**
- Performance metrics comparison
- Cache efficiency analysis
- Throughput analysis
- Report generation (JSON, HTML, CSV)

**Key Output:**
- Formatted performance report
- Before/after comparison tables
- Improvement percentages
- Generated report files in `reports/` directory
- Generated report files in `outputs/` directory

#### Stress Test Mode
```bash
npm run stress-test
```

**What it shows:**
- Peak-load request generation
- Fault injection and random failures
- Timeout threshold for the iterator consumer

**Key Output:**
- Stress report with processed count, failures, and backlog
- JSON report in `outputs/stress-test-report.json`

---

## Using in Your Own Code

### Example 1: Add Dashboard to Existing Simulation

```javascript
const { DashboardMetrics } = require('./src/system/dashboardMetrics');

// Create dashboard
const dashboard = new DashboardMetrics("My Simulation");

// Track events
dashboard.trackQueueSize(queue.length);
dashboard.trackProcessingTime(responseTime);
dashboard.trackCacheHit(); // or trackCacheMiss()

// Display results
dashboard.renderFullDashboard();

// Get programmatic data
const summary = dashboard.getSummary();
```

---

### Example 2: Run Chaos Testing

```javascript
const { ChaosScenarioRunner } = require('./src/chaos/chaosScenario');

// Create scenario
const chaos = new ChaosScenarioRunner(3); // 3 servers

// Send requests in phases
await chaos.sendBatch(50, "baseline");
chaos.renderServerStatus();

// Trigger degradation
await chaos.triggerServerDegradation(1, 3, 0.8);

// Send more requests during degradation
await chaos.sendBatch(50, "under-stress");

// Trigger recovery
await chaos.triggerServerRecovery(1, 2, 0.6);

// Get results
const results = chaos.getSummary();
```

---

### Example 3: Advanced Helpdesk Simulation

```javascript
const { runAdvancedHelpdeskSimulation } = require('./src/examples/helpdeskWithAccess');

// Run simulation
const results = await runAdvancedHelpdeskSimulation();

// Access results
console.log(`SLA Compliance: ${results.metrics.slaCompliance}%`);
console.log(`Total Escalations: ${results.metrics.escalatedTickets}`);
console.log(`Audit Events: ${results.auditLog.entries.length}`);

// Query audit log
const userActions = results.auditLog.getEntriesByUser('T1-AGENT-1');
const ticketHistory = results.auditLog.getEntriesByTicket('TKT-1000');
```

---

### Example 4: Generate Performance Report

```javascript
const { ReportGenerator, CacheEfficiencyAnalyzer } = require('./src/system/reportGenerator');

// Create report
const report = new ReportGenerator({ outputDir: 'reports' });

// Add sections
report.addMetrics('Baseline', {
  'Requests': 1000,
  'Response Time (ms)': 150
});

report.addComparison(
  'Cache Impact',
  'Without Cache',
  { avgTime: 150, throughput: 10 },
  'With Cache',
  { avgTime: 50, throughput: 30 }
);

report.addAnalysis(
  'Findings',
  'Summary of results',
  ['Cache improved throughput by 200%', 'Response time reduced by 66%']
);

// Export
await report.save(); // Creates JSON, HTML, CSV files in outputs/
report.render();     // Display in terminal
```

---

## File Locations

### New Core Modules
- `src/system/dashboardMetrics.js` - Dashboard metrics tracking
- `src/system/reportGenerator.js` - Report generation and analysis
- `src/stress/stressTestMode.js` - Stress test workload analysis
- `src/chaos/chaosScenario.js` - Chaos engineering scenarios

### New Examples/Demos
- `src/examples/helpdeskWithAccess.js` - Advanced helpdesk simulation
- `src/examples/fullIntegrationDemo.js` - Complete integration demo
- `src/examples/demoEnhancement1.js` - Dashboard demo
- `src/examples/demoEnhancement2.js` - Chaos engineering demo
- `src/examples/demoEnhancement3.js` - Helpdesk demo
- `src/examples/demoEnhancement4.js` - Analytics demo

### Documentation
- `ENHANCEMENTS.md` - Detailed technical documentation
- `QUICKSTART.md` - This file

---

## API Reference

### DashboardMetrics

```javascript
class DashboardMetrics {
  // Queue
  trackQueueSize(size)
  trackQueueProcessed(count)
  trackProcessingTime(ms)
  
  // Cache
  trackCacheHit()
  trackCacheMiss()
  trackCacheEviction()
  getCacheHitRate()
  
  // Iterators
  trackIteratorStart()
  trackIteratorComplete()
  trackIteratorTimeout()
  
  // Health
  recordError(error)
  recordWarning(warning)
  
  // Results
  getSummary()
  renderFullDashboard()
  renderQueueMetrics()
  renderCacheMetrics()
}
```

### ChaosScenarioRunner

```javascript
class ChaosScenarioRunner {
  constructor(serverCount)
  async sendBatch(batchSize, label)
  async triggerServerDegradation(serverId, durationSeconds, degradationRate)
  async triggerServerRecovery(serverId, durationSeconds, recoveryRate)
  renderServerStatus()
  getSummary()
}
```

### ReportGenerator

```javascript
class ReportGenerator {
  constructor(options)
  addMetrics(title, data)
  addComparison(title, label1, data1, label2, data2)
  addAnalysis(title, description, findings)
  async save()
  render()
  toJSON()
  toHTML()
  toCSV()
}
```

---

## Common Tasks

### Monitor a Queue Simulation

```javascript
const { DashboardMetrics } = require('./src/system/dashboardMetrics');

const dashboard = new DashboardMetrics("Queue Monitor");

// In your simulation loop:
dashboard.trackQueueSize(queue.size);
dashboard.trackProcessingTime(processingMs);

// Every N iterations:
dashboard.renderFullDashboard();
```

### Compare Cache Performance

```javascript
// Run without cache
const resultsWithout = await runSimulationWithoutCache();

// Run with cache
const resultsWith = await runSimulationWithCache();

// Compare
const report = new ReportGenerator();
report.addComparison(
  'Cache Efficiency',
  'Without Cache',
  resultsWithout,
  'With Cache',
  resultsWith
);
report.render();
```

### Test System Resilience

```javascript
const chaos = new ChaosScenarioRunner(3);

// Baseline
const baseline = await chaos.sendBatch(100);
console.log(`Baseline success: ${baseline.ok ? 'PASS' : 'FAIL'}`);

// Under failure
await chaos.triggerServerDegradation(1, 5, 0.9);
const underStress = await chaos.sendBatch(100);
console.log(`Under stress success rate: ${underStress.length}`);
```

### Track Support Ticket SLA

```javascript
const { runAdvancedHelpdeskSimulation } = require('./src/examples/helpdeskWithAccess');

const results = await runAdvancedHelpdeskSimulation();

// Check compliance
if (results.metrics.slaCompliance > 95) {
  console.log("Excellent SLA compliance!");
} else if (results.metrics.slaCompliance > 80) {
  console.log("Good SLA compliance");
} else {
  console.log("SLA issues detected - escalations needed");
}
```

---

## Troubleshooting

### Report Not Generating

```bash
# Check if reports directory exists
ls -la reports/

# If not, create it:
mkdir -p reports

# Run again
npm run demo:analytics
```

### Module Not Found Error

```bash
# Reinstall dependencies
npm install

# Check file paths in the error message
# Ensure you're running from the project root:
cd simulasinxron.js/
npm run demo:full-integration
```

### Dashboard Not Rendering Colors

The dashboard requires `chalk` for colors. Install it:

```bash
npm install chalk
```

---

## Next Steps

1. **Read the Full Documentation:** See `ENHANCEMENTS.md` for detailed technical information
2. **Explore the Code:** Check the module files to understand implementation details
3. **Integrate into Your Project:** Use individual modules in your own simulations
4. **Customize:** Modify the modules to fit your specific use cases
5. **Generate Reports:** Use analytics module to analyze your simulation results

---

## Support

For detailed documentation, see:
- `ENHANCEMENTS.md` - Full technical documentation
- Source code in `src/` with detailed comments
- Example code in `src/examples/`

---

## License

MIT - See LICENSE file for details
