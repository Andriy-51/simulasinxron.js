const { compareQueueStrategies } = require('../src/analysis/queueComparison');
const { createFaultInjector, runWithRetry } = require('../src/chaos/faultInjection');
const { memoize } = require('../src/cache/memoize');
const { consumeIteratorWithTimeout } = require('../src/consumers/consumeIteratorWithTimeout');
const { createAuthProxy, createFakeApiService } = require('../src/proxy/authProxy');

(async () => {
  try {
    const comparison = await compareQueueStrategies({ workloadSize: 8 });
    if (!comparison.priorityRun || !comparison.fifoRun) {
      throw new Error('comparison report missing runs');
    }

    const cached = memoize((value) => value + 1);
    cached(1);
    cached(1);
    const cacheStats = cached.getStats();
    if (cacheStats.hits !== 1 || cacheStats.misses !== 1 || Math.abs(cacheStats.hitRate - 0.5) > 0.0001) {
      throw new Error('memoize stats smoke test failed');
    }

    const iteratorStats = consumeIteratorWithTimeout([1, 2, 3][Symbol.iterator](), 0.05, () => {}, 0);
    if (typeof iteratorStats.timeoutReached !== 'boolean' || iteratorStats.iterationCount < 1) {
      throw new Error('iterator timeout smoke test failed');
    }

    const proxy = createAuthProxy(createFakeApiService('smoke-api'), {
      accessLevel: 'standard',
      allowedActions: ['view'],
      verbose: false
    });

    const allowed = await proxy.request({ path: '/tickets/1', action: 'view', requiredAccessLevel: 'guest' });
    if (!allowed.ok) {
      throw new Error('auth proxy allowed request failed');
    }

    let denied = false;
    try {
      await proxy.request({ path: '/tickets/1/close', action: 'close', requiredAccessLevel: 'admin' });
    } catch (error) {
      denied = String(error.message).includes('access denied');
    }

    if (!denied) {
      throw new Error('auth proxy denial smoke test failed');
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
      retryAttempts: retryResult.attempts,
      cacheHitRate: cacheStats.hitRate,
      iteratorCount: iteratorStats.iterationCount
    });
  } catch (error) {
    console.error('platform smoke fail', error);
    process.exit(1);
  }
})();
