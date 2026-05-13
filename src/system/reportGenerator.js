/**
 * Analytics Report Generator
 * 
 * Generates comprehensive reports comparing:
 * - Cache efficiency (with vs without memoization)
 * - Throughput metrics
 * - Request processing analysis
 * - Performance improvements
 */

const fs = require("fs/promises");
const path = require("path");
const { chalk, renderBanner, renderCard, renderSection, renderKeyValueRows, renderTable } = require("../ui/terminalUi");

class ReportGenerator {
  constructor(options = {}) {
    this.reportId = `report-${Date.now()}`;
    this.outputDir = options.outputDir || "outputs";
    this.sections = [];
    this.metadata = {
      generatedAt: new Date().toISOString(),
      version: "1.0.0"
    };
  }

  addMetrics(title, metrics) {
    this.sections.push({
      type: "metrics",
      title,
      data: metrics
    });
    return this;
  }

  addComparison(title, label1, data1, label2, data2) {
    this.sections.push({
      type: "comparison",
      title,
      comparison: {
        [label1]: data1,
        [label2]: data2,
        improvement: this.calculateImprovement(data1, data2)
      }
    });
    return this;
  }

  addAnalysis(title, description, findings) {
    this.sections.push({
      type: "analysis",
      title,
      description,
      findings
    });
    return this;
  }

  calculateImprovement(baseline, optimized) {
    const result = {};

    for (const key in optimized) {
      if (typeof optimized[key] === "number" && typeof baseline[key] === "number") {
        if (baseline[key] === 0) {
          result[key] = optimized[key] > 0 ? Infinity : 0;
        } else {
          result[key] = ((baseline[key] - optimized[key]) / baseline[key]) * 100;
        }
      }
    }

    return result;
  }

  toJSON() {
    return {
      ...this.metadata,
      reportId: this.reportId,
      sections: this.sections
    };
  }

  async save() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      const jsonPath = path.join(this.outputDir, `${this.reportId}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(this.toJSON(), null, 2));

      const htmlPath = path.join(this.outputDir, `${this.reportId}.html`);
      await fs.writeFile(htmlPath, this.toHTML());

      const csvPath = path.join(this.outputDir, `${this.reportId}.csv`);
      await fs.writeFile(csvPath, this.toCSV());

      return {
        jsonPath,
        htmlPath,
        csvPath
      };
    } catch (error) {
      console.error("Error saving report:", error);
      throw error;
    }
  }

  toHTML() {
    const sections = this.sections
      .map((section) => {
        if (section.type === "metrics") {
          return `
        <div class="section">
          <h2>${section.title}</h2>
          <table>
            ${Object.entries(section.data)
              .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
              .join("")}
          </table>
        </div>
          `;
        }

        if (section.type === "comparison") {
          const improvement = section.comparison.improvement || {};
          return `
        <div class="section">
          <h2>${section.title}</h2>
          <table>
            <tr><th>Metric</th><th>Before</th><th>After</th><th>Improvement</th></tr>
            ${Object.keys(section.comparison[Object.keys(section.comparison)[0]] || {})
              .map((metric) => {
                const before = section.comparison[Object.keys(section.comparison)[0]][metric];
                const after = section.comparison[Object.keys(section.comparison)[1]][metric];
                const imp = improvement[metric];
                const impStr = typeof imp === "number" ? `${imp.toFixed(2)}%` : "N/A";
                return `<tr><td>${metric}</td><td>${before}</td><td>${after}</td><td>${impStr}</td></tr>`;
              })
              .join("")}
          </table>
        </div>
          `;
        }

        if (section.type === "analysis") {
          return `
        <div class="section">
          <h2>${section.title}</h2>
          <p>${section.description}</p>
          <ul>
            ${section.findings.map((finding) => `<li>${finding}</li>`).join("")}
          </ul>
        </div>
          `;
        }

        return "";
      })
      .join("");

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Simulation Report - ${this.reportId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #333; }
          .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #007bff; }
          h2 { color: #555; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #007bff; color: white; }
          tr:hover { background: #f5f5f5; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Performance Analysis Report</h1>
          <p><small>Generated: ${this.metadata.generatedAt}</small></p>
          ${sections}
        </div>
      </body>
    </html>
    `;
  }

  toCSV() {
    let csv = "Section,Metric,Value\n";

    for (const section of this.sections) {
      if (section.type === "metrics") {
        for (const [key, value] of Object.entries(section.data)) {
          csv += `"${section.title}","${key}","${value}"\n`;
        }
      }

      if (section.type === "heatmap") {
        // export detailed latency rows: Bucket,Count,AvgMs
        csv += `"${section.title}","bucket","count","avgMs"\n`;
        for (const row of section.data.buckets) {
          csv += `"${section.title}","${row.bucket}","${row.count}","${row.avgMs}"\n`;
        }
      }
    }

    return csv;
  }

