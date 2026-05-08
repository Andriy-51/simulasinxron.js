/**
 * Dashboard Metrics Collector
 * 
 * Tracks real-time metrics for:
 * - Queue operations (size, throughput, latency)
 * - Cache performance (hit rate, evictions)
 * - Iterator processing (active count, timeout events)
 * - System health (errors, warnings)
 */

const { chalk, renderTable, renderCard, renderSection, renderKeyValueRows } = require("../ui/terminalUi");

class DashboardMetrics {
  constructor(label = "System Dashboard") {
    this.label = label;
    
    // Queue metrics
    this.queueSize = 0;
    this.queueMaxSize = 0;
    this.queueProcessed = 0;
    this.queuePending = 0;
    this.avgProcessingTimeMs = 0;
    this.maxProcessingTimeMs = 0;
    this.minProcessingTimeMs = Infinity;
    
    // Cache metrics
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.cacheSize = 0;
    this.cacheMaxSize = 0;
    
    // Iterator metrics
    this.activeIterators = 0;
    this.maxIterators = 0;
    this.iteratorTimeouts = 0;
    this.completedIterations = 0;
    
    // System metrics
    this.totalErrors = 0;
    this.totalWarnings = 0;
    this.snapshots = 0;
    this.restored = 0;
    this.startTime = Date.now();
    
    // Performance tracking
    this.processingTimes = [];
    this.throughputHistory = [];
  }

  // ============ Queue Tracking ============
  trackQueueSize(size) {
    this.queueSize = size;
    this.queueMaxSize = Math.max(this.queueMaxSize, size);
  }

  trackQueueProcessed(count = 1) {
    this.queueProcessed += count;
  }

  trackQueuePending(count) {
    this.queuePending = count;
  }

  trackProcessingTime(timeMs) {
    this.processingTimes.push(timeMs);
    this.avgProcessingTimeMs = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    this.maxProcessingTimeMs = Math.max(this.maxProcessingTimeMs, timeMs);
    this.minProcessingTimeMs = Math.min(this.minProcessingTimeMs, timeMs);
  }

  // ============ Cache Tracking ============
  trackCacheHit() {
    this.cacheHits += 1;
  }

  trackCacheMiss() {
    this.cacheMisses += 1;
  }

  trackCacheEviction() {
    this.cacheEvictions += 1;
  }

  trackCacheSize(current, maxSize) {
    this.cacheSize = current;
    this.cacheMaxSize = maxSize;
  }

  getCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    return total === 0 ? 0 : (this.cacheHits / total) * 100;
  }

  // ============ Iterator Tracking ============
  trackIteratorStart() {
    this.activeIterators += 1;
    this.maxIterators = Math.max(this.maxIterators, this.activeIterators);
  }

  trackIteratorComplete() {
    this.activeIterators = Math.max(0, this.activeIterators - 1);
    this.completedIterations += 1;
  }

  trackIteratorTimeout() {
    this.iteratorTimeouts += 1;
    this.activeIterators = Math.max(0, this.activeIterators - 1);
  }

  // ============ System Health ============
  recordError(error) {
    this.totalErrors += 1;
  }

  recordWarning(warning) {
    this.totalWarnings += 1;
  }

  trackSnapshot() {
    this.snapshots += 1;
  }

  trackRestore() {
    this.restored += 1;
  }

  // ============ Calculation Methods ============
  getElapsedSeconds() {
    return (Date.now() - this.startTime) / 1000;
  }

  getThroughput() {
    const elapsed = this.getElapsedSeconds();
    return elapsed > 0 ? this.queueProcessed / elapsed : 0;
  }

  getSystemHealth() {
    const totalEvents = this.totalErrors + this.totalWarnings;
    if (totalEvents === 0) return 100;
    
    const healthScore = 100 - (this.totalErrors * 5 + this.totalWarnings * 1);
    return Math.max(0, healthScore);
  }

  // ============ Rendering ============
  renderQueueMetrics() {
    renderSection("Queue Metrics", chalk.cyan);
    renderKeyValueRows([
      ["Queue Size", `${this.queueSize} / ${this.queueMaxSize}`],
      ["Processed", String(this.queueProcessed)],
      ["Pending", String(this.queuePending)],
      ["Throughput", `${this.getThroughput().toFixed(2)} req/s`],
      ["Avg Processing", `${this.avgProcessingTimeMs.toFixed(0)} ms`],
      ["Min/Max Processing", `${this.minProcessingTimeMs.toFixed(0)} / ${this.maxProcessingTimeMs.toFixed(0)} ms`]
    ]);
  }

  renderCacheMetrics() {
    renderSection("Cache Metrics", chalk.cyan);
    const hitRate = this.getCacheHitRate();
    const hitColor = hitRate > 70 ? chalk.green : hitRate > 30 ? chalk.yellow : chalk.red;
    
    renderKeyValueRows([
      ["Hit Rate", hitColor(`${hitRate.toFixed(1)}%`)],
      ["Hits", String(this.cacheHits)],
      ["Misses", String(this.cacheMisses)],
      ["Evictions", String(this.cacheEvictions)],
      ["Cache Size", `${this.cacheSize} / ${this.cacheMaxSize}`]
    ]);
  }

  renderIteratorMetrics() {
    renderSection("Iterator Processing", chalk.cyan);
    renderKeyValueRows([
      ["Active Iterators", String(this.activeIterators)],
      ["Max Concurrent", String(this.maxIterators)],
      ["Completed", String(this.completedIterations)],
      ["Timeouts", String(this.iteratorTimeouts)]
    ]);
  }

  renderSystemHealth() {
    renderSection("System Health", chalk.cyan);
    const health = this.getSystemHealth();
    const healthColor = health > 80 ? chalk.green : health > 50 ? chalk.yellow : chalk.red;
    
    renderKeyValueRows([
      ["Health Score", healthColor(`${health.toFixed(1)}%`)],
      ["Errors", this.totalErrors > 0 ? chalk.red(String(this.totalErrors)) : String(this.totalErrors)],
      ["Warnings", this.totalWarnings > 0 ? chalk.yellow(String(this.totalWarnings)) : String(this.totalWarnings)],
      ["Uptime", `${this.getElapsedSeconds().toFixed(1)}s`]
    ]);
  }

  renderFullDashboard() {
    renderSection(this.label, chalk.bold.cyan);
    this.renderQueueMetrics();
    this.renderCacheMetrics();
    this.renderIteratorMetrics();
    this.renderSystemHealth();
  }

  // ============ Summary Data ============
  getSummary() {
    return {
      timestamp: new Date().toISOString(),
      elapsedSeconds: this.getElapsedSeconds(),
      queue: {
        size: this.queueSize,
        maxSize: this.queueMaxSize,
        processed: this.queueProcessed,
        pending: this.queuePending,
        throughput: this.getThroughput(),
        avgProcessingMs: this.avgProcessingTimeMs,
        minProcessingMs: this.minProcessingTimeMs,
        maxProcessingMs: this.maxProcessingTimeMs
      },
      cache: {
        hitRate: this.getCacheHitRate(),
        hits: this.cacheHits,
        misses: this.cacheMisses,
        evictions: this.cacheEvictions,
        size: this.cacheSize,
        maxSize: this.cacheMaxSize
      },
      iterators: {
        active: this.activeIterators,
        maxConcurrent: this.maxIterators,
        completed: this.completedIterations,
        timeouts: this.iteratorTimeouts
      },
      health: {
        score: this.getSystemHealth(),
        errors: this.totalErrors,
        warnings: this.totalWarnings,
        snapshots: this.snapshots,
        restored: this.restored
      }
    };
  }
}

module.exports = { DashboardMetrics };
