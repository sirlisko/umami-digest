import { describe, expect, it } from "vitest";
import { periodsDue } from "./schedule";
import type { Env } from "./types";

const monday = new Date("2026-09-14T08:00:00Z");
const tuesday = new Date("2026-09-15T08:00:00Z");
const firstOfMonth = new Date("2026-09-01T08:00:00Z"); // also a Tuesday

function env(overrides: Partial<Env>): Env {
  return { REPORT_PERIODS: [], REPORT_TIME: "08:00", ...overrides } as Env;
}

describe("periodsDue", () => {
  it("is due daily whenever daily is enabled", () => {
    expect(periodsDue(tuesday, env({ REPORT_PERIODS: ["daily"] }))).toEqual(["daily"]);
  });

  it("includes weekly only on the matching weekday", () => {
    const e = env({ REPORT_PERIODS: ["weekly"], REPORT_WEEKLY_DAY: "mon" });
    expect(periodsDue(monday, e)).toEqual(["weekly"]);
    expect(periodsDue(tuesday, e)).toEqual([]);
  });

  it("accepts a numeric day-of-week", () => {
    expect(periodsDue(monday, env({ REPORT_PERIODS: ["weekly"], REPORT_WEEKLY_DAY: "1" }))).toEqual(["weekly"]);
  });

  it("includes monthly only on the matching day-of-month", () => {
    const e = env({ REPORT_PERIODS: ["monthly"], REPORT_MONTHLY_DAY: 1 });
    expect(periodsDue(firstOfMonth, e)).toEqual(["monthly"]);
    expect(periodsDue(tuesday, e)).toEqual([]);
  });

  it("returns every due period in daily/weekly/monthly order", () => {
    const e = env({ REPORT_PERIODS: ["monthly", "daily"], REPORT_MONTHLY_DAY: 1 });
    expect(periodsDue(firstOfMonth, e)).toEqual(["daily", "monthly"]);
  });

  it("throws on an unrecognized weekday", () => {
    expect(() => periodsDue(monday, env({ REPORT_PERIODS: ["weekly"], REPORT_WEEKLY_DAY: "funday" }))).toThrow(
      /Invalid REPORT_WEEKLY_DAY/,
    );
  });

  it("throws when weekly is enabled without REPORT_WEEKLY_DAY", () => {
    expect(() => periodsDue(monday, env({ REPORT_PERIODS: ["weekly"] }))).toThrow(/REPORT_WEEKLY_DAY is not set/);
  });

  it("throws when monthly is enabled without REPORT_MONTHLY_DAY", () => {
    expect(() => periodsDue(monday, env({ REPORT_PERIODS: ["monthly"] }))).toThrow(/REPORT_MONTHLY_DAY is not set/);
  });
});
