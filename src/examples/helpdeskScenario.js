const fs = require("fs/promises");
const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { QueueManager } = require("../server/queue");
const { createAuthProxy, createFakeApiService } = require("../proxy/authProxy");
const { createLogSink, createLoggingDecorator } = require("../decorators/loggingDecorator");
const { sleep, now } = require("../utils/delay");
const { chalk, colorForPriority, renderBanner, renderCard, renderSection, renderTable, renderKeyValueRows, renderList } = require("../ui/terminalUi");

const CASE_TICKETS = [
  { id: "HD-1001", client: "Nova Market", category: "billing", priority: 1, estimatedSlaMs: 900 },
  { id: "HD-1002", client: "CityBooks", category: "login", priority: 0, estimatedSlaMs: 1400 },
  { id: "HD-1003", client: "FreshCart", category: "integration", priority: 1, estimatedSlaMs: 1200 },
  { id: "HD-1004", client: "RideGo", category: "report", priority: 0, estimatedSlaMs: 1800 },
  { id: "HD-1005", client: "QuickMed", category: "payment", priority: 1, estimatedSlaMs: 1000 },
  { id: "HD-1006", client: "LearnLab", category: "login", priority: 0, estimatedSlaMs: 1500 },
  { id: "HD-1007", client: "FoodFlow", category: "shipping", priority: 1, estimatedSlaMs: 1300 },
  { id: "HD-1008", client: "TaxiPro", category: "integration", priority: 0, estimatedSlaMs: 1700 },
  { id: "HD-1009", client: "SmartBank", category: "payment", priority: 1, estimatedSlaMs: 1100 },
  { id: "HD-1010", client: "GreenShop", category: "report", priority: 0, estimatedSlaMs: 1900 }
];

const CATEGORY_BASE_MS = {
  login: 120,
  billing: 220,
  payment: 200,
  shipping: 180,
  integration: 280,
  report: 260
};

const ACTION_ACCESS = {
  view: "standard",
  reply: "premium",
  close: "admin"
};

const HELPDESK_AGENTS = [
  {
    id: "AG-01",
    name: "Marta",
    accessLevel: "standard",
    allowedActions: ["view"],
    priorityOffset: 0
  },
  {
    id: "AG-02",
    name: "Ihor",
    accessLevel: "premium",
    allowedActions: ["view", "reply"],
    priorityOffset: 1
  },
  {
    id: "AG-03",
    name: "Olena",
    accessLevel: "admin",
    allowedActions: ["view", "reply", "close"],
    priorityOffset: 2
  }
];

function getProcessingTime(ticket) {
  const base = CATEGORY_BASE_MS[ticket.category] || 180;
  const priorityBoost = ticket.priority > 0 ? -30 : 0;
  const variation = Math.floor(Math.random() * 90);
  return Math.max(90, base + priorityBoost + variation);
}

function createAgentServices() {
  const service = createFakeApiService("helpdesk-api");
  return HELPDESK_AGENTS.map((agent) => {
    const proxy = createAuthProxy(service, {
      strategy: { type: "api-key", apiKey: `${agent.id.toLowerCase()}-key` },
      accessLevel: agent.accessLevel,
      allowedActions: agent.allowedActions,
      rateLimit: 4,
      rateWindowMs: 500,
      verbose: false
    });

    return {
      ...agent,
      proxy,
      runAction: null
    };
  });
}

function createTicketActionRunner(agent, auditSink) {
  return createLoggingDecorator(
    async ({ ticket, action, details = {} }) => {
      await sleep(getProcessingTime(ticket) + (agent.priorityOffset * 15));
      return agent.proxy.request({
        path: `/tickets/${ticket.id}/${action}`,
        method: action === "view" ? "GET" : "POST",
        action,
        resource: ticket.id,
        requiredAccessLevel: ACTION_ACCESS[action],
        payload: {
          ticketId: ticket.id,
          client: ticket.client,
          category: ticket.category,
          agentId: agent.id,
          ...details
        }
      });
    },
    {
      name: `helpdesk:${agent.id}`,
      destination: "memory",
      sink: auditSink,
      includeArgs: true,
      includeResult: true,
      includeTiming: true
    }
  );
}

function printHeader() {
  renderBanner("Helpdesk case study", "Priority queue + auth proxy + audit trail");
}

function printTickets() {
  renderSection("Incoming tickets", chalk.cyan);
  renderTable(
    ["Ticket", "Client", "Type", "Priority", "SLA"],
    CASE_TICKETS.map((ticket) => [
      ticket.id,
      ticket.client,
      ticket.category,
      ticket.priority > 0 ? "URGENT" : "STD",
      `${ticket.estimatedSlaMs} ms`
    ])
  );
}

function chooseAgentForTicket(ticket) {
  if (ticket.priority > 0) {
    return HELPDESK_AGENTS[1];
  }

  return HELPDESK_AGENTS[0];
}

async function processTicket(ticket, agents, auditSink, accessDenials, actionLog) {
  const actions = ["view", "reply", "close"];
  let assignedIndex = ticket.priority > 0 ? 1 : 0;

  for (const action of actions) {
    let performed = false;

    for (let index = assignedIndex; index < agents.length; index += 1) {
      const agent = agents[index];
      if (!agent.runAction) {
        agent.runAction = createTicketActionRunner(agent, auditSink);
      }

      try {
        const response = await agent.runAction({
          ticket,
          action,
          details: {
            state: action === "close" ? "resolved" : action,
            assignedBy: agent.name
          }
        });

        actionLog.push({
          ticketId: ticket.id,
          action,
          agent: agent.name,
          status: "allowed",
          level: agent.accessLevel,
          path: response.path
        });
        assignedIndex = index;
        performed = true;
        break;
      } catch (error) {
        const denied = String(error.message || "").includes("access denied");
        actionLog.push({
          ticketId: ticket.id,
          action,
          agent: agent.name,
          status: denied ? "denied" : "failed",
          level: agent.accessLevel,
          error: error.message
        });

        if (denied) {
          accessDenials.push({ ticketId: ticket.id, action, agent: agent.name, reason: error.message });
          continue;
        }

        throw error;
      }
    }

    if (!performed) {
      actionLog.push({
        ticketId: ticket.id,
        action,
        agent: "none",
        status: "blocked"
      });
      break;
    }
  }
}

