function* roundRobinGenerator(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("roundRobinGenerator expects a non-empty array");
  }

  let index = 0;
  while (true) {
    yield list[index];
    index = (index + 1) % list.length;
  }
}

module.exports = {
  roundRobinGenerator
};