  /**
   * Add a latency heatmap section from raw per-request metrics.
   * @param {string} title
   * @param {Array<{waitingTimeMs:number,processingTimeMs:number,priority:number}>} samples
   * @param {object} options
   */
  addLatencyHeatmap(title, samples = [], options = {}) {
    // Build buckets by processingTimeMs
    const max = samples.reduce((m, s) => Math.max(m, s.processingTimeMs || 0), 0);
    const min = samples.reduce((m, s) => Math.min(m, s.processingTimeMs || Infinity), Infinity);
    const buckets = [];
    const bucketCount = options.bucketCount || 10;
    const range = Math.max(1, max - (min === Infinity ? 0 : min));
    const step = Math.ceil(range / bucketCount) || 1;

    for (let i = 0; i < bucketCount; i++) {
      const low = (min === Infinity ? 0 : min) + i * step;
      const high = low + step - 1;
      buckets.push({ bucket: `${low}-${high}`, low, high, count: 0, totalMs: 0 });
    }

    for (const s of samples) {
      const v = s.processingTimeMs || 0;
      const idx = Math.min(bucketCount - 1, Math.floor((v - (min === Infinity ? 0 : min)) / step));
      const b = buckets[Math.max(0, idx)];
      b.count += 1;
      b.totalMs += v;
    }

    const out = buckets.map((b) => ({ bucket: b.bucket, count: b.count, avgMs: b.count ? (b.totalMs / b.count).toFixed(2) : 0 }));

    this.sections.push({ type: "heatmap", title, data: { buckets: out, samplesCount: samples.length } });
    return this;
  }

  render() {
    renderBanner("Report Summary", this.reportId);

    for (const section of this.sections) {
      if (section.type === "metrics") {
        renderSection(section.title, chalk.cyan);
        renderKeyValueRows(Object.entries(section.data).map(([k, v]) => [k, String(v)]));
      }

      if (section.type === "comparison") {
        renderSection(section.title, chalk.cyan);
        const comp = section.comparison;
        const keys = Object.keys(comp[Object.keys(comp)[0]] || {});
        const rows = keys.map((key) => {
          const before = comp[Object.keys(comp)[0]][key];
          const after = comp[Object.keys(comp)[1]][key];
          const imp = comp.improvement[key];
          const impStr = typeof imp === "number" ? `${imp > 0 ? "+" : ""}${imp.toFixed(2)}%` : "N/A";
          const impColor = imp > 0 ? chalk.green : chalk.red;
          return [key, String(before), String(after), impColor(impStr)];
        });

        renderTable(["Metric", "Before", "After", "Improvement"], rows);
      }

      if (section.type === "analysis") {
        renderSection(section.title, chalk.cyan);
        const rows = section.findings.map((finding) => [finding]);
        for (const finding of section.findings) {
          console.log(chalk.white(`  • ${finding}`));
        }
      }
    }
  }
}

class CacheEfficiencyAnalyzer {
  constructor() {
    this.withCacheMetrics = null;
    this.withoutCacheMetrics = null;
  }

  recordWithCache(metrics) {
    this.withCacheMetrics = metrics;
  }

  recordWithoutCache(metrics) {
    this.withoutCacheMetrics = metrics;
  }

  analyze() {
    if (!this.withCacheMetrics || !this.withoutCacheMetrics) {
      throw new Error("Both cache and non-cache metrics required for analysis");
    }

    const withCache = this.withCacheMetrics;
    const withoutCache = this.withoutCacheMetrics;

    const improvements = {
      totalTimeReduction: ((withoutCache.totalTimeMs - withCache.totalTimeMs) / withoutCache.totalTimeMs) * 100,
      avgTimeReduction: ((withoutCache.avgTimeMs - withCache.avgTimeMs) / withoutCache.avgTimeMs) * 100,
      throughputIncrease: ((withCache.throughput - withoutCache.throughput) / withoutCache.throughput) * 100,
      computationSaved: ((withoutCache.computationCount - withCache.computationCount) / withoutCache.computationCount) * 100
    };

    return {
      improvements,
      summary: {
        withCache: {
          totalTime: `${withCache.totalTimeMs.toFixed(0)} ms`,
          avgTime: `${withCache.avgTimeMs.toFixed(2)} ms`,
          throughput: `${withCache.throughput.toFixed(2)} ops/s`,
          computations: withCache.computationCount,
          hitRate: `${withCache.cacheHitRate.toFixed(2)}%`
        },
        withoutCache: {
          totalTime: `${withoutCache.totalTimeMs.toFixed(0)} ms`,
          avgTime: `${withoutCache.avgTimeMs.toFixed(2)} ms`,
          throughput: `${withoutCache.throughput.toFixed(2)} ops/s`,
          computations: withoutCache.computationCount
        },
        improvement: {
          totalTimeReduction: `${improvements.totalTimeReduction.toFixed(2)}%`,
          avgTimeReduction: `${improvements.avgTimeReduction.toFixed(2)}%`,
          throughputIncrease: `${improvements.throughputIncrease.toFixed(2)}%`,
          computationSaved: `${improvements.computationSaved.toFixed(2)}%`
        }
      }
    };
  }
}