async function runHelpdeskCaseStudy() {
  printHeader();
  printTickets();

  renderCard(
    "Case details",
    [
      ["Domain", "Support operations"],
      ["Queue type", "Priority + FIFO fallback"],
      ["Workers", "3 concurrent handlers"],
      ["Access control", "Auth proxy enforces per-action clearance"],
      ["Audit", "Logging decorator captures each user action"]
    ],
    chalk.blue
  );

  const auditSink = createLogSink("memory");
  const actionLog = [];
  const accessDenials = [];
  const agents = createAgentServices();
  const channel = createReactiveChannel();
  const manager = new QueueManager({
    concurrency: 3,
    totalRequests: CASE_TICKETS.length,
    processRequest: async (ticket) => {
      const startedAt = now();
      await processTicket(ticket, agents, auditSink, accessDenials, actionLog);
      return now() - startedAt;
    }
  });

  channel.on("request", (ticket) => {
    manager.enqueue(ticket);
  });

  for (const ticket of CASE_TICKETS) {
    channel.emit("request", {
      sequence: ticket.id,
      clientId: ticket.client,
      category: ticket.category,
      priority: ticket.priority,
      estimatedSlaMs: ticket.estimatedSlaMs,
      arrivedAt: now(),
      client: ticket.client,
      ticketId: ticket.id
    });

    await sleep(30 + Math.floor(Math.random() * 70));
  }

  await manager.waitForDone();

  const metrics = manager.summary();
  const breaches = manager.metrics.filter((item) => {
    const ticket = CASE_TICKETS.find((entry) => entry.id === item.sequence);
    const totalSpent = item.waitingTimeMs + item.processingTimeMs;
    return ticket ? totalSpent > ticket.estimatedSlaMs : false;
  });
  const actionCounts = actionLog.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});

  renderSection("Helpdesk metrics", chalk.green);
  renderKeyValueRows([
    ["Processed tickets", String(metrics.processed), chalk.whiteBright],
    ["Urgent tickets", String(metrics.vipProcessed), chalk.whiteBright],
    ["Average wait", `${metrics.avgWaitingMs.toFixed(2)} ms`, chalk.whiteBright],
    ["Average processing", `${metrics.avgProcessingMs.toFixed(2)} ms`, chalk.whiteBright],
    ["Peak queue size", String(metrics.peakQueueSize), chalk.whiteBright],
    ["Access denials", String(accessDenials.length), accessDenials.length === 0 ? chalk.greenBright : chalk.yellowBright],
    ["SLA breaches", String(breaches.length), breaches.length === 0 ? chalk.greenBright : chalk.redBright]
  ]);

  renderSection("Access routing", chalk.cyan);
  renderList(
    [
      "Standard agents can view tickets.",
      "Premium agents can reply and handle urgent queues.",
      "Admin agents can close tickets when escalation is needed."
    ],
    chalk.whiteBright
  );

  renderSection("Action summary", chalk.magenta);
  renderTable(
    ["Status", "Count"],
    Object.entries(actionCounts).map(([status, count]) => [status, String(count)])
  );

  if (accessDenials.length > 0) {
    renderSection("Access denials", chalk.red);
    renderTable(
      ["Ticket", "Action", "Agent", "Reason"],
      accessDenials.slice(0, 6).map((entry) => [entry.ticketId, entry.action, entry.agent, entry.reason])
    );
  }

  renderSection("Audit trail", chalk.blue);
  renderTable(
    ["Agent", "Action", "Status", "Path"],
    actionLog.slice(0, 8).map((entry) => [entry.agent, entry.action, entry.status, entry.path || entry.error || "-"])
  );

  renderCard(
    "Audit totals",
    [
      ["Logged events", String(auditSink.entries.length)],
      ["Allowed operations", String(actionCounts.allowed || 0)],
      ["Denied operations", String(actionCounts.denied || 0)],
      ["Blocked operations", String(actionCounts.blocked || 0)]
    ],
    chalk.green
  );

  const reportDir = path.resolve(process.cwd(), "outputs");
  const reportPath = path.join(reportDir, "helpdesk-report.json");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    reportPath,
    `${JSON.stringify({ metrics, breaches, accessDenials, actionCounts, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8"
  );

  renderCard(
    "Exported report",
    [
      ["File", reportPath],
      ["Audit entries", String(auditSink.entries.length)],
      ["Access denials", String(accessDenials.length)]
    ],
    chalk.blue
  );

  if (breaches.length > 0) {
    renderSection("Breached tickets", chalk.red);
    renderList(breaches.map((ticket) => `${ticket.sequence}`), chalk.redBright);
  } else {
    console.log(chalk.greenBright("All tickets were handled within the SLA window."));
  }

  return {
    metrics,
    breaches,
    accessDenials,
    auditEntries: auditSink.entries,
    actionLog
  };
}

module.exports = { runHelpdeskCaseStudy };

if (require.main === module) {
  runHelpdeskCaseStudy().catch((error) => {
    console.error("Helpdesk case study failed:", error);
    process.exitCode = 1;
  });
}
