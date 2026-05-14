const assert = require("node:assert/strict");
const { BiDirectionalPriorityQueue } = require("../src/queue/biDirectionalPriorityQueue");

function runQueuePriorityTests() {
  const queue = new BiDirectionalPriorityQueue();

  queue.enqueue({ id: "low-1" }, 1);
  queue.enqueue({ id: "high-1" }, 10);
  queue.enqueue({ id: "mid-1" }, 5);
  queue.enqueue({ id: "high-2" }, 10);

  assert.equal(queue.size, 4, "queue size should reflect enqueued items");
  assert.deepEqual(queue.peek("highest"), { id: "high-1" }, "highest priority should return first max-priority item");
  assert.deepEqual(queue.peek("lowest"), { id: "low-1" }, "lowest priority should return the smallest priority item");
  assert.deepEqual(queue.dequeue("highest"), { id: "high-1" }, "highest dequeue should remove the first max-priority item");
  assert.deepEqual(queue.dequeue("highest"), { id: "high-2" }, "highest dequeue should preserve FIFO order within the same priority");
  assert.deepEqual(queue.dequeue("lowest"), { id: "low-1" }, "lowest dequeue should remove the minimum priority item");
  assert.deepEqual(queue.dequeue("highest"), { id: "mid-1" }, "remaining item should be dequeued last");
  assert.equal(queue.size, 0, "queue should be empty after all removals");
  assert.equal(queue.dequeue("highest"), undefined, "dequeue on empty queue should return undefined");
}

try {
  runQueuePriorityTests();
  console.log("queue priority unit ok");
} catch (error) {
  console.error("queue priority unit fail", error);
  process.exit(1);
}
