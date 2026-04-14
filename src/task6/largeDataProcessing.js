const { EventEmitter } = require("events");

class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

function toAsyncIterable(source) {
  if (source && typeof source[Symbol.asyncIterator] === "function") {
    return source;
  }

  if (source && typeof source[Symbol.iterator] === "function") {
    return (async function* () {
      yield* source;
    })();
  }

  throw new Error("source must be an iterable or async iterable");
}

async function* chunkAsyncIterable(source, chunkSize = 1000) {
  if (!Number.isFinite(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be at least 1");
  }

  const buffer = [];

  for await (const item of toAsyncIterable(source)) {
    buffer.push(item);

    if (buffer.length >= chunkSize) {
      yield buffer.splice(0, buffer.length);
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}

async function processLargeData(source, processor, options = {}) {
  if (typeof processor !== "function") {
    throw new Error("processor must be a function");
  }

  const signal = options.signal;
  let count = 0;

  if (signal && signal.aborted) {
    throw new AbortError();
  }

  for await (const item of toAsyncIterable(source)) {
    if (signal && signal.aborted) {
      throw new AbortError();
    }

    await processor(item, count);
    count += 1;
  }

  return count;
}

function createEventBasedStream(source, options = {}) {
  const emitter = new EventEmitter();
  const signal = options.signal;
  let active = true;

  const stop = () => {
    active = false;
    signal && signal.removeEventListener("abort", onAbort);
  };

  const onAbort = () => {
    if (!active) {
      return;
    }

    active = false;
    emitter.emit("error", new AbortError());
  };

  if (signal) {
    if (signal.aborted) {
      queueMicrotask(() => emitter.emit("error", new AbortError()));
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  queueMicrotask(async () => {
    try {
      for await (const item of toAsyncIterable(source)) {
        if (!active) {
          return;
        }

        emitter.emit("data", item);
      }

      if (active) {
        emitter.emit("end");
      }
    } catch (error) {
      if (active) {
        emitter.emit("error", error);
      }
    } finally {
      stop();
    }
  });

  return emitter;
}

function consumeEventBasedStream(emitter, processor) {
  if (!emitter || typeof emitter.on !== "function") {
    throw new Error("emitter must support on()");
  }

  if (typeof processor !== "function") {
    throw new Error("processor must be a function");
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      emitter.off("data", onData);
      emitter.off("error", onError);
      emitter.off("end", onEnd);
    };

    const onData = (value) => {
      try {
        processor(value);
      } catch (error) {
        onError(error);
      }
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    emitter.on("data", onData);
    emitter.on("error", onError);
    emitter.on("end", onEnd);
  });
}

module.exports = {
  AbortError,
  chunkAsyncIterable,
  processLargeData,
  createEventBasedStream,
  consumeEventBasedStream
};
