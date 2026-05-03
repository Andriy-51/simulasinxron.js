const { compareQueueStrategies } = require('../src/analysis/queueComparison');
const { createFaultInjector, runWithRetry } = require('../src/chaos/faultInjection');

(async () => {
  try {
    const comparison = await compareQueueStrategies({ workloadSize: 8 });
    if (!comparison.priorityRun || !comparison.fifoRun) {
      throw new Error('comparison report missing runs');
    }

    let calls = 0;
    const stableOperation = createFaultInjector(async (value) => {
      calls += 1;
      return value * 2;
    }, { failureRate: 0, delayRate: 0, label: 'stableOperation' });

    const retryResult = await runWithRetry(() => stableOperation(21), 2);
    if (!retryResult.ok || retryResult.value !== 42 || calls !== 1) {
      throw new Error('fault injector smoke test failed');
    }

    console.log('platform smoke ok', {
      priorityResponse: comparison.priorityRun.summary.avgResponseMs,
      fifoResponse: comparison.fifoRun.summary.avgResponseMs,
      retryAttempts: retryResult.attempts
    });
  } catch (error) {
    console.error('platform smoke fail', error);
    process.exit(1);
  }
})();
