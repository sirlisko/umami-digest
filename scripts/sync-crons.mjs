// Regenerates [triggers].crons in wrangler.toml from REPORT_TIME/REPORT_PERIODS
// under [vars]. Runs automatically before `npm run dev` / `npm run deploy`;
// standalone via `npm run sync-crons`. A no-op if those vars aren't set.
//
// The generated cron always fires daily at REPORT_TIME, regardless of which
// periods are enabled - the worker decides at runtime (src/schedule.ts) which
// digests are actually due, using REPORT_WEEKLY_DAY/REPORT_MONTHLY_DAY.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PERIODS = ["daily", "weekly", "monthly"];

function parseTime(raw) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) throw new Error(`Invalid REPORT_TIME — expected "HH:MM" (24h, UTC), got "${raw}"`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid REPORT_TIME — hour must be 0-23 and minute 0-59, got "${raw}"`);
  return { hour, minute };
}

// { time: "08:00", periods: ["daily", "weekly"] } -> ["0 8 * * *"]
export function cronFromReportConfig(time, periods) {
  if (periods.length === 0) return [];
  for (const p of periods) {
    if (!PERIODS.includes(p)) throw new Error(`Unknown REPORT_PERIODS entry "${p}" — expected one of: ${PERIODS.join(", ")}`);
  }
  const { hour, minute } = parseTime(time);
  return [`${minute} ${hour} * * *`];
}

function extractVar(tomlText, key) {
  const m = new RegExp(`^${key}\\s*=\\s*(.+?)\\s*(?:#.*)?$`, "m").exec(tomlText);
  return m?.[1];
}

// Pulls REPORT_TIME/REPORT_PERIODS/REPORT_WEEKLY_DAY/REPORT_MONTHLY_DAY out
// of a wrangler.toml. Returns null if neither REPORT_TIME nor REPORT_PERIODS
// is present.
export function extractReportConfig(tomlText) {
  const time = extractVar(tomlText, "REPORT_TIME");
  const periodsRaw = extractVar(tomlText, "REPORT_PERIODS");
  if (time === undefined && periodsRaw === undefined) return null;

  const periods = periodsRaw
    ? periodsRaw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean)
    : [];

  return {
    time: time?.replace(/^"|"$/g, ""),
    periods,
    weeklyDay: extractVar(tomlText, "REPORT_WEEKLY_DAY")?.replace(/^"|"$/g, ""),
    monthlyDay: extractVar(tomlText, "REPORT_MONTHLY_DAY"),
  };
}

// Prepended whenever a crons line is newly created (not just re-valued), so a
// fresh wrangler.toml (it's gitignored - never committed) always ends up
// self-documenting, without relying on wrangler.toml.example being copied.
const GENERATED_COMMENT = [
  "# Generated from REPORT_TIME/REPORT_PERIODS above - don't hand-edit, it's",
  "# overwritten on the next `npm run dev`/`deploy`/`sync-crons`.",
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

  const config = extractReportConfig(text);
  if (!config) {
    console.log(`sync-crons: no REPORT_TIME/REPORT_PERIODS in ${path} — leaving [triggers].crons as-is`);
    return;
  }
  if (config.time === undefined) throw new Error("REPORT_TIME is required when REPORT_PERIODS is set");

  if (config.periods.includes("weekly") && config.weeklyDay === undefined) {
    throw new Error('REPORT_PERIODS includes "weekly" but REPORT_WEEKLY_DAY is not set');
  }
  if (config.periods.includes("monthly") && config.monthlyDay === undefined) {
    throw new Error('REPORT_PERIODS includes "monthly" but REPORT_MONTHLY_DAY is not set');
  }

  const crons = cronFromReportConfig(config.time, config.periods);
  const updated = replaceCrons(text, crons);
  if (updated === text) {
    console.log(`sync-crons: [triggers].crons already matches REPORT_TIME/REPORT_PERIODS (${crons.join(", ")})`);
    return;
  }

  writeFileSync(path, updated);
  console.log(`sync-crons: wrote [triggers].crons = ${JSON.stringify(crons)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`sync-crons: ${err.message}`);
    process.exit(1);
  }
}
