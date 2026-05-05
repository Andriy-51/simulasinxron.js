const api = require("./src");

module.exports = api;

if (require.main === module) {
	const { createInterface } = require("node:readline/promises");
	const { stdin, stdout } = require("node:process");
	const { spawn } = require("node:child_process");
	const { chalk, renderBanner, renderCard, renderList, renderSection } = require("./src/ui/terminalUi");
	const { runServerSimulation } = require("./serverSimulator");
	const { runPlatformDemo } = require("./src/platform/simulationPlatform");
	const { compareQueueStrategies } = require("./src/analysis/queueComparison");
	const { runChaosEngineeringLab } = require("./src/chaos/chaosScenario");
	const { runHelpdeskCaseStudy } = require("./src/examples/helpdeskScenario");
	const { runStressTestMode } = require("./src/stress/stressTestMode");

	const rl = createInterface({ input: stdin, output: stdout });

	async function promptNumber(question, defaultValue, minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY) {
		const answer = await rl.question(`${question} [${defaultValue}]: `);
		const parsed = Number.parseFloat(answer);
		if (!Number.isFinite(parsed)) {
			return defaultValue;
		}

		return Math.min(maximum, Math.max(minimum, parsed));
	}

	async function promptChoice(question, choices, defaultIndex = 0) {
		console.log(question);
		choices.forEach((choice, index) => {
			console.log(`  ${index + 1}. ${choice.label}`);
		});

		const answer = await rl.question(`Select [${defaultIndex + 1}]: `);
		const parsed = Number.parseInt(answer, 10);
		if (!Number.isFinite(parsed) || parsed < 1 || parsed > choices.length) {
			return choices[defaultIndex];
		}

		return choices[parsed - 1];
	}

	async function runCli() {
		renderBanner("Simulasinxron.js", "Production CLI dashboard");
		renderCard(
			"What this entrypoint does",
			[
				["Mode", "Interactive product dashboard"],
				["Config", "Loads config.json + .env"],
				["Outputs", "Writes reports into outputs/"],
				["Use case", "Choose a simulation, tune parameters, launch it"]
			],
			chalk.blue
		);

		while (true) {
			renderSection("Main menu", chalk.cyan);
			renderList([
				"1. Simulation platform",
				"2. Helpdesk simulator",
				"3. Server simulation",
				"4. Queue strategy comparison",
				"5. Chaos engineering",
				"6. Stress test mode",
				"7. Legacy coursework walkthrough",
				"0. Exit"
			], chalk.whiteBright);

			const choice = await rl.question("Choose a scenario: ");

			if (choice === "0") {
				break;
			}

			if (choice === "1") {
				const totalRequests = await promptNumber("Total requests", 40, 4, 200);
				const concurrency = await promptNumber("Queue concurrency", 3, 1, 16);
				const monitorRefreshMs = await promptNumber("Dashboard refresh ms", 500, 100, 5_000);
				await runPlatformDemo({
					demo: { totalRequests },
					runtime: { queueConcurrency: concurrency, monitorRefreshMs },
					outputDir: "outputs"
				});
				continue;
			}

			if (choice === "2") {
				await runHelpdeskCaseStudy();
				continue;
			}

			if (choice === "3") {
				const clients = await promptNumber("Clients", 5, 1, 50);
				const requestsPerClient = await promptNumber("Requests per client", 6, 1, 50);
				const concurrency = await promptNumber("Concurrency", 3, 1, 20);
				const vipRate = await promptNumber("VIP rate", 0.25, 0, 1);
				await runServerSimulation({ clients, requestsPerClient, concurrency, vipRate, demo: false, reportPath: "outputs/server-report.json" });
				continue;
			}

			if (choice === "4") {
				const workloadSize = await promptNumber("Workload size", 24, 4, 100);
				await compareQueueStrategies({ workloadSize, reportPath: "outputs/queue-comparison.json" });
				continue;
			}

			if (choice === "5") {
				await runChaosEngineeringLab();
				continue;
			}

			if (choice === "6") {
				const totalRequests = await promptNumber("Stress workload", 80, 20, 300);
				const delayMs = await promptNumber("Processing delay ms", 10, 1, 100);
				const failureRate = await promptNumber("Failure rate", 0.18, 0, 1);
				const timeoutSeconds = await promptNumber("Timeout seconds", 0.2, 0.05, 5);
				await runStressTestMode({ totalRequests, delayMs, failureRate, timeoutSeconds, outputDir: "outputs" });
				continue;
			}

			if (choice === "7") {
				await new Promise((resolve, reject) => {
					const child = spawn(process.execPath, ["src/examples/courseworkMenu.js"], {
						stdio: "inherit",
						cwd: process.cwd()
					});

					child.on("exit", (code) => {
						if (code === 0) {
							resolve();
							return;
						}

						reject(new Error(`Legacy coursework walkthrough exited with code ${code}`));
					});
				});
				continue;
			}

			console.log(chalk.yellow("Unknown selection. Try again."));
		}

		await rl.close();
		console.log(chalk.green("Goodbye."));
	}

	runCli().catch(async (error) => {
		console.error(error);
		await rl.close();
		process.exitCode = 1;
	});
}