const { runPlatformDemo } = require("../platform/simulationPlatform");

async function startSimulation(req, res, io) {
  const options = req.body || {};

  try {
    runPlatformDemo({ ...options, emitter: io }).then((report) => {
      if (io && typeof io.emit === "function") {
        io.emit("simulation.completed", {
          generatedAt: report?.generatedAt,
          reportPath: report?.snapshotPath || null
        });
      }
    }).catch((error) => {
      if (io && typeof io.emit === "function") {
        io.emit("simulation.failed", { message: String(error?.message || error) });
      }
      console.error("Platform demo error:", error);
    });

    res.json({ status: "started" });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

module.exports = {
  startSimulation
};
