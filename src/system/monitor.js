const { chalk, renderBanner, renderCard, renderKeyValueRows, renderSection, renderTable } = require("../ui/terminalUi");

/**
 * Collects live monitoring data for queue, cache, processing and resilience
 * events, and can optionally emit those updates to a websocket transport.
 */
class SystemMonitor {
  constructor(label = "Simulation platform", options = {}) {
    this.label = label;
    this.emitter = options.emitter || null;
    this.metrics = {
      queueLength: [],
      cacheHits: 0,
      cacheMisses: 0,
      events: 0,
      snapshots: 0,
      restored: 0,
      errors: 0,
      processed: 0,
      waitMs: [],
      processMs: []
    };
    this.timeline = [];
  }

  trackQueueLength(length) {
    this.metrics.queueLength.push({ ts: Date.now(), value: length });
    this.emit("monitor.queueLength", { length });
  }

  trackCache(hit) {
    if (hit) {
      this.metrics.cacheHits += 1;
    } else {
      this.metrics.cacheMisses += 1;
    }
    this.emit("monitor.cache", { hit });
  }

  trackEvent(name, detail) {
    this.metrics.events += 1;
    this.timeline.push({ ts: Date.now(), name, detail });
    this.emit("monitor.event", { name, detail });
  }

  trackProcessing(waitMs, processMs) {
    this.metrics.processed += 1;
    this.metrics.waitMs.push(waitMs);
    this.metrics.processMs.push(processMs);
    this.emit("monitor.processing", { waitMs, processMs });
  }

  trackSnapshot() {
    this.metrics.snapshots += 1;
    this.emit("monitor.snapshot", { snapshots: this.metrics.snapshots });
  }

  trackRestore() {
    this.metrics.restored += 1;
    this.emit("monitor.restore", { restored: this.metrics.restored });
  }

  trackError() {
    this.metrics.errors += 1;
    this.emit("monitor.error", { errors: this.metrics.errors });
  }

  emit(eventName, payload) {
    if (!this.emitter || typeof this.emitter.emit !== "function") {
      return;
    }

    try {
      this.emitter.emit(eventName, {
        label: this.label,
        ...payload,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
    }
  }

  getSummary() {
    const queuePeak = this.metrics.queueLength.reduce((max, item) => Math.max(max, item.value), 0);
    const avg = (list) => (list.length === 0 ? 0 : list.reduce((sum, value) => sum + value, 0) / list.length);
    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;

    return {
      processed: this.metrics.processed,
      queuePeak,
      cacheHitRate: cacheTotal === 0 ? 0 : this.metrics.cacheHits / cacheTotal,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      events: this.metrics.events,
      snapshots: this.metrics.snapshots,
      restored: this.metrics.restored,
      errors: this.metrics.errors,
      avgWaitMs: avg(this.metrics.waitMs),
      avgProcessMs: avg(this.metrics.processMs)
    };
  }

  render() {
    const summary = this.getSummary();
    renderBanner(this.label, "live platform dashboard");
    renderCard(
      "Summary",
      [
        ["Processed", String(summary.processed)],
        ["Queue peak", String(summary.queuePeak)],
        ["Cache hit rate", `${(summary.cacheHitRate * 100).toFixed(1)}%`],
        ["Snapshots", String(summary.snapshots)],
        ["Restored", String(summary.restored)],
        ["Errors", String(summary.errors)]
      ],
      chalk.blue
    );

    renderSection("Performance", chalk.green);
    renderKeyValueRows([
      ["Average wait", `${summary.avgWaitMs.toFixed(2)} ms`, chalk.whiteBright],
      ["Average processing", `${summary.avgProcessMs.toFixed(2)} ms`, chalk.whiteBright],
      ["Cache hits", String(summary.cacheHits), chalk.whiteBright],
      ["Cache misses", String(summary.cacheMisses), chalk.whiteBright]
    ]);

    renderSection("Live events", chalk.magenta);
    renderTable(
      ["Timestamp", "Event", "Detail"],
      this.timeline.slice(-6).map((entry) => [
        new Date(entry.ts).toLocaleTimeString("uk-UA"),
        entry.name,
        typeof entry.detail === "string" ? entry.detail : JSON.stringify(entry.detail)
      ])
    );
  }
}

module.exports = {
  SystemMonitor
};
