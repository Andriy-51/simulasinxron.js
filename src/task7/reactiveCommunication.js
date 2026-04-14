class ReactiveEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    if (typeof listener !== "function") {
      throw new Error("listener must be a function");
    }

    const listeners = this.listeners.get(eventName) || [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);

    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    const listeners = this.listeners.get(eventName);

    if (!listeners) {
      return false;
    }

    const nextListeners = listeners.filter((currentListener) => currentListener !== listener);

    if (nextListeners.length === 0) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.set(eventName, nextListeners);
    }

    return nextListeners.length !== listeners.length;
  }

  emit(eventName, payload) {
    if (eventName === "error") {
      return this.emitError(payload);
    }

    const listeners = [...(this.listeners.get(eventName) || [])];
    const errors = [];

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      this.emitError(errors.length === 1 ? errors[0] : new AggregateError(errors, "One or more listeners failed"));
    }

    return listeners.length > 0;
  }

  emitError(error) {
    const listeners = [...(this.listeners.get("error") || [])];

    if (listeners.length === 0) {
      throw error;
    }

    const listenerErrors = [];

    for (const listener of listeners) {
      try {
        listener(error);
      } catch (listenerError) {
        listenerErrors.push(listenerError);
      }
    }

    if (listenerErrors.length > 0) {
      throw listenerErrors.length === 1 ? listenerErrors[0] : new AggregateError(listenerErrors, "Error listeners failed");
    }

    return true;
  }

  subscribe(eventName, listener) {
    return this.on(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    return this.off(eventName, listener);
  }
}

function createReactiveChannel() {
  return new ReactiveEmitter();
}

function createObservable(producer) {
  if (typeof producer !== "function") {
    throw new Error("producer must be a function");
  }

  return {
    subscribe(observerOrNext = {}, error, complete) {
      const emitter = new ReactiveEmitter();
      const observer = typeof observerOrNext === "function"
        ? {
            next: observerOrNext,
            error: error || (() => {}),
            complete: complete || (() => {})
          }
        : observerOrNext;

      const unsubscribeNext = emitter.on("next", observer.next || (() => {}));
      const unsubscribeError = emitter.on("error", observer.error || (() => {}));
      const unsubscribeComplete = emitter.on("complete", observer.complete || (() => {}));
      let closed = false;

      const safeEmit = (eventName, value) => {
        if (closed) {
          return;
        }

        emitter.emit(eventName, value);
      };

      queueMicrotask(() => {
        if (closed) {
          return;
        }

        try {
          producer({
            next: (value) => safeEmit("next", value),
            error: (errorValue) => {
              try {
                safeEmit("error", errorValue);
              } finally {
                closed = true;
              }
            },
            complete: () => {
              try {
                safeEmit("complete");
              } finally {
                closed = true;
              }
            }
          });
        } catch (errorValue) {
          try {
            safeEmit("error", errorValue);
          } finally {
            closed = true;
          }
        }
      });

      return () => {
        closed = true;
        unsubscribeNext();
        unsubscribeError();
        unsubscribeComplete();
      };
    }
  };
}

module.exports = {
  ReactiveEmitter,
  createReactiveChannel,
  createObservable
};
