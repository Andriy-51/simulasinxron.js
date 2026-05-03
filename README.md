# Simulasinxron.js

Курсова робота з асинхронного програмування в JavaScript, побудована навколо двох рівнів:
- базових навчальних модулів: кеш, черга, async-обробка, потоки, реактивна комунікація;
- практичного кейсу, де ці модулі використовуються як модель реального helpdesk-процесу з SLA, пріоритетами і метриками.

Окремо проект має polished console UI: рамки, таблиці, картки, кольорові секції і акуратне меню, щоб показ на захисті виглядав як готовий продукт, а не сирий скрипт.

## Що тут є

- `cache/memoize.js` - кешування результатів функцій з LRU, LFU і TTL
- `queue/biDirectionalPriorityQueue.js` - черга з кількома режимами вибірки
- `async/asyncArrayVariants.js` - асинхронна обробка масивів
- `streams/largeDataProcessing.js` - обробка великих обсягів даних
- `reactive/reactiveCommunication.js` - подієва комунікація та Observable-патерн
- `server/server.js` - симуляція серверної обробки запитів
- `server/queue.js` - менеджер пріоритетної черги і метрик
- `proxy/authProxy.js` - auth proxy для API з політиками доступу
- `decorators/loggingDecorator.js` - logging decorator з рівнями логування
- `system/config.js` - завантаження конфігурації з `config.json` або env
- `system/monitor.js` - live dashboard для метрик платформи
- `system/snapshot.js` - snapshot / restore стану черги та round-robin
- `platform/simulationPlatform.js` - platform demo з моніторингом і resume
- `analysis/queueComparison.js` - порівняння FIFO та priority queue з аналітичним звітом
- `chaos/faultInjection.js` - chaos engineering demo з fault injection і retry
- `simulation/requestGenerator.js` - генерація вхідного потоку запитів
- `examples/courseworkMenu.js` - інтерактивне меню з усіма прикладами
- `examples/helpdeskScenario.js` - практичний сценарій helpdesk

## Додаткові практичні модулі

### Auth proxy для API

Файл [src/proxy/authProxy.js](src/proxy/authProxy.js) показує, як проміжний шар може:

- інжектити credentials у запити;
- працювати з API key, JWT і OAuth;
- оновлювати токен, якщо він протермінувався;
- обмежувати частоту запитів;
- логувати події проксі в реальному часі.

### Logging decorator

Файл [src/decorators/loggingDecorator.js](src/decorators/loggingDecorator.js) показує, як:

- обгорнути sync або async функцію;
- задати рівень логування INFO / DEBUG / ERROR;
- друкувати аргументи, результат і тривалість виконання;
- писати логи в console, file або memory sink;
- вмикати режим only-errors.

### Simulation platform

Файл [src/platform/simulationPlatform.js](src/platform/simulationPlatform.js) об'єднує одразу кілька модулів у платформу:

- завантажує runtime-параметри з [config.json](config.json) або змінних середовища;
- збирає live-метрики в [system/monitor.js](src/system/monitor.js);
- зберігає snapshot стану черги і round-robin у [system/snapshot.js](src/system/snapshot.js);
- відновлює симуляцію з того самого місця;
- записує фінальний звіт у файл.

### Queue strategy comparison

Файл [src/analysis/queueComparison.js](src/analysis/queueComparison.js) порівнює priority queue і FIFO на одному й тому самому workload:

- рахує середній час очікування і обробки;
- визначає втрати по SLA / deadline;
- оцінює cache hit rate через memoize;
- зберігає JSON report для посилання в пояснювальній записці.

### Chaos engineering

Файл [src/chaos/faultInjection.js](src/chaos/faultInjection.js) показує resilience-підхід:

- inject-ить випадкові фейли або затримки в async-операції;
- порівнює baseline проти режиму з retry;
- показує, як retry підвищує частку успішних обробок;
- формує окремий JSON report.

## UI/UX для демонстрації

У консолі використовується стилізований текстовий інтерфейс:

- великий banner з назвою курсової;
- картки для пояснення сценаріїв;
- таблиці для списку тікетів;
- кольорові секції для метрик і статусів;
- окремі підказки, які допомагають швидко показати найсильніші частини проекту.

