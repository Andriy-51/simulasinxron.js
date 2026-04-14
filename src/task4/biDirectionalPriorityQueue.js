class QueueNode {
  constructor(item, priority, order) {
    this.item = item;
    this.priority = priority;
    this.order = order;
    this.prevGlobal = null;
    this.nextGlobal = null;
    this.prevPriority = null;
    this.nextPriority = null;
  }
}

function normalizeMode(mode) {
  return String(mode || "highest").toLowerCase();
}

class BiDirectionalPriorityQueue {
  constructor() {
    this._head = null;
    this._tail = null;
    this._priorityBuckets = new Map();
    this._size = 0;
    this._order = 0;
    this._minPriority = null;
    this._maxPriority = null;
  }

  get size() {
    return this._size;
  }

  isEmpty() {
    return this._size === 0;
  }

  enqueue(item, priority) {
    if (!Number.isFinite(priority)) {
      throw new Error("priority must be a finite number");
    }

    const node = new QueueNode(item, priority, this._order += 1);
    this._appendGlobal(node);
    this._appendPriority(node);
    this._size += 1;
    this._updateBoundsOnInsert(priority);
    return node.item;
  }

  peek(mode = "highest") {
    const node = this._resolveNode(mode);
    return node ? node.item : undefined;
  }

  dequeue(mode = "highest") {
    const node = this._resolveNode(mode);
    if (!node) {
      return undefined;
    }

    this._removeNode(node);
    return node.item;
  }

  clear() {
    this._head = null;
    this._tail = null;
    this._priorityBuckets.clear();
    this._size = 0;
    this._minPriority = null;
    this._maxPriority = null;
  }

  _appendGlobal(node) {
    if (!this._tail) {
      this._head = node;
      this._tail = node;
      return;
    }

    node.prevGlobal = this._tail;
    this._tail.nextGlobal = node;
    this._tail = node;
  }

  _appendPriority(node) {
    const bucket = this._priorityBuckets.get(node.priority) || { head: null, tail: null, size: 0 };

    if (!bucket.tail) {
      bucket.head = node;
      bucket.tail = node;
    } else {
      node.prevPriority = bucket.tail;
      bucket.tail.nextPriority = node;
      bucket.tail = node;
    }

    bucket.size += 1;
    this._priorityBuckets.set(node.priority, bucket);
  }

  _updateBoundsOnInsert(priority) {
    if (this._minPriority == null || priority < this._minPriority) {
      this._minPriority = priority;
    }

    if (this._maxPriority == null || priority > this._maxPriority) {
      this._maxPriority = priority;
    }
  }

  _resolveNode(mode) {
    if (this._size === 0) {
      return null;
    }

    const normalized = normalizeMode(mode);

    if (normalized === "oldest" || normalized === "front" || normalized === "fifo") {
      return this._head;
    }

    if (normalized === "newest" || normalized === "back" || normalized === "lifo") {
      return this._tail;
    }

    if (normalized === "lowest" || normalized === "min") {
      return this._bucketHead(this._minPriority);
    }

    return this._bucketHead(this._maxPriority);
  }

  _bucketHead(priority) {
    if (priority == null) {
      return null;
    }

    const bucket = this._priorityBuckets.get(priority);
    return bucket ? bucket.head : null;
  }

  _removeNode(node) {
    this._size -= 1;

    if (node.prevGlobal) {
      node.prevGlobal.nextGlobal = node.nextGlobal;
    } else {
      this._head = node.nextGlobal;
    }

    if (node.nextGlobal) {
      node.nextGlobal.prevGlobal = node.prevGlobal;
    } else {
      this._tail = node.prevGlobal;
    }

    const bucket = this._priorityBuckets.get(node.priority);
    if (bucket) {
      if (node.prevPriority) {
        node.prevPriority.nextPriority = node.nextPriority;
      } else {
        bucket.head = node.nextPriority;
      }

      if (node.nextPriority) {
        node.nextPriority.prevPriority = node.prevPriority;
      } else {
        bucket.tail = node.prevPriority;
      }

      bucket.size -= 1;

      if (bucket.size === 0) {
        this._priorityBuckets.delete(node.priority);
        this._refreshBoundsIfNeeded(node.priority);
      }
    }
  }

  _refreshBoundsIfNeeded(priority) {
    if (this._priorityBuckets.size === 0) {
      this._minPriority = null;
      this._maxPriority = null;
      return;
    }

    if (priority !== this._minPriority && priority !== this._maxPriority) {
      return;
    }

    let min = null;
    let max = null;

    for (const existingPriority of this._priorityBuckets.keys()) {
      if (min == null || existingPriority < min) {
        min = existingPriority;
      }

      if (max == null || existingPriority > max) {
        max = existingPriority;
      }
    }

    this._minPriority = min;
    this._maxPriority = max;
  }
}

module.exports = {
  BiDirectionalPriorityQueue
};
