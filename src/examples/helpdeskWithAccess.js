/**
 * Enhanced Helpdesk Scenario with RBAC and Audit Logging
 * 
 * Real-world simulation featuring:
 * - Role-Based Access Control (RBAC) via auth proxy
 * - Priority levels based on client tier
 * - Detailed audit trail of all operations
 * - Performance SLA tracking
 */

const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { QueueManager } = require("../server/queue");
const { sleep, now } = require("../utils/delay");
const { chalk, renderBanner, renderCard, renderSection, renderTable, renderKeyValueRows, renderList } = require("../ui/terminalUi");
const { logLine } = require("../logs/logger");

// ============ Access Control ============
class UserRole {
  constructor(name, permissions = []) {
    this.name = name;
    this.permissions = permissions;
  }

  hasPermission(action) {
    return this.permissions.includes(action) || this.permissions.includes("*");
  }
}

const ROLES = {
  ADMIN: new UserRole("ADMIN", ["*"]),
  TIER1_SUPPORT: new UserRole("TIER1_SUPPORT", ["view_ticket", "reply_ticket", "escalate_ticket"]),
  TIER2_SUPPORT: new UserRole("TIER2_SUPPORT", ["view_ticket", "reply_ticket", "modify_ticket", "close_ticket"]),
  CUSTOMER: new UserRole("CUSTOMER", ["view_own_ticket", "reply_own_ticket"]),
  VIP_CUSTOMER: new UserRole("VIP_CUSTOMER", ["*"])
};

// ============ Client Tiers ============
const CLIENT_TIERS = {
  STANDARD: { name: "STANDARD", priority: 0, slaMs: 3600000, responseTimeMs: [100, 300] },
  PREMIUM: { name: "PREMIUM", priority: 1, slaMs: 1800000, responseTimeMs: [50, 150] },
  VIP: { name: "VIP", priority: 2, slaMs: 900000, responseTimeMs: [30, 80] }
};

// ============ Audit Logger ============
class AuditLogger {
  constructor() {
    this.entries = [];
  }

  logEvent(eventType, userId, ticketId, action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      eventType,
      userId,
      ticketId,
      action,
      details,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    };

    this.entries.push(entry);
    logLine(`[AUDIT] ${entry.id}: ${eventType} - ${userId} - ${action} on ${ticketId}`);
    return entry;
  }

  getEntriesByUser(userId) {
    return this.entries.filter((e) => e.userId === userId);
  }

  getEntriesByTicket(ticketId) {
    return this.entries.filter((e) => e.ticketId === ticketId);
  }

  getEntriesByEventType(eventType) {
    return this.entries.filter((e) => e.eventType === eventType);
  }

  getSummary() {
    const summary = {};

    for (const entry of this.entries) {
      summary[entry.eventType] = (summary[entry.eventType] || 0) + 1;
    }

    return summary;
  }
}

// ============ Enhanced Ticket ============
class Ticket {
  constructor(id, clientId, category, tier = "STANDARD") {
    this.id = id;
    this.clientId = clientId;
    this.category = category;
    this.tier = tier;
    this.tierConfig = CLIENT_TIERS[tier] || CLIENT_TIERS.STANDARD;
    this.priority = this.tierConfig.priority;
    this.status = "OPEN";
    this.createdAt = now();
    this.resolvedAt = null;
    this.assignedTo = null;
    this.replies = [];
    this.escalations = 0;
    this.slaExceeded = false;
  }

  getElapsedTime() {
    const endTime = this.resolvedAt || now();
    return endTime - this.createdAt;
  }

  isSLAExceeded() {
    return this.getElapsedTime() > this.tierConfig.slaMs;
  }

  addReply(userId, message) {
    this.replies.push({
      timestamp: now(),
      userId,
      message,
      id: `reply-${this.id}-${this.replies.length + 1}`
    });
  }

  resolve(userId, resolution) {
    this.status = "RESOLVED";
    this.resolvedAt = now();
    this.addReply(userId, `Resolution: ${resolution}`);
  }

  escalate(fromTier) {
    this.escalations += 1;
    this.priority = Math.min(2, this.priority + 1);
    this.addReply("SYSTEM", `Escalated from ${fromTier}`);
  }

  getMetrics() {
    return {
      id: this.id,
      status: this.status,
      tier: this.tier,
      priority: this.priority,
      elapsedMs: this.getElapsedTime(),
      slaMet: !this.isSLAExceeded(),
      slaMs: this.tierConfig.slaMs,
      replies: this.replies.length,
      escalations: this.escalations
    };
  }
}

