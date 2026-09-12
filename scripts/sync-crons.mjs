// Regenerates [triggers].crons in wrangler.toml from the human-readable
// [vars.REPORT_TIMES] block, so schedules are edited in one place ("weekly at
// 8am Monday") instead of hand-written cron syntax. Runs automatically before
// `npm run dev` / `npm run deploy`; safe to run standalone via
// `npm run sync-crons`. A no-op if wrangler.toml has no REPORT_TIMES block.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DAY_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const PERIODS = ["daily", "weekly", "monthly"];

function parseTime(raw, context) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) throw new Error(`Invalid ${context} — expected a "HH:MM" time (24h, UTC), got "${raw}"`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid ${context} — hour must be 0-23 and minute 0-59, got "${raw}"`);
  return { hour, minute };
}

function cronForDaily(value) {
  const { hour, minute } = parseTime(value.trim(), 'REPORT_TIMES.daily (expected "HH:MM")');
  return `${minute} ${hour} * * *`;
}

function cronForWeekly(value) {
  const m = /^(\S+)\s+(\d{1,2}:\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Invalid REPORT_TIMES.weekly — expected "<day> HH:MM" (e.g. "mon 08:00"), got "${value}"`);
  const [, dayRaw, time] = m;
  const day = dayRaw.toLowerCase();
  const dow = day in DAY_NAMES ? DAY_NAMES[day] : /^[0-6]$/.test(day) ? Number(day) : undefined;
  if (dow === undefined) {
    throw new Error(`Invalid REPORT_TIMES.weekly day "${dayRaw}" — use sun/mon/tue/wed/thu/fri/sat or 0-6`);
  }
  const { hour, minute } = parseTime(time, 'REPORT_TIMES.weekly time (expected "HH:MM")');
  return `${minute} ${hour} * * ${dow}`;
}

function cronForMonthly(value) {
  const m = /^(\d{1,2})\s+(\d{1,2}:\d{2})$/.exec(value.trim());
  if (!m) {
    throw new Error(`Invalid REPORT_TIMES.monthly — expected "<day-of-month> HH:MM" (e.g. "1 08:00"), got "${value}"`);
  }
  const [, domRaw, time] = m;
  const dom = Number(domRaw);
  if (dom < 1 || dom > 31) throw new Error(`Invalid REPORT_TIMES.monthly day-of-month "${domRaw}" — must be 1-31`);
  const { hour, minute } = parseTime(time, 'REPORT_TIMES.monthly time (expected "HH:MM")');
  return `${minute} ${hour} ${dom} * *`;
}

const CRON_FOR = { daily: cronForDaily, weekly: cronForWeekly, monthly: cronForMonthly };

// Turns { weekly: "mon 08:00", monthly: "1 08:00" } into ["0 8 * * 1", "0 8 1 * *"].
export function cronsFromReportTimes(times) {
  for (const key of Object.keys(times)) {
    if (!PERIODS.includes(key)) {
      throw new Error(`Unknown REPORT_TIMES key "${key}" — expected one of: ${PERIODS.join(", ")}`);
    }
  }
  return PERIODS.filter((period) => times[period] !== undefined).map((period) => CRON_FOR[period](times[period]));
}

// Pulls the [vars.REPORT_TIMES] table out of a wrangler.toml as a plain
// { period: "value" } map. Returns null if the section isn't present.
export function extractReportTimes(tomlText) {
  const lines = tomlText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "[vars.REPORT_TIMES]");
  if (start === -1) return null;

  const times = {};
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) break; // next table header
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kv = /^(\w+)\s*=\s*"([^"]*)"\s*(#.*)?$/.exec(trimmed);
    if (!kv) throw new Error(`Couldn't parse REPORT_TIMES line: "${line}"`);
    times[kv[1]] = kv[2];
  }
  return times;
}

// Prepended whenever a crons line is newly created (not just re-valued), so a
// fresh wrangler.toml (it's gitignored - never committed) always ends up
// self-documenting, without relying on wrangler.toml.example being copied.
const GENERATED_COMMENT = [
  "# Generated from [vars.REPORT_TIMES] above - don't hand-edit, it's overwritten",
  "# on the next `npm run dev`/`deploy`/`sync-crons`.",
];

// Replaces the crons array under [triggers], leaving every other line
// (including comments) untouched. Creates [triggers] and/or the crons line
// if either is missing.
export function replaceCrons(tomlText, crons) {
  const cronsList = `[${crons.map((c) => `"${c}"`).join(", ")}]`;

  const existing = /(\[triggers\][\s\S]*?crons\s*=\s*)\[[^\]]*\]/;
  if (existing.test(tomlText)) {
    return tomlText.replace(existing, (_, prefix) => `${prefix}${cronsList}`);
  }

  const lines = tomlText.split(/\r?\n/);
  const triggersIdx = lines.findIndex((line) => line.trim() === "[triggers]");

  if (triggersIdx !== -1) {
    // [triggers] exists but has no crons key yet — add one right below the header.
    lines.splice(triggersIdx + 1, 0, ...GENERATED_COMMENT, `crons = ${cronsList}`);
    return lines.join("\n");
  }

  // No [triggers] section at all — append one at the end of the file.
  const trailingBlank = lines[lines.length - 1] === "";
  const body = trailingBlank ? lines.slice(0, -1) : lines;
  const separator = body.length > 0 && body[body.length - 1].trim() !== "" ? [""] : [];
  return [...body, ...separator, "[triggers]", ...GENERATED_COMMENT, `crons = ${cronsList}`, ""].join("\n");
}

function main() {
  const path = "wrangler.toml";
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.log(`sync-crons: no ${path} found (copy wrangler.toml.example first) — skipping`);
    return;
  }

  const times = extractReportTimes(text);
  if (!times) {
    console.log(`sync-crons: no [vars.REPORT_TIMES] block in ${path} — leaving [triggers].crons as-is`);
    return;
  }

  const crons = cronsFromReportTimes(times);
  const updated = replaceCrons(text, crons);
  if (updated === text) {
    console.log(`sync-crons: [triggers].crons already matches REPORT_TIMES (${crons.join(", ")})`);
    return;
  }

  writeFileSync(path, updated);
  console.log(`sync-crons: wrote [triggers].crons = ${JSON.stringify(crons)} from REPORT_TIMES`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`sync-crons: ${err.message}`);
    process.exit(1);
  }
}
