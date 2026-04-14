function consumeIteratorWithTimeout(iterator, timeoutSeconds, processingCallback, pauseMs = 250) {
  if (!iterator || typeof iterator.next !== "function") {
    throw new Error("consumeIteratorWithTimeout expects an iterator with next()");
  }

  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error("timeoutSeconds must be a positive number");
  }

  if (typeof processingCallback !== "function") {
    throw new Error("processingCallback must be a function");
  }

  const startTime = Date.now();
  const endTime = startTime + timeoutSeconds * 1000;
  let iterationCount = 0;

  while (Date.now() < endTime) {
    const result = iterator.next();
    if (result.done) {
      break;
    }

    iterationCount += 1;
    processingCallback(result.value, iterationCount);

    const pauseStart = Date.now();
    while (Date.now() - pauseStart < pauseMs) {
      // Busy wait to preserve the original Task 1 synchronous behavior.
    }
  }

  return {
    iterationCount,
    elapsedSeconds: (Date.now() - startTime) / 1000
  };
}

module.exports = {
  consumeIteratorWithTimeout
};
