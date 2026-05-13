const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { QueueManager } = require("../server/queue");
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

function getProcessingTime(ticket) {
  const base = CATEGORY_BASE_MS[ticket.category] || 180;
  const priorityBoost = ticket.priority > 0 ? -30 : 0;
  const variation = Math.floor(Math.random() * 90);
  return Math.max(90, base + priorityBoost + variation);
}

async function processTicket(ticket) {
  const processingTimeMs = getProcessingTime(ticket);
  await sleep(processingTimeMs);
  return processingTimeMs;
}

function printHeader() {
  renderBanner("Helpdesk case study", "E-commerce support queue during peak hours");
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

async function runHelpdeskCaseStudy() {
  printHeader();
  printTickets();

  renderCard(
    "Case details",
    [
      ["Domain", "Support operations"],
      ["Queue type", "Priority + FIFO fallback"],
      ["Workers", "3 concurrent handlers"],
      ["Goal", "Handle urgent tickets first and stay within SLA"]
    ],
    chalk.blue
  );

  const channel = createReactiveChannel();
  const manager = new QueueManager({
    concurrency: 3,
    totalRequests: CASE_TICKETS.length,
    processRequest: processTicket
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
      arrivedAt: now()
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

  renderSection("Helpdesk metrics", chalk.green);
  renderKeyValueRows([
    ["Processed tickets", String(metrics.processed), chalk.whiteBright],
    ["Urgent tickets", String(metrics.vipProcessed), chalk.whiteBright],
    ["Average wait", `${metrics.avgWaitingMs.toFixed(2)} ms`, chalk.whiteBright],
    ["Average processing", `${metrics.avgProcessingMs.toFixed(2)} ms`, chalk.whiteBright],
    ["Peak queue size", String(metrics.peakQueueSize), chalk.whiteBright],
    ["SLA breaches", String(breaches.length), breaches.length === 0 ? chalk.greenBright : chalk.redBright]
  ]);

  if (breaches.length > 0) {
    renderSection("Breached tickets", chalk.red);
    renderList(breaches.map((ticket) => `${ticket.sequence}`), chalk.redBright);
  } else {
    console.log(chalk.greenBright("All tickets were handled within the SLA window."));
  }
}

module.exports = { runHelpdeskCaseStudy };

if (require.main === module) {
  runHelpdeskCaseStudy().catch((error) => {
    console.error("Helpdesk case study failed:", error);
    process.exitCode = 1;
  });
}