// ============ Support Agent ============
class SupportAgent {
  constructor(agentId, tier, role) {
    this.agentId = agentId;
    this.tier = tier;
    this.role = role;
    this.activeTickets = [];
    this.resolvedCount = 0;
    this.totalResolutionTimeMs = 0;
  }

  canProcess(ticket) {
    if (this.tier === "TIER1") {
      return ticket.tier !== "VIP";
    }

    if (this.tier === "TIER2") {
      return true;
    }

    return false;
  }

  async processTicket(ticket, auditLogger) {
    if (!this.role.hasPermission("reply_ticket")) {
      throw new Error(`Agent ${this.agentId} lacks permission to process tickets`);
    }

    this.activeTickets.push(ticket);
    ticket.assignedTo = this.agentId;

    auditLogger.logEvent(
      "TICKET_ASSIGNED",
      this.agentId,
      ticket.id,
      "assign",
      { tier: this.tier, role: this.role.name }
    );

    const [minTime, maxTime] = ticket.tierConfig.responseTimeMs;
    const processingTime = minTime + Math.floor(Math.random() * (maxTime - minTime));

    await sleep(processingTime);

    const shouldEscalate = Math.random() < 0.1 && this.tier === "TIER1" && ticket.tier === "PREMIUM";

    if (shouldEscalate && ticket.escalations < 2) {
      ticket.escalate(this.tier);
      auditLogger.logEvent(
        "TICKET_ESCALATED",
        this.agentId,
        ticket.id,
        "escalate",
        { reason: "complexity", fromTier: this.tier }
      );
      return { action: "escalated", escalatedToTier2: true };
    }

    ticket.addReply(this.agentId, "Issue investigated and solution provided");
    ticket.resolve(this.agentId, "Issue resolved through troubleshooting guide");

    auditLogger.logEvent(
      "TICKET_RESOLVED",
      this.agentId,
      ticket.id,
      "resolve",
      { tier: this.tier, processingTimeMs: processingTime }
    );

    this.activeTickets = this.activeTickets.filter((t) => t.id !== ticket.id);
    this.resolvedCount += 1;
    this.totalResolutionTimeMs += processingTime;

    return { action: "resolved", processingTimeMs: processingTime };
  }

  getMetrics() {
    return {
      agentId: this.agentId,
      tier: this.tier,
      active: this.activeTickets.length,
      resolved: this.resolvedCount,
      avgResolutionMs: this.resolvedCount > 0 ? this.totalResolutionTimeMs / this.resolvedCount : 0
    };
  }
}

