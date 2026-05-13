const { createReactiveChannel } = require("../reactive/reactiveCommunication");
const { QueueManager } = require("../server/queue");
const { logLine } = require("../logs/logger");
const { sleep, now } = require("../utils/delay");

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
  console.log("\n=====================================");
  console.log("=== Helpdesk case study scenario ===");
  console.log("=====================================");
  console.log("Realistic case: support queue for an e-commerce platform during peak hours");
}

function printTickets() {
  console.log("Incoming tickets:");
  for (const ticket of CASE_TICKETS) {
    const tag = ticket.priority > 0 ? "URGENT" : "STD";
    console.log(`- ${ticket.id} | ${ticket.client} | ${ticket.category} | ${tag} | SLA ${ticket.estimatedSlaMs} ms`);
  }
}

async function runHelpdeskCaseStudy() {
  printHeader();
  printTickets();

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

  console.log("\n=== Helpdesk metrics ===");
  console.log(`Processed tickets   : ${metrics.processed}`);
  console.log(`Urgent tickets      : ${metrics.vipProcessed}`);
  console.log(`Average wait        : ${metrics.avgWaitingMs.toFixed(2)} ms`);
  console.log(`Average processing  : ${metrics.avgProcessingMs.toFixed(2)} ms`);
  console.log(`Peak queue size     : ${metrics.peakQueueSize}`);
  console.log(`SLA breaches        : ${breaches.length}`);

  if (breaches.length > 0) {
    console.log("Breached tickets:");
    for (const ticket of breaches) {
      console.log(`- ${ticket.sequence}`);
    }
  } else {
    console.log("All tickets were handled within the SLA window.");
  }
}

module.exports = { runHelpdeskCaseStudy };

if (require.main === module) {
  runHelpdeskCaseStudy().catch((error) => {
    console.error("Helpdesk case study failed:", error);
    process.exitCode = 1;
  });
}
