# Simulasinxron.js — Асинхронні паттерни та серверна симуляція

Курсова робота, що демонструє ключові концепції асинхронного програмування в JavaScript через практичні приклади та інтерактивну демонстрацію.

## Структура проекту

```
src/
├── cache/              # Кешування результатів функцій
│   └── memoize.js
├── queue/              # Пріоритетна черга обробки
│   └── biDirectionalPriorityQueue.js
├── async/              # Асинхронна обробка масивів
│   └── asyncArrayVariants.js
├── streams/            # Обробка великих даних потоками
│   └── largeDataProcessing.js
├── reactive/           # Event-driven комунікація
│   └── reactiveCommunication.js
├── server/             # Симуляція роботи сервера
│   ├── server.js       # Оркестратор симуляції
│   └── queue.js        # Менеджер черги запитів
├── simulation/         # Генератори запитів
│   └── requestGenerator.js
├── logs/               # Логування та форматування часу
│   └── logger.js
├── utils/              # Утиліти (затримка, поточний час)
│   └── delay.js
├── examples/           # Інтерактивні приклади
│   └── courseworkMenu.js
├── generators/         # Генератори (раунд-робін)
│   └── roundRobinGenerator.js
├── consumers/          # Споживачі ітераторів
│   └── consumeIteratorWithTimeout.js
└── index.js            # Головний експорт модулів
```

## Основні компоненти

### 1. **Кеш-система** (`cache/memoize.js`)
- LRU (Least Recently Used) евікція
- TTL (Time To Live) експіраціяcustom евікція
- Детальна сер іалізація ключів

### 2. **Пріоритетна черга** (`queue/biDirectionalPriorityQueue.js`)
- FIFO / LIFO / пріоритет доступ
- Оптимізована навігація по пріоритетам
- Миттєва інформація про min/max

### 3. **Асинхронна обробка** (`async/asyncArrayVariants.js`)
- `asyncMap()` — обробка масивів з затримками
- `asyncMapCallback()` — callback-стиль
- AbortSignal підтримка

### 4. **Потоки великих даних** (`streams/largeDataProcessing.js`)
- Асинхронна ітерація з чанкуванням
- Event-based потокова обробка
- Обробка сотень тисяч записів

### 5. **Реактивна комунікація** (`reactive/reactiveCommunication.js`)
- `ReactiveEmitter` — спостерігаємі обробники
- `Observable` паттерн
- Event-driven архітектура

### 6. **Серверна симуляція** (`server/`)
- Миттєва обробка запитів з чергою
- VIP та звичайні запити
- Моніторинг затримок та метрик

## Запуск

### Інтерактивна демонстрація

```bash
node src/examples/courseworkMenu.js
```

Меню дозволяє запустити:
1. Генератори та ітератори
2. Пріоритетну чергу
3. Асинхронну обробку
4. Кешування
5. Обробку великих даних
6. Реактивну комунікацію
7. Логування
8. Повну демонстрацію
9. Кастомну демонстрацію
10. Симуляцію клієнт-сервер

### Симуляція сервера

```bash
# Режим дефолт (5 клієнтів, 6 запитів кожен, 3 робітники)
node serverSimulator.js

# Демо-режим з 100 випадковими запитами
node serverSimulator.js --demo --total=100 --concurrency=3 --vip=0.25

# Кастомні параметри
node serverSimulator.js --clients=10 --requests=5 --concurrency=4 --vip=0.3

# Красивий звіт у JSON
node serverSimulator.js --demo --total=100 --concurrency=3 --report=metrics.json --label="Coursework server benchmark"
```

### Тестування

```bash
node tests/smoke-asyncMap.js
```

## CLI-опції `serverSimulator.js`

| Опція | Опис | За замовчуванням |
|-------|------|------------------|
| `--demo` | Генерує N випадкових запитів | `false` |
| `--total=N` | Кількість запитів у демо-режимі | `30` |
| `--clients=N` | Кількість клієнтів | `5` |
| `--requests=N` | Запитів на клієнта | `6` |
| `--concurrency=N` | Макс. одночасних робітників | `3` |
| `--vip=F` | Частка VIP запитів (0-1) | `0.25` |
| `--label=TEXT` | Кастомна назва звіту | `Clients -> Queue -> Server simulation` |
| `--report=PATH` | Зберегти метрики в JSON-файл | `-` |

## Ключові особливості

✅ **Модульна архітектура** — кожен модуль незалежний і повторно використовуваний  
✅ **Асинхронні паттерни** — Promise, async/await, Observable, Event Emitter  
✅ **Оптимізація** — кеш, пріоритизація, потокова обробка  
✅ **Лог-система** — часові мітки для кожної операції  
✅ **Гнучкість** — CLI-параметри, режими, конфігурація  
✅ **Мониторинг** — метрики латентності та пропускної здатності  

## Розроблені технології

- **Node.js** ≥ 14
- **JavaScript ES2020+** (async/await, generators, Symbols)
- **EventEmitter** (вбудований модуль)

---

**Статус:** Завершено ✓


