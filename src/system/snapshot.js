const fs = require("fs/promises");

function createRoundRobinState(items, index = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  let currentIndex = index % items.length;

  return {
    next() {
      const value = items[currentIndex];
      currentIndex = (currentIndex + 1) % items.length;
      return value;
    },
    snapshot() {
      return {
        items: [...items],
        index: currentIndex
      };
    },
    restore(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.items) || snapshot.items.length === 0) {
        throw new Error("invalid round robin snapshot");
      }

      items.splice(0, items.length, ...snapshot.items);
      currentIndex = snapshot.index % items.length;
    }
  };
}

async function saveSnapshot(filePath, state) {
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function loadSnapshot(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

module.exports = {
  createRoundRobinState,
  saveSnapshot,
  loadSnapshot
};
