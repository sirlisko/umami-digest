import type { Period } from "./types";

// Classifies a standard 5-field cron ("minute hour day-of-month month
// day-of-week") by which field carries the cadence, so wrangler.toml only
// needs crons listed once, in [triggers] — no separate period mapping to
// keep in sync.
//
//   day-of-month fixed (e.g. "1")   -> monthly
//   day-of-week fixed (e.g. "1")    -> weekly
//   neither fixed                   -> daily
//
// Only these three shapes are supported; anything cleverer (step values,
// lists, "every 2 days") isn't a digest cadence this project models.
export function periodForCron(cron: string): Period {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron "${cron}" must have 5 fields (minute hour day-of-month month day-of-week)`);
  }
  const [, , dayOfMonth, , dayOfWeek] = fields;
  if (dayOfMonth !== "*") return "monthly";
  if (dayOfWeek !== "*") return "weekly";
  return "daily";
}
