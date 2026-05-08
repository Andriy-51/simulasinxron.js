function consumeIteratorWithTimeout(iterator, timeoutSeconds, processingCallback, pauseMs = 250, options = {}) {
  if (!iterator || typeof iterator.next !== "function") {
    throw new Error("consumeIteratorWithTimeout expects an iterator with next()");
  }

  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error("timeoutSeconds must be a positive number");
  }

  if (typeof processingCallback !== "function") {
    throw new Error("processingCallback must be a function");
  }

  const hooks = options && typeof options === "object" ? options : {};

  const startTime = Date.now();
  const endTime = startTime + timeoutSeconds * 1000;
  let iterationCount = 0;

  if (typeof hooks.onStart === "function") {
    hooks.onStart({ startedAt: startTime });
  }

  while (Date.now() < endTime) {
    const result = iterator.next();
    if (result.done) {
      break;
    }

    iterationCount += 1;

    if (typeof hooks.onIterationStart === "function") {
      hooks.onIterationStart({ iterationCount, value: result.value });
    }

    processingCallback(result.value, iterationCount);

    if (typeof hooks.onIterationComplete === "function") {
      hooks.onIterationComplete({ iterationCount, value: result.value });
    }

    const pauseStart = Date.now();
    while (Date.now() - pauseStart < pauseMs) {
      // Busy wait to preserve the original synchronous demo behavior.
    }
  }

  const timeoutReached = Date.now() >= endTime;

  if (timeoutReached && typeof hooks.onTimeout === "function") {
    hooks.onTimeout({ iterationCount, elapsedSeconds: (Date.now() - startTime) / 1000 });
  }

  if (typeof hooks.onComplete === "function") {
    hooks.onComplete({ iterationCount, timeoutReached, elapsedSeconds: (Date.now() - startTime) / 1000 });
  }

  return {
    iterationCount,
    elapsedSeconds: (Date.now() - startTime) / 1000,
    timeoutReached
  };
}

module.exports = {
  consumeIteratorWithTimeout
};
