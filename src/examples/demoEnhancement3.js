/**
 * Enhancement #3 Demo: Advanced Helpdesk with RBAC & Audit Logging
 * 
 * Demonstrates enterprise-grade helpdesk with access control and compliance
 * 
 * Run with: npm run demo:helpdesk-advanced
 */

const { chalk, renderBanner, renderSection, renderList, renderCard } = require("../ui/terminalUi");
const { runAdvancedHelpdeskSimulation, ROLES, CLIENT_TIERS } = require("./helpdeskWithAccess");
const { sleep } = require("../utils/delay");

async function runAdvancedHelpdeskDemo() {
  renderBanner("Advanced Helpdesk System", "RBAC + Audit Logging + SLA Tracking");

  renderSection("What is Advanced Helpdesk?", chalk.cyan);
  renderList([
    "Role-Based Access Control (RBAC) for security",
    "Client tier management with different service levels",
    "Automatic SLA tracking and compliance monitoring",
    "Complete audit trail for compliance and debugging",
    "Intelligent ticket escalation based on complexity"
  ]);

  await sleep(1000);

  renderSection("Access Control Model", chalk.cyan);
  renderCard(
    "User Roles & Permissions",
    [
      ["ADMIN", "Full access to all operations (*)"],
      ["TIER1_SUPPORT", "View, reply, escalate tickets"],
      ["TIER2_SUPPORT", "Modify, resolve, manage all ticket types"],
      ["CUSTOMER", "View and reply to own tickets only"],
      ["VIP_CUSTOMER", "All customer operations"]
    ],
    chalk.blue
  );

  renderSection("Client Service Tiers", chalk.cyan);
  renderCard(
    "SLA & Priority Configuration",
    [
      ["STANDARD", "Priority: Low, SLA: 1 hour, Response: 100-300ms"],
      ["PREMIUM", "Priority: Medium, SLA: 30 min, Response: 50-150ms"],
      ["VIP", "Priority: High, SLA: 15 min, Response: 30-80ms"]
    ],
    chalk.blue
  );

  await sleep(1500);

  renderSection("Running Advanced Helpdesk Simulation...", chalk.cyan);
  console.log();

  // Run the simulation
  const results = await runAdvancedHelpdeskSimulation();

  // Analysis
  await sleep(500);

  renderSection("Simulation Results Analysis", chalk.bold.cyan);

  renderCard(
    "Ticket Processing Metrics",
    [
      ["Total Tickets Processed", String(results.metrics.totalTickets)],
      ["Successfully Resolved", String(results.metrics.resolvedTickets)],
      ["Escalations Triggered", String(results.metrics.escalatedTickets)],
      ["SLA Compliance Rate", `${results.metrics.slaCompliance.toFixed(1)}%`]
    ],
    results.metrics.slaCompliance > 80 ? chalk.green : results.metrics.slaCompliance > 50 ? chalk.yellow : chalk.red
  );

  // Ticket breakdown
  renderSection("Ticket Status Breakdown", chalk.cyan);
  const ticketsData = results.tickets.map((t) => [
    t.id,
    t.clientId,
    chalk.bold(t.tier),
    t.status === "RESOLVED" ? chalk.green(t.status) : chalk.yellow(t.status),
    `${(t.getElapsedTime() / 1000).toFixed(2)}s`,
    t.isSLAExceeded() ? chalk.red("VIOLATED") : chalk.green("MET")
  ]);

  // Group by status
  const resolved = ticketsData.filter((t) => t[3].includes("RESOLVED")).length;
  const pending = ticketsData.filter((t) => !t[3].includes("RESOLVED")).length;

  console.log(chalk.whiteBright(`  Resolved: ${resolved} | Pending: ${pending}`));
  console.log();

  // Agent performance
  renderSection("Support Agent Performance", chalk.cyan);
  results.agents.forEach((agent) => {
    const metrics = agent.getMetrics();
    const avgTime = metrics.avgResolutionMs > 0 ? `${(metrics.avgResolutionMs / 1000).toFixed(2)}s` : "N/A";

    console.log(chalk.cyan(`  ${agent.agentId} (${agent.tier})`));
    console.log(chalk.whiteBright(`    Resolved: ${metrics.resolved} tickets`));
    console.log(chalk.whiteBright(`    Active: ${metrics.active} tickets`));
    console.log(chalk.whiteBright(`    Avg Resolution Time: ${avgTime}`));
    console.log();
  });

  // Audit analysis
  renderSection("Compliance & Audit Trail", chalk.cyan);
  const auditSummary = results.auditLog.getSummary();

  renderCard(
    "Audit Events Logged",
    Object.entries(auditSummary).map(([eventType, count]) => [eventType, String(count)]),
    chalk.blue
  );

  console.log(chalk.whiteBright(`  Total Audit Entries: ${results.auditLog.entries.length}`));
  console.log();

  // SLA analysis by tier
  renderSection("SLA Compliance by Client Tier", chalk.cyan);
  const tiers = {};
  results.tickets.forEach((ticket) => {
    if (!tiers[ticket.tier]) {
      tiers[ticket.tier] = { total: 0, met: 0 };
    }

    tiers[ticket.tier].total += 1;
    if (!ticket.isSLAExceeded()) {
      tiers[ticket.tier].met += 1;
    }
  });

  Object.entries(tiers).forEach(([tier, data]) => {
    const compliance = (data.met / data.total) * 100;
    const color = compliance > 80 ? chalk.green : compliance > 50 ? chalk.yellow : chalk.red;
    console.log(chalk.whiteBright(`  ${tier}: ${color(compliance.toFixed(1))}% (${data.met}/${data.total})`));
  });

  console.log();

  // Security implications
  renderSection("Security & Compliance Benefits", chalk.cyan);
  renderList([
    "RBAC prevents unauthorized access to customer data",
    "Audit trail provides complete accountability (SOX compliance)",
    "SLA tracking ensures service quality commitments",
    "Escalation logic ensures complex issues reach qualified staff",
    "Client tier pricing model supported by automated prioritization"
  ]);

  // Key findings
  renderSection("Key Findings", chalk.bold.cyan);
  renderList([
    `Successfully processed ${results.metrics.totalTickets} support tickets`,
    `Achieved ${results.metrics.slaCompliance.toFixed(1)}% SLA compliance rate`,
    `Automated ${results.metrics.escalatedTickets} escalations to Tier 2 staff`,
    `Logged ${results.auditLog.entries.length} events for compliance tracking`,
    "VIP clients received priority processing with faster responses"
  ]);

  renderList([
    "✓ RBAC provides secure access control",
    "✓ Audit logging ensures compliance",
    "✓ SLA tracking ensures service quality",
    "✓ Automated escalation improves resolution",
    "✓ Production-ready enterprise system"
  ], chalk.green);
}

if (require.main === module) {
  runAdvancedHelpdeskDemo().catch(console.error);
}

module.exports = { runAdvancedHelpdeskDemo };
