function defaultKeyResolver(args) {
  const seen = new WeakMap();
  let nextId = 0;

  const serialize = (value) => {
    if (value === null || typeof value !== "object") {
      if (typeof value === "function") {
        return `[Function:${value.name || "anonymous"}]`;
      }

      if (typeof value === "symbol") {
        return value.toString();
      }

      if (typeof value === "undefined") {
        return "[undefined]";
      }

      if (typeof value === "string") {
        return JSON.stringify(value);
      }

      if (typeof value === "number" && Number.isNaN(value)) {
        return "NaN";
      }

      return String(value);
    }

    if (seen.has(value)) {
      return `[Circular:${seen.get(value)}]`;
    }

    const path = String(nextId += 1);
    seen.set(value, path);

    if (Array.isArray(value)) {
      return `[${value.map(serialize).join(",")}]`;
    }

    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(",")}}`;
  };

  return args.map(serialize).join("|");
}

function normalizePolicy(policy) {
  return String(policy || "lru").toLowerCase();
}

function getExpiredKeys(cache, now) {
  const expired = [];

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt !== Infinity && entry.expiresAt <= now) {
      expired.push(key);
    }
  }

  return expired;
}

function deleteKeys(cache, keys) {
  for (const key of keys) {
    cache.delete(key);
  }
}

function chooseEvictionKeys(cache, policy, maxSize, customEvict, context) {
  if (!Number.isFinite(maxSize) || cache.size <= maxSize) {
    return [];
  }

  if (policy === "custom" && typeof customEvict === "function") {
    const chosen = customEvict(Array.from(cache.entries()), context);

    if (chosen == null) {
      return [];
    }

    return Array.isArray(chosen) ? chosen : [chosen];
  }

  if (policy === "lfu") {
    let victimKey;
    let victimEntry;

    for (const [key, entry] of cache.entries()) {
      if (!victimEntry) {
        victimKey = key;
        victimEntry = entry;
        continue;
      }

      if (entry.accessCount < victimEntry.accessCount || (entry.accessCount === victimEntry.accessCount && entry.lastAccessed < victimEntry.lastAccessed)) {
        victimKey = key;
        victimEntry = entry;
      }
    }

    return victimKey == null ? [] : [victimKey];
  }

  const [firstKey] = cache.keys();
  return firstKey == null ? [] : [firstKey];
}

function memoize(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new Error("memoize expects a function");
  }

  const {
    maxSize = Infinity,
    evictionPolicy = "lru",
    ttlMs = Infinity,
    customEvict,
    keyResolver = defaultKeyResolver
  } = options;

  if (!Number.isFinite(maxSize) && maxSize !== Infinity) {
    throw new Error("maxSize must be a finite number or Infinity");
  }

  if (Number.isFinite(maxSize) && maxSize < 1) {
    throw new Error("maxSize must be at least 1");
  }

  if (!Number.isFinite(ttlMs) && ttlMs !== Infinity) {
    throw new Error("ttlMs must be a finite number or Infinity");
  }

  const cache = new Map();
  const policy = normalizePolicy(evictionPolicy);

  const memoized = function memoizedFunction(...args) {
    const key = String(keyResolver(args));
    const now = Date.now();
    const cachedEntry = cache.get(key);

    if (cachedEntry) {
      if (cachedEntry.expiresAt !== Infinity && cachedEntry.expiresAt <= now) {
        cache.delete(key);
      } else {
        cachedEntry.accessCount += 1;
        cachedEntry.lastAccessed = now;

        if (policy === "lru") {
          cache.delete(key);
          cache.set(key, cachedEntry);
        }

        return cachedEntry.value;
      }
    }

    deleteKeys(cache, getExpiredKeys(cache, now));

    const value = fn.apply(this, args);
    const expiresAt = ttlMs === Infinity ? Infinity : now + ttlMs;

    cache.set(key, {
      value,
      expiresAt,
      accessCount: 1,
      lastAccessed: now
    });

    const keysToEvict = chooseEvictionKeys(cache, policy, maxSize, customEvict, {
      key,
      value,
      cache,
      maxSize,
      policy
    });

    if (keysToEvict.length > 0) {
      deleteKeys(cache, keysToEvict);
    }

    return value;
  };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
}

module.exports = {
  memoize,
  defaultKeyResolver
};
