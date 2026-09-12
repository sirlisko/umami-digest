import { describe, expect, it } from "vitest";
import { periodForCron } from "./schedule";

describe("periodForCron", () => {
  it("treats a plain daily cron as daily", () => {
    expect(periodForCron("0 8 * * *")).toBe("daily");
  });

  it("treats a fixed day-of-week cron as weekly", () => {
    expect(periodForCron("0 8 * * 1")).toBe("weekly");
  });

  it("treats a fixed day-of-month cron as monthly", () => {
    expect(periodForCron("0 8 1 * *")).toBe("monthly");
  });

  it("prefers monthly when both day-of-month and day-of-week are fixed", () => {
    expect(periodForCron("0 8 1 * 1")).toBe("monthly");
  });

  it("throws on a malformed cron", () => {
    expect(() => periodForCron("0 8 * *")).toThrow(/5 fields/);
  });
});