## Чому це вже не просто імітація

У проекті є не тільки демонстрація окремих лабораторних модулів, а й приклад, який можна показувати як бізнес-сценарій:

- тікети підтримки від різних клієнтів;
- пріоритети для термінових звернень;
- різні типи задач: login, billing, payment, integration, report, shipping;
- оцінка SLA для кожного звернення;
- статистика по черзі, середньому часу очікування, обробці та порушеннях SLA.

Додатково є аналітичний шар, який порівнює стратегії обробки, і окрема chaos-демонстрація, щоб показати, як система поводиться під навмисними збоями.

Це виглядає набагато ближче до реальної серверної системи, ніж проста абстрактна симуляція.

## Як запустити

### 1. Інтерактивне меню курсової

```bash
node src/examples/courseworkMenu.js
```

### 2. Практичний helpdesk-кейс

```bash
node src/examples/helpdeskScenario.js
```

Або через npm:

```bash
npm run case-study
```

### 3. Auth proxy demo

```bash
npm run auth-proxy-demo
```

### 4. Logging decorator demo

```bash
npm run logging-decorator-demo
```

### 5. Simulation platform demo

```bash
npm run platform-demo
```

### 6. Queue insights demo

```bash
npm run queue-insights-demo
```

### 7. Chaos engineering demo

```bash
npm run chaos-demo
```

### 8. Серверна симуляція запитів

```bash
node serverSimulator.js --demo --total=100 --concurrency=3 --report=metrics.json
```

### 9. Тест

```bash
node tests/smoke-asyncMap.js
```

```bash
npm run test:platform
```

## Що показує helpdesk case study

Приклад моделює чергу технічної підтримки в робочий пік. Є 10 тікетів від різних клієнтів, частина з них термінові. Кожен тікет має тип задачі та SLA. Після обробки система виводить:

- кількість оброблених тікетів;
- середній час очікування;
- середній час обробки;
- піковий розмір черги;
- кількість порушень SLA.

## CLI-опції для `serverSimulator.js`

| Опція | Опис | Значення за замовчуванням |
|-------|------|---------------------------|
| `--demo` | Запустити випадковий потік запитів | `false` |
| `--total=N` | Кількість запитів у demo-режимі | `30` |
| `--clients=N` | Кількість клієнтів | `5` |
| `--requests=N` | Запитів на одного клієнта | `6` |
| `--concurrency=N` | Ліміт паралельних worker-ів | `3` |
| `--vip=F` | Частка термінових запитів | `0.25` |
| `--label=TEXT` | Назва звіту | `Clients -> Queue -> Server simulation` |
| `--report=PATH` | Експорт метрик у JSON | `-` |

## Сценарій для захисту

Якщо треба коротко пояснити суть роботи викладачу, можна сказати так:

> У курсoвій зібрано набір асинхронних механізмів JavaScript і показано їх на кількох рівнях: як окремі навчальні модулі, як практичну helpdesk-систему з чергою, пріоритетами, SLA і метриками, як реалістичні інтеграційні приклади з auth proxy і logging decorator, а також як config-driven simulation platform з live dashboard, snapshot/resume і зовнішньою конфігурацією. Тобто це не тільки демонстрація синтаксису, а модель сервісного процесу та інфраструктурних шарів.

## Структура проекту

```text
src/
├── async/
├── cache/
├── consumers/
├── examples/
├── generators/
├── logs/
├── decorators/
├── queue/
├── reactive/
├── proxy/
├── analysis/
├── chaos/
├── platform/
├── server/
├── simulation/
├── system/
├── streams/
└── utils/
```

## Технічна база

- Node.js 14+
- CommonJS
- async/await
- generators
- EventEmitter

## Академічний акцент

Проект уже можна захищати не як набір лабораторних, а як приклад моделювання сервісної системи:

- є окремий приклад предметної області, а не абстрактні числа;
- є порівняння стратегій і вимірювані метрики;
- є live monitoring, snapshot/resume і external config;
- є chaos testing і retry-модель для розділу про стійкість.

**Статус:** завершено, з практичним прикладом для захисту.
