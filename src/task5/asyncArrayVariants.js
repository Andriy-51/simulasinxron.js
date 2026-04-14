class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

function toAbortError(signal) {
  if (signal && signal.reason instanceof Error) {
    return signal.reason;
  }

  return new AbortError(signal && typeof signal.reason === "string" ? signal.reason : undefined);
}

function validateArrayVariantInput(items, mapper, callback) {
  if (!Array.isArray(items)) {
    throw new Error("items must be an array");
  }

  if (typeof mapper !== "function") {
    throw new Error("mapper must be a function");
  }

  if (callback !== undefined && typeof callback !== "function") {
    throw new Error("callback must be a function");
  }
}

function runAsyncMap(items, mapper, options, settle) {
  const signal = options.signal;
  const delayMs = Number.isFinite(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 0;
  const results = new Array(items.length);
  let index = 0;
  let finished = false;
  let timer = null;

  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  };

  const settleOnce = (error, value) => {
    if (finished) {
      return;
    }

    finished = true;
    cleanup();
    settle(error, value);
  };

  const onAbort = () => {
    settleOnce(toAbortError(signal));
  };

  if (signal && signal.aborted) {
    settleOnce(toAbortError(signal));
    return () => {};
  }

  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  const advance = () => {
    if (finished) {
      return;
    }

    if (index >= items.length) {
      settleOnce(null, results);
      return;
    }

    timer = setTimeout(() => {
      timer = null;

      if (finished) {
        return;
      }

      const currentIndex = index;
      const currentValue = items[currentIndex];
      let callbackSettled = false;

      const resolveStep = (error, mappedValue) => {
        if (callbackSettled || finished) {
          return;
        }

        callbackSettled = true;

        if (error) {
          settleOnce(error);
          return;
        }

        results[currentIndex] = mappedValue;
        index = currentIndex + 1;
        advance();
      };

      try {
        if (mapper.length >= 4) {
          mapper(currentValue, currentIndex, items, resolveStep);
          return;
        }

        Promise.resolve(mapper(currentValue, currentIndex, items)).then(
          (mappedValue) => resolveStep(null, mappedValue),
          (error) => resolveStep(error)
        );
      } catch (error) {
        resolveStep(error);
      }
    }, delayMs);
  };

  advance();

  return () => settleOnce(new AbortError("Cancelled"));
}

function asyncMapCallback(items, mapper, callback, options = {}) {
  validateArrayVariantInput(items, mapper, callback);

  return runAsyncMap(items, mapper, options, (error, value) => {
    callback(error, value);
  });
}

function asyncMap(items, mapper, options = {}) {
  validateArrayVariantInput(items, mapper);

  return new Promise((resolve, reject) => {
    runAsyncMap(items, mapper, options, (error, value) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(value);
    });
  });
}

function createAsyncMapDemoCases() {
  return {
    callbackExample: {
      input: [1, 2, 3],
      mapper: (value, index, array, done) => {
        setTimeout(() => done(null, value * 2), 10);
      }
    },
    promiseExample: {
      input: ["a", "b", "c"],
      mapper: async (value) => value.toUpperCase()
    }
  };
}

module.exports = {
  AbortError,
  asyncMapCallback,
  asyncMap,
  createAsyncMapDemoCases
};
