const { logLine } = require("../logs/logger");
const { now } = require("../utils/delay");

/**
 * Priority-aware request queue with concurrency control and basic metrics.
 */
class QueueManager {
  /**
   * @param {object} options - Queue configuration.
   * @param {number} options.concurrency - Maximum concurrent workers.
   * @param {number} options.totalRequests - Total requests expected in the run.
   * @param {Function} options.processRequest - Request processing callback.
   * @param {string} [options.strategy] - Queue ordering strategy.
   */
  constructor({ concurrency, totalRequests, processRequest, strategy = "priority" }) {
    this.concurrency = Math.max(1, concurrency);
    this.totalRequests = totalRequests;
    this.processRequest = processRequest;
    this.strategy = strategy;
    this.queue = [];
    this.active = 0;
    this.metrics = [];
    this.peakQueueSize = 0;
    this.completed = 0;
    this._queueOrderCounter = 0;
    this.doneResolver = null;
    this.done = new Promise((resolve) => {
      this.doneResolver = resolve;
    });
  }

  /**
   * Capture the current queue state for later restore.
   * @returns {object}
   */
  snapshot() {
    return {
      concurrency: this.concurrency,
      totalRequests: this.totalRequests,
      strategy: this.strategy,
      active: this.active,
      completed: this.completed,
      peakQueueSize: this.peakQueueSize,
      queueOrderCounter: this._queueOrderCounter,
      queue: this.queue.map((request) => ({ ...request })),
      metrics: this.metrics.map((item) => ({ ...item }))
    };
  }

  /**
   * Restore the queue state from a snapshot object.
   * @param {object} snapshot - Snapshot returned by snapshot().
   */
  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.queue) || !Array.isArray(snapshot.metrics)) {
      throw new Error("invalid queue snapshot");
    }

    this.concurrency = Math.max(1, snapshot.concurrency || this.concurrency);
    this.totalRequests = snapshot.totalRequests ?? this.totalRequests;
    this.strategy = snapshot.strategy || this.strategy;
    this.active = snapshot.active || 0;
    this.completed = snapshot.completed || 0;
    this.peakQueueSize = snapshot.peakQueueSize || 0;
    this._queueOrderCounter = snapshot.queueOrderCounter || 0;
    this.queue = snapshot.queue.map((request) => ({ ...request }));
    this.metrics = snapshot.metrics.map((item) => ({ ...item }));
    this.done = new Promise((resolve) => {
      this.doneResolver = resolve;
    });
  }

  /**
   * Sort the queue according to the configured strategy.
   * @private
   */
  _sortQueue() {
    const strategy = String(this.strategy || "priority").toLowerCase();

    this.queue.sort((a, b) => {
      if (strategy === "fifo") {
        return (a.__queueOrder || 0) - (b.__queueOrder || 0);
      }

      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      return (a.__queueOrder || 0) - (b.__queueOrder || 0);
    });
  }

  /**
   * Add a request to the queue and attempt to dispatch workers.
   * @param {object} request - Incoming request.
   */
  enqueue(request) {
    const entry = { ...request, __queueOrder: this._queueOrderCounter += 1 };
    this.queue.push(entry);
    this._sortQueue();

    if (this.queue.length > this.peakQueueSize) {
      this.peakQueueSize = this.queue.length;
    }

    const tag = request.priority > 0 ? "VIP" : "STD";
    logLine(`Request #${request.sequence} received [${tag}] (client ${request.clientId})`);
    this.pump();
  }

  /**
   * Process a single queued request.
   * @param {object} request - Request to process.
   * @param {number} workerId - Worker identifier.
   * @param {Function} [processRequest] - Optional override callback.
   * @returns {Promise<void>}
   */
  async runOne(request, workerId, processRequest) {
    const startedAt = now();
    const waitingTimeMs = startedAt - request.arrivedAt;
    const tag = request.priority > 0 ? "VIP" : "STD";
    logLine(`Request #${request.sequence} processing... [${tag}] by worker-${workerId}`);

    const processingTimeMs = await (processRequest || this.processRequest)(request);

    this.metrics.push({
      requestId: request.sequence,
      sequence: request.sequence,
      waitingTimeMs,
      processingTimeMs,
      priority: request.priority,
      deadlineMs: request.deadlineMs ?? null,
      strategy: this.strategy
    });

    this.completed += 1;
    logLine(`Request #${request.sequence} completed in ${processingTimeMs} ms`);
  }

  /**
   * Pump queued work into active workers until capacity is exhausted.
   */
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

  /**
   * Wait until the queue has processed the expected number of requests.
   * @returns {Promise<void>}
   */
  async waitForDone() {
    if (this.completed === this.totalRequests && this.active === 0 && this.queue.length === 0) {
      return;
    }
    await this.done;
  }

  /**
   * Summarize the collected queue metrics.
   * @returns {object}
   */
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
      peakQueueSize: this.peakQueueSize,
      strategy: this.strategy
    };
  }
}

module.exports = { QueueManager };
