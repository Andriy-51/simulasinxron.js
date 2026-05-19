const fs = require("fs");
const path = require("path");
const Datastore = require("nedb-promises");

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const reportsStore = Datastore.create({
  filename: path.join(dataDir, "reports.db"),
  autoload: true
});

const logsStore = Datastore.create({
  filename: path.join(dataDir, "logs.db"),
  autoload: true
});

async function saveReport(reportObj, reportPath) {
  const doc = await reportsStore.insert({
    generatedAt: reportObj.generatedAt || new Date().toISOString(),
    path: reportPath || "",
    content: reportObj
  });

  return doc?._id || null;
}

async function logEvent(level, message, meta) {
  try {
    await logsStore.insert({
      ts: new Date().toISOString(),
      level,
      message,
      meta: meta || null
    });
  } catch (error) {
    console.error("DB log error", error);
  }
}

module.exports = { saveReport, logEvent };
