Task 3 (Memoize) example

Usage:

const { memoize } = require('../src/task3/memoize');

const slow = (x) => {
  // pretend expensive work
  for (let i = 0; i < 1e6; i++);
  return x * 2;
};

const m = memoize(slow);
console.log(m(2)); // 4 (computed)
console.log(m(2)); // 4 (cached)