class ThroughputAnalyzer {
  constructor() {
    this.samples = [];
    this.timeoutEvents = [];
  }

  recordSample(timestamp, requestCount, activeRequests) {
    this.samples.push({
      timestamp,
      requestCount,
      activeRequests
    });
  }

  recordTimeout(timestamp, reason) {
    this.timeoutEvents.push({
      timestamp,
      reason
    });
  }

  analyze() {
    if (this.samples.length === 0) {
      return {};
    }

    const maxRequests = Math.max(...this.samples.map((s) => s.requestCount));
    const maxActive = Math.max(...this.samples.map((s) => s.activeRequests));
    const avgActive = this.samples.reduce((sum, s) => sum + s.activeRequests, 0) / this.samples.length;

    return {
      maxRequestsProcessed: maxRequests,
      maxConcurrentRequests: maxActive,
      avgConcurrentRequests: avgActive,
      timeoutEvents: this.timeoutEvents.length,
      peakThroughput: maxRequests / (this.samples[this.samples.length - 1]?.timestamp - this.samples[0]?.timestamp || 1) * 1000
    };
  }
}

module.exports = {
  ReportGenerator,
  CacheEfficiencyAnalyzer,
  ThroughputAnalyzer
};

/**
 * Run two platform simulations with different options and produce a comparative report.
 * @param {object} optionsA - Options to pass to runPlatformDemo for run A (e.g., { demo: { totalRequests }, runtime: { queueConcurrency }, queueStrategy: 'priority' })
 * @param {object} optionsB - Options for run B
 * @param {object} runOptions - Additional options for report generation (outputDir, reportIdPrefix)
 */
async function compareRuns(optionsA = {}, optionsB = {}, runOptions = {}) {
  const { runPlatformDemo } = require("../platform/simulationPlatform");
  const rg = new ReportGenerator({ outputDir: runOptions.outputDir });

  // Map incoming simple queue strategy option to the place runPlatformDemo accepts it via options
  const mapOptions = (opts, strategy) => {
    const mapped = { ...(opts || {}) };
    mapped.demo = { ...(mapped.demo || {}) };
    // allow passing through a queue strategy to the runtime for runPlatformDemo to pick up
    mapped.runtime = { ...(mapped.runtime || {}), queueStrategy: strategy };
    return mapped;
  };

  // Run A
  const aOpts = mapOptions(optionsA, optionsA.queueStrategy || "priority");
  const reportA = await runPlatformDemo(aOpts);

  // Run B
  const bOpts = mapOptions(optionsB, optionsB.queueStrategy || "fifo");
  const reportB = await runPlatformDemo(bOpts);

  // Pick a compact metrics summary for comparison
  const summarize = (report) => {
    return {
      processed: report.queue?.processed ?? report.queue?.summary?.processed ?? (report.queue ? report.queue.processed : 0),
      avgWaitingMs: report.queue?.avgWaitingMs ?? report.queue?.summary?.avgWaitingMs ?? 0,
      avgProcessingMs: report.queue?.avgProcessingMs ?? report.queue?.summary?.avgProcessingMs ?? 0,
      peakQueue: report.queue?.peakQueueSize ?? report.queue?.summary?.peakQueueSize ?? 0,
      memoSpeedupPercent: report.performance?.memoization?.improvementPercent ?? (report.performance?.memoization?.improvementPercent ?? 0),
      iteratorTimeout: report.performance?.iteratorThroughput?.timeoutReached ?? report.iteratorTimeout ?? false,
      cacheHitRate: (report.dashboard?.cache?.hitRate ?? report.performance?.memoization?.hitRate ?? 0)
    };
  };

  const sumA = summarize(reportA);
  const sumB = summarize(reportB);

  rg.addComparison("Queue Strategy Comparison", optionsA.label || "A", sumA, optionsB.label || "B", sumB);

  rg.addAnalysis("Run A details", "Configuration for run A", [JSON.stringify(aOpts)]);
  rg.addAnalysis("Run B details", "Configuration for run B", [JSON.stringify(bOpts)]);

  const paths = await rg.save();
  return {
    reportPaths: paths,
    summary: { A: sumA, B: sumB }
  };
}

module.exports.compareRuns = compareRuns;
