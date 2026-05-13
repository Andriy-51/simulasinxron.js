function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function now() {
  return Date.now();
}

module.exports = { sleep, now };
