const { logLine } = require("../logs/logger");
const { now } = require("../utils/delay");

class QueueManager {
  constructor({ concurrency, totalRequests, processRequest }) {
    this.concurrency = Math.max(1, concurrency);
    this.totalRequests = totalRequests;
    this.processRequest = processRequest;
    this.queue = [];
    this.active = 0;
    this.metrics = [];
    this.peakQueueSize = 0;
    this.completed = 0;
    this.doneResolver = null;
    this.done = new Promise((resolve) => {
      this.doneResolver = resolve;
    });
  }

  snapshot() {
    return {
      concurrency: this.concurrency,
      totalRequests: this.totalRequests,
      active: this.active,
      completed: this.completed,
      peakQueueSize: this.peakQueueSize,
      queue: this.queue.map((request) => ({ ...request })),
      metrics: this.metrics.map((item) => ({ ...item }))
    };
  }

  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.queue) || !Array.isArray(snapshot.metrics)) {
      throw new Error("invalid queue snapshot");
    }

    this.concurrency = Math.max(1, snapshot.concurrency || this.concurrency);
    this.totalRequests = snapshot.totalRequests ?? this.totalRequests;
    this.active = snapshot.active || 0;
    this.completed = snapshot.completed || 0;
    this.peakQueueSize = snapshot.peakQueueSize || 0;
    this.queue = snapshot.queue.map((request) => ({ ...request }));
    this.metrics = snapshot.metrics.map((item) => ({ ...item }));
    this.done = new Promise((resolve) => {
      this.doneResolver = resolve;
    });
  }

  enqueue(request) {
    this.queue.push(request);
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.sequence - b.sequence;
    });

    if (this.queue.length > this.peakQueueSize) {
      this.peakQueueSize = this.queue.length;
    }

    const tag = request.priority > 0 ? "VIP" : "STD";
    logLine(`Request #${request.sequence} received [${tag}] (client ${request.clientId})`);
    this.pump();
  }

  async runOne(request, workerId, processRequest) {
    const startedAt = now();
    const waitingTimeMs = startedAt - request.arrivedAt;
    const tag = request.priority > 0 ? "VIP" : "STD";
    logLine(`Request #${request.sequence} processing... [${tag}] by worker-${workerId}`);

    const processingTimeMs = await (processRequest || this.processRequest)(request);

    this.metrics.push({
      sequence: request.sequence,
      waitingTimeMs,
      processingTimeMs,
      priority: request.priority
    });

    this.completed += 1;
    logLine(`Request #${request.sequence} completed in ${processingTimeMs} ms`);
  }

  pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const request = this.queue.shift();
      this.active += 1;
      const workerId = this.active;

      Promise.resolve()
        .then(() => this.runOne(request, workerId))
        .finally(() => {
          this.active -= 1;

          if (this.completed === this.totalRequests && this.active === 0 && this.queue.length === 0) {
            this.doneResolver();
            return;
          }

          this.pump();
        });
    }
  }

  async waitForDone() {
    if (this.completed === this.totalRequests && this.active === 0 && this.queue.length === 0) {
      return;
    }
    await this.done;
  }

  summary() {
    const processed = this.metrics.length;
    const totalWaiting = this.metrics.reduce((sum, item) => sum + item.waitingTimeMs, 0);
    const totalProcessing = this.metrics.reduce((sum, item) => sum + item.processingTimeMs, 0);
    const vipProcessed = this.metrics.filter((item) => item.priority > 0).length;
    return {
      avgWaitingMs: processed === 0 ? 0 : totalWaiting / processed,
      avgProcessingMs: processed === 0 ? 0 : totalProcessing / processed,
      processed,
      vipProcessed,
      peakQueueSize: this.peakQueueSize
    };
  }
}

module.exports = { QueueManager };
