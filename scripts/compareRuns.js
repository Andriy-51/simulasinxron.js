const path = require('path');
const { compareRuns } = require('../src/system/reportGenerator');

(async () => {
  try {
    console.log('Starting compareRuns: Priority vs FIFO (20 requests each)');
    const res = await compareRuns(
      { label: 'Priority', queueStrategy: 'priority', demo: { totalRequests: 20 } },
      { label: 'FIFO', queueStrategy: 'fifo', demo: { totalRequests: 20 } },
      { outputDir: path.resolve(process.cwd(), 'outputs') }
    );

    console.log('Compare result summary:');
    console.log(JSON.stringify(res.summary, null, 2));
    console.log('Reports saved at:', res.reportPaths);
  } catch (err) {
    console.error('compareRuns failed:', err);
    process.exitCode = 1;
  }
})();
