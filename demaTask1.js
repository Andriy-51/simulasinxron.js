function* roundRobinGenerator(list) {
    let index = 0;
    
    while (true) {
        yield list[index];
        index = (index + 1) % list.length;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function consumeIteratorWithTimeout(iterator, timeoutSeconds, processingCallback) {
    console.log(`\nПочинаємо обробку ітератора на ${timeoutSeconds} секунд...\n`);

    const startTime = Date.now();
    const endTime = startTime + (timeoutSeconds * 1000);
    let iterationCount = 0;

    while (Date.now() < endTime) {
        const result = iterator.next();

        if (result.done) {
            console.log("Ітератор закінчився.");
            break;
        }

        iterationCount++;
        processingCallback(result.value, iterationCount);

        await sleep(500);
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nОбробка завершена!`);
    console.log(`Всього ітерацій: ${iterationCount}`);
    console.log(`Минуло часу: ${elapsedTime} секунд`);
}

const items = [
    "Яблуко",
    "Банан",
    "Апельсин",
    "Виноград",
    "Персик",
    "Ківі",
    "Манго"
];

console.log("Task 1: Generators and Iterators Demo");

const itemsGenerator = roundRobinGenerator(items);

function processItem(item, iteration) {
    const timestamp = new Date().toLocaleTimeString('uk-UA');
    console.log(`[${timestamp}] Ітерація #${iteration}: ${item}`);
}

(async () => {
    await consumeIteratorWithTimeout(itemsGenerator, 3, processItem);
})();
