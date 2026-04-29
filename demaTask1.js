const {
    roundRobinGenerator,
    consumeIteratorWithTimeout,
    memoize,
    BiDirectionalPriorityQueue,
    asyncMap,
    chunkAsyncIterable,
    processLargeData,
    createEventBasedStream,
    consumeEventBasedStream,
    createReactiveChannel,
    createObservable
} = require("./");

const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

let chalk;
try {
    chalk = require("chalk");
} catch {
    const createPassthrough = () => {
        const passthrough = (...values) => values.map((value) => String(value)).join(" ");
        return new Proxy(passthrough, {
            get: () => createPassthrough(),
            apply: (_, __, args) => args.map((value) => String(value)).join(" ")
        });
    };

    chalk = createPassthrough();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function section(number, title) {
    const label = `${number}. ${title}`;
    console.log();
    console.log(chalk.bold.blue("=".repeat(label.length + 8)));
    console.log(chalk.bold.blue(`=== ${label} ===`));
    console.log(chalk.bold.blue("=".repeat(label.length + 8)));
}

function createMonitor() {
    return {
        steps: [],
        record(name, startedAt) {
            this.steps.push({ name, durationMs: Date.now() - startedAt });
        },
        print() {
            console.log("\nПідсумок моніторингу:");
            for (const step of this.steps) {
                console.log(chalk.dim(`- ${step.name}: ${step.durationMs} ms`));
            }
        }
    };
}

async function runGeneratorsSection(monitor, requests = ["REQ-A", "REQ-B", "REQ-C", "REQ-D"]) {
    section(1, "Генератори та ітератори");
    const startedAt = Date.now();
    const generator = roundRobinGenerator(requests);

    const stats = consumeIteratorWithTimeout(
        generator,
        1.2,
        (value, iteration) => {
            const timestamp = new Date().toLocaleTimeString("uk-UA");
            console.log(`[${timestamp}] обхід #${iteration}: ${value}`);
        },
        120
    );

    console.log("Результат:", stats);
    monitor.record("Generators / Iterators", startedAt);
}

async function runPriorityQueueSection(monitor, items = [
    { id: "REQ-1", name: "auth", priority: 8 },
    { id: "REQ-2", name: "search", priority: 3 },
    { id: "REQ-3", name: "billing", priority: 10 },
    { id: "REQ-4", name: "profile", priority: 5 }
]) {
    section(2, "Черга з пріоритетами");
    const startedAt = Date.now();
    const queue = new BiDirectionalPriorityQueue();

    for (const item of items) {
        queue.enqueue({ id: item.id, name: item.name }, item.priority);
    }

    console.log(chalk.green("Найвищий пріоритет:"), queue.peek("highest"));
    console.log(chalk.green("Найнижчий пріоритет:"), queue.peek("lowest"));
    console.log(chalk.yellow("FIFO:"), queue.dequeue("oldest"));
    console.log(chalk.yellow("LIFO:"), queue.dequeue("newest"));
    console.log(chalk.cyan("Після вибірок, size ="), queue.size);
    monitor.record("Priority queue", startedAt);
}

async function runAsyncSection(monitor) {
    section(3, "Асинхронна обробка");
    const startedAt = Date.now();
    const processed = await asyncMap(
        [
            { id: "REQ-10", cost: 12 },
            { id: "REQ-11", cost: 18 },
            { id: "REQ-12", cost: 24 }
        ],
        async (request, index) => {
            await sleep(40);
            return { ...request, processedIndex: index, status: "done" };
        },
        { delayMs: 20 }
    );

    console.log("Async/await map result:", processed);
    monitor.record("Async processing", startedAt);
}

async function runCachingSection(monitor) {
    section(4, "Кешування результатів");
    const startedAt = Date.now();
    let expensiveCalls = 0;

    const expensiveScore = (requestId, payloadSize) => {
        expensiveCalls += 1;
        let score = 0;
        for (let i = 0; i < 100000; i += 1) score += (i % 7) * payloadSize;
        return `${requestId}:${score}`;
    };

    const lruCached = memoize(expensiveScore, { maxSize: 2, evictionPolicy: "lru" });
    const ttlCached = memoize(expensiveScore, { ttlMs: 60 });

    console.log(chalk.magenta("LRU-1:"), lruCached("REQ-20", 2));
    console.log(chalk.magenta("LRU-2:"), lruCached("REQ-20", 2));
    console.log(chalk.magenta("TTL-1:"), ttlCached("REQ-21", 3));
    await sleep(80);
    console.log(chalk.magenta("TTL-2 (після TTL):"), ttlCached("REQ-21", 3));
    console.log(chalk.magenta("Фактичних дорогих викликів:"), expensiveCalls);
    monitor.record("Caching", startedAt);
}

async function runLargeDataSection(monitor) {
    section(5, "Обробка великих даних");
    const startedAt = Date.now();
    const largeData = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, payload: (index + 1) * 10 }));

    console.log(chalk.bold("Частини даних:"));
    for await (const chunk of chunkAsyncIterable(largeData, 4)) console.log(chunk);

    const processedCount = await processLargeData(largeData, async (item, index) => {
        if (index < 3) console.log(chalk.gray("processLargeData item:"), item);
        await sleep(10);
    });

    const stream = createEventBasedStream(largeData);
    let streamCount = 0;
    await consumeEventBasedStream(stream, (item) => {
        streamCount += 1;
        if (streamCount <= 3) console.log(chalk.gray("stream event:"), item);
    });

    console.log("processLargeData count:", processedCount);
    console.log("event stream count:", streamCount);
    monitor.record("Large data", startedAt);
}

