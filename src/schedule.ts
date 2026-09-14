import type { Env, Period } from "./types";

const DAY_NAMES: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const ORDER: Period[] = ["daily", "weekly", "monthly"];

function weekday(value: string): number {
  const day = value.trim().toLowerCase();
  const dow = day in DAY_NAMES ? DAY_NAMES[day] : /^[0-6]$/.test(day) ? Number(day) : undefined;
  if (dow === undefined) throw new Error(`Invalid REPORT_WEEKLY_DAY "${value}" — use sun/mon/tue/wed/thu/fri/sat or 0-6`);
  return dow;
}

// One Cron Trigger fires daily at REPORT_TIME; this decides which of the
// enabled REPORT_PERIODS are actually due on the date it fired.
export function periodsDue(scheduledAt: Date, env: Env): Period[] {
  const enabled = new Set(env.REPORT_PERIODS);
  return ORDER.filter((period) => {
    if (!enabled.has(period)) return false;
    if (period === "weekly") {
      if (env.REPORT_WEEKLY_DAY === undefined) throw new Error('"weekly" is enabled but REPORT_WEEKLY_DAY is not set');
      return scheduledAt.getUTCDay() === weekday(env.REPORT_WEEKLY_DAY);
    }
    if (period === "monthly") {
      if (env.REPORT_MONTHLY_DAY === undefined) throw new Error('"monthly" is enabled but REPORT_MONTHLY_DAY is not set');
      return scheduledAt.getUTCDate() === env.REPORT_MONTHLY_DAY;
    }
    return true;
  });
}
