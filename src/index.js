const { roundRobinGenerator } = require("./generators/roundRobinGenerator");
const { consumeIteratorWithTimeout } = require("./consumers/consumeIteratorWithTimeout");
const { memoize } = require("./cache/memoize");
const { BiDirectionalPriorityQueue } = require("./queue/biDirectionalPriorityQueue");
const { AbortError, asyncMapCallback, asyncMap, createAsyncMapDemoCases } = require("./async/asyncArrayVariants");
const { chunkAsyncIterable, processLargeData, createEventBasedStream, consumeEventBasedStream } = require("./streams/largeDataProcessing");
const { ReactiveEmitter, createReactiveChannel, createObservable } = require("./reactive/reactiveCommunication");
const { ApiKeyStrategy, JwtStrategy, OAuthStrategy, createAuthStrategy, createFakeApiService, createAuthProxy, runAuthProxyDemo } = require("./proxy/authProxy");
const { createLogSink, createLoggingDecorator, runLoggingDecoratorDemo } = require("./decorators/loggingDecorator");
const { loadConfig, DEFAULT_CONFIG } = require("./system/config");
const { SystemMonitor } = require("./system/monitor");
const { createRoundRobinState, saveSnapshot, loadSnapshot } = require("./system/snapshot");
const { runPlatformDemo } = require("./platform/simulationPlatform");

module.exports = {
  roundRobinGenerator,
  consumeIteratorWithTimeout,
  memoize,
  BiDirectionalPriorityQueue,
  AbortError,
  asyncMapCallback,
  asyncMap,
  createAsyncMapDemoCases,
  chunkAsyncIterable,
  processLargeData,
  createEventBasedStream,
  consumeEventBasedStream,
  ReactiveEmitter,
  createReactiveChannel,
  createObservable,
  ApiKeyStrategy,
  JwtStrategy,
  OAuthStrategy,
  createAuthStrategy,
  createFakeApiService,
  createAuthProxy,
  runAuthProxyDemo,
  createLogSink,
  createLoggingDecorator,
  runLoggingDecoratorDemo,
  loadConfig,
  DEFAULT_CONFIG,
  SystemMonitor,
  createRoundRobinState,
  saveSnapshot,
  loadSnapshot,
  runPlatformDemo
};

// additional exports for coursework demo and new modules
try {
  const { runServerSimulation } = require("./server/server");
  const { logLine, formatTime } = require("./logs/logger");
  const { sleep, now } = require("./utils/delay");

  module.exports.runServerSimulation = runServerSimulation;
  module.exports.logLine = logLine;
  module.exports.formatTime = formatTime;
  module.exports.sleep = sleep;
  module.exports.now = now;
} catch (e) {
  // ignore when requiring from other package layouts
}