async function runReactiveSection(monitor) {
    section(6, "Event-driven комунікація");
    const startedAt = Date.now();
    const channel = createReactiveChannel();

    channel.on("request", (payload) => console.log(chalk.blue("channel request:"), payload));
    channel.on("response", (payload) => console.log(chalk.green("channel response:"), payload));

    channel.emit("request", { id: "REQ-30", stage: "queued" });
    channel.emit("response", { id: "REQ-30", stage: "completed" });

    const observable = createObservable((sink) => {
        sink.next("step-1");
        sink.next("step-2");
        sink.complete();
    });

    await new Promise((resolve) => {
        observable.subscribe(
            (value) => console.log("observable next:", value),
            (error) => {
                console.error("observable error:", error);
                resolve();
            },
            () => {
                console.log("observable complete");
                resolve();
            }
        );
    });

    monitor.record("Reactive communication", startedAt);
}

async function runLoggingSection(monitor) {
    section(7, "Логування та моніторинг");
    const startedAt = Date.now();
    const logEntries = [
        { level: "info", message: "Пайплайн запущено" },
        { level: "info", message: "Черга оброблена" },
        { level: "warn", message: "Частина кешу витіснена" }
    ];

    for (const entry of logEntries) {
        const lvl = entry.level.toLowerCase();
        const label = `[${entry.level.toUpperCase()}]`;
        if (lvl === "info") console.log(chalk.green(label), entry.message);
        else if (lvl === "warn") console.log(chalk.yellow(label), entry.message);
        else if (lvl === "error") console.log(chalk.red(label), entry.message);
        else console.log(label, entry.message);
    }

    monitor.record("Logging", startedAt);
}

async function runCourseworkDemo(options = {}) {
    const monitor = options.monitor ?? createMonitor();

    await runGeneratorsSection(monitor, options.requests);
    await runPriorityQueueSection(monitor, options.priorityItems);
    await runAsyncSection(monitor);
    await runCachingSection(monitor);
    await runLargeDataSection(monitor);
    await runReactiveSection(monitor);
    await runLoggingSection(monitor);

    if (!options.silentSummary) {
        monitor.print();
    }

    return monitor;
}

async function promptCustomRequests(rl) {
    const answer = await rl.question("Введи запити через кому (Enter = стандартні): ");
    const requests = answer
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    return requests.length > 0 ? requests : ["REQ-A", "REQ-B", "REQ-C", "REQ-D"];
}

async function promptPriorityItems(rl) {
    const answer = await rl.question("Введи елементи черги у форматі id:name:priority через кому (Enter = стандартні): ");
    const items = answer
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
            const [id, name, priorityText] = item.split(":").map((part) => part.trim());
            const priority = Number(priorityText);

            if (!id || !name || Number.isNaN(priority)) {
                return null;
            }

            return { id, name, priority };
        })
        .filter(Boolean);

    if (items.length > 0) {
        return items;
    }

    return [
        { id: "REQ-1", name: "auth", priority: 8 },
        { id: "REQ-2", name: "search", priority: 3 },
        { id: "REQ-3", name: "billing", priority: 10 },
        { id: "REQ-4", name: "profile", priority: 5 }
    ];
}

async function runInteractiveMenu() {
    const rl = createInterface({ input: stdin, output: stdout });

    try {
        while (true) {
            console.log();
            console.log(chalk.bold.blue("=== Simulasinxron demo menu ==="));
            console.log("1. Run generators section");
            console.log("2. Run priority queue section");
            console.log("3. Run async processing section");
            console.log("4. Run caching section");
            console.log("5. Run large data section");
            console.log("6. Run reactive communication section");
            console.log("7. Run logging section");
            console.log("8. Run full demo");
            console.log("9. Run custom demo");
            console.log("0. Exit");

            const choice = (await rl.question("Choose an option: ")).trim();
            const monitor = createMonitor();

            if (choice === "0") {
                break;
            }

            if (choice === "1") {
                await runGeneratorsSection(monitor);
            } else if (choice === "2") {
                const priorityItems = await promptPriorityItems(rl);
                await runPriorityQueueSection(monitor, priorityItems);
            } else if (choice === "3") {
                await runAsyncSection(monitor);
            } else if (choice === "4") {
                await runCachingSection(monitor);
            } else if (choice === "5") {
                await runLargeDataSection(monitor);
            } else if (choice === "6") {
                await runReactiveSection(monitor);
            } else if (choice === "7") {
                await runLoggingSection(monitor);
            } else if (choice === "8") {
                await runCourseworkDemo({ monitor, silentSummary: true });
            } else if (choice === "9") {
                const requests = await promptCustomRequests(rl);
                const priorityItems = await promptPriorityItems(rl);
                await runGeneratorsSection(monitor, requests);
                await runPriorityQueueSection(monitor, priorityItems);
                await runAsyncSection(monitor);
                await runCachingSection(monitor);
                await runLargeDataSection(monitor);
                await runReactiveSection(monitor);
                await runLoggingSection(monitor);
            } else {
                console.log("Unknown option, try again.");
                continue;
            }

            monitor.print();
            await rl.question("\nPress Enter to return to the menu...");
        }
    } finally {
        rl.close();
    }
}

async function main() {
    if (stdin.isTTY) {
        await runInteractiveMenu();
    } else {
        await runCourseworkDemo();
    }
}

main().catch((error) => {
    console.error("Курсова демонстрація завершилась з помилкою:", error);
    process.exitCode = 1;
});