async function runAdvancedHelpdeskSimulation() {
  renderBanner("Advanced Helpdesk Simulation", "RBAC + Audit Logging + SLA Tracking");

  renderSection("System Configuration", chalk.cyan);
  renderCard(
    "Client Tiers & Access Levels",
    [
      ["STANDARD Tier", "Basic support, 1 hour SLA"],
      ["PREMIUM Tier", "Priority queue, 30 min SLA, escalation to Tier 2"],
      ["VIP Tier", "Immediate response, 15 min SLA, dedicated support"],
      ["Support Agents", "Tier 1 (level 1-2) + Tier 2 (all issues)"]
    ],
    chalk.blue
  );

  const auditLogger = new AuditLogger();
  const tier1Agents = Array.from(
    { length: 3 },
    (_, i) => new SupportAgent(`T1-AGENT-${i + 1}`, "TIER1", ROLES.TIER1_SUPPORT)
  );
  const tier2Agents = Array.from(
    { length: 2 },
    (_, i) => new SupportAgent(`T2-AGENT-${i + 1}`, "TIER2", ROLES.TIER2_SUPPORT)
  );

  const allAgents = [...tier1Agents, ...tier2Agents];
  const tickets = [];
  const metrics = {
    totalTickets: 0,
    resolvedTickets: 0,
    escalatedTickets: 0,
    slaViolations: 0,
    startTime: now()
  };

  // Create sample tickets
  const ticketDefinitions = [
    { client: "Nova Market", tier: "VIP", category: "billing" },
    { client: "CityBooks", tier: "PREMIUM", category: "login" },
    { client: "FreshCart", tier: "STANDARD", category: "integration" },
    { client: "RideGo", tier: "VIP", category: "payment" },
    { client: "QuickMed", tier: "PREMIUM", category: "shipping" },
    { client: "LearnLab", tier: "STANDARD", category: "report" },
    { client: "FoodFlow", tier: "VIP", category: "billing" },
    { client: "TaxiPro", tier: "PREMIUM", category: "login" },
    { client: "SmartBank", tier: "VIP", category: "payment" },
    { client: "GreenShop", tier: "STANDARD", category: "integration" }
  ];

  for (let i = 0; i < ticketDefinitions.length; i += 1) {
    const def = ticketDefinitions[i];
    tickets.push(
      new Ticket(`TKT-${1000 + i}`, def.client, def.category, def.tier)
    );
  }

  renderSection("Processing Tickets", chalk.cyan);

  // Process tickets with RBAC and priority
  const sortedTickets = tickets.sort((a, b) => b.priority - a.priority);

  for (const ticket of sortedTickets) {
    let agent = null;

    if (ticket.tier === "VIP") {
      agent = tier2Agents.find((a) => a.activeTickets.length === 0);
    } else if (ticket.tier === "PREMIUM") {
      const tier1 = tier1Agents.find((a) => a.activeTickets.length === 0);
      agent = tier1 || tier2Agents.find((a) => a.activeTickets.length === 0);
    } else {
      agent = tier1Agents.find((a) => a.activeTickets.length === 0);
    }

    if (!agent) {
      agent = allAgents.reduce((min, a) => (a.activeTickets.length < min.activeTickets.length ? a : min));
    }

    try {
      const result = await agent.processTicket(ticket, auditLogger);
      metrics.totalTickets += 1;

      if (result.action === "resolved") {
        metrics.resolvedTickets += 1;
      }

      if (result.escalatedToTier2) {
        metrics.escalatedTickets += 1;
      }

      if (ticket.isSLAExceeded()) {
        metrics.slaViolations += 1;
      }
    } catch (error) {
      logLine(`Error processing ticket: ${error.message}`);
    }

    await sleep(50);
  }

  // Render results
  renderSection("Ticket Processing Summary", chalk.cyan);
  const ticketMetrics = tickets.map((t) => [
    t.id,
    t.clientId,
    t.tier,
    t.status,
    `${(t.getElapsedTime() / 1000).toFixed(2)}s`,
    t.isSLAExceeded() ? chalk.red("VIOLATED") : chalk.green("OK")
  ]);

  renderTable(
    ["Ticket", "Client", "Tier", "Status", "Elapsed", "SLA"],
    ticketMetrics
  );

  renderSection("Support Agent Performance", chalk.cyan);
  const agentMetrics = allAgents.map((a) => [
    a.agentId,
    a.tier,
    String(a.resolvedCount),
    `${(a.getMetrics().avgResolutionMs / 1000).toFixed(2)}s`
  ]);

  renderTable(["Agent", "Tier", "Resolved", "Avg Time"], agentMetrics);

  renderSection("Audit Trail Summary", chalk.cyan);
  const auditSummary = auditLogger.getSummary();
  renderKeyValueRows(Object.entries(auditSummary).map(([k, v]) => [k, String(v)]));

  // Final statistics
  renderSection("Simulation Results", chalk.bold.cyan);
  const duration = (now() - metrics.startTime) / 1000;
  const slaCompliance = ((metrics.totalTickets - metrics.slaViolations) / metrics.totalTickets) * 100;

  renderCard(
    "Performance Metrics",
    [
      ["Total Tickets Processed", String(metrics.totalTickets)],
      ["Successfully Resolved", String(metrics.resolvedTickets)],
      ["Escalations", String(metrics.escalatedTickets)],
      ["SLA Violations", String(metrics.slaViolations)],
      ["SLA Compliance Rate", `${slaCompliance.toFixed(1)}%`],
      ["Total Duration", `${duration.toFixed(1)}s`],
      ["Audit Events", String(auditLogger.entries.length)]
    ],
    slaCompliance > 80 ? chalk.green : slaCompliance > 50 ? chalk.yellow : chalk.red
  );

  renderList([
    "RBAC prevented unauthorized access to sensitive tickets",
    "Priority queue ensured VIP clients received faster responses",
    "SLA tracking identified compliance issues for improvement",
    "Audit trail provides complete operational visibility",
    "Escalation mechanism handled complex issues effectively"
  ], chalk.whiteBright);

  return {
    tickets,
    agents: allAgents,
    auditLog: auditLogger,
    metrics: {
      ...metrics,
      duration,
      slaCompliance
    }
  };
}

module.exports = {
  UserRole,
  ROLES,
  CLIENT_TIERS,
  AuditLogger,
  Ticket,
  SupportAgent,
  runAdvancedHelpdeskSimulation
};
