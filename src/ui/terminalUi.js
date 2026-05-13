let chalk;

function createPassthrough() {
  const passthrough = (...values) => values.map((value) => String(value)).join(" ");
  return new Proxy(passthrough, {
    get: () => createPassthrough(),
    apply: (_, __, args) => args.map((value) => String(value)).join(" ")
  });
}

try {
  chalk = require("chalk");
  if (chalk && chalk.default) {
    chalk = chalk.default;
  }
} catch {
  chalk = createPassthrough();
}

if (!chalk || typeof chalk.bold !== "function" || typeof chalk.bold.blue !== "function") {
  chalk = createPassthrough();
}

function colorForPriority(priority) {
  if (priority > 0) {
    return chalk.bold.red;
  }

  return chalk.bold.green;
}

function renderBanner(title, subtitle = "") {
  const width = Math.max(title.length, subtitle.length) + 10;
  const line = "═".repeat(width);
  console.log();
  console.log(chalk.bold.blue(`╔${line}╗`));
  console.log(chalk.bold.blue(`║${title.padStart((width + title.length) / 2).padEnd(width)}║`));

  if (subtitle) {
    console.log(chalk.bold.blue(`║${subtitle.padStart((width + subtitle.length) / 2).padEnd(width)}║`));
  }

  console.log(chalk.bold.blue(`╚${line}╝`));
}

function renderSection(title, accent = chalk.cyan) {
  const line = "─".repeat(title.length + 8);
  console.log();
  console.log(accent(line));
  console.log(accent(`  ${title}`));
  console.log(accent(line));
}

function renderKeyValueRows(rows) {
  const width = rows.reduce((max, [key]) => Math.max(max, key.length), 0);
  for (const [key, value, style = chalk.whiteBright] of rows) {
    console.log(`${chalk.gray(key.padEnd(width))} : ${style(value)}`);
  }
}

function renderList(items, itemStyle = chalk.whiteBright) {
  for (const item of items) {
    console.log(`  ${chalk.gray("•")} ${itemStyle(item)}`);
  }
}

function renderCard(title, rows = [], tone = chalk.cyan) {
  const maxContentWidth = 72;
  const textRows = rows.map(([key, value]) => `${key}: ${value}`);
  const width = Math.min(Math.max(title.length, ...textRows.map((line) => line.length)) + 6, maxContentWidth);
  const top = `╭${"─".repeat(width)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  console.log(tone(top));
  console.log(tone(`│  ${title.slice(0, width - 2).padEnd(width - 2)}│`));
  console.log(tone(`├${"─".repeat(width)}┤`));

  const wrapText = (text, limit) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      if ((current + " " + word).length <= limit) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [""];
  };

  for (const [key, value] of rows) {
    const label = `${key}: `;
    const wrapped = wrapText(value, Math.max(8, width - 4 - label.length));

    console.log(tone(`│  ${label}${wrapped[0].padEnd(width - 4 - label.length)}│`));
    for (let index = 1; index < wrapped.length; index += 1) {
      console.log(tone(`│  ${" ".repeat(label.length)}${wrapped[index].padEnd(width - 4 - label.length)}│`));
    }
  }

  console.log(tone(bottom));
}

function renderTable(headers, rows) {
  const widths = headers.map((header, columnIndex) => {
    const columnValues = rows.map((row) => String(row[columnIndex] ?? ""));
    return Math.max(header.length, ...columnValues.map((value) => value.length));
  });

  const formatRow = (row) => row.map((value, index) => String(value ?? "").padEnd(widths[index])).join("  ");

  console.log(chalk.bold(formatRow(headers)));
  console.log(chalk.gray(widths.map((size) => "-".repeat(size)).join("  ")));

  for (const row of rows) {
    console.log(formatRow(row));
  }
}

module.exports = {
  chalk,
  colorForPriority,
  renderBanner,
  renderSection,
  renderKeyValueRows,
  renderList,
  renderCard,
  renderTable
};