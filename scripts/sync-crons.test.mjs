import { describe, expect, it } from "vitest";
import { cronFromReportConfig, extractReportConfig, replaceCrons } from "./sync-crons.mjs";

describe("cronFromReportConfig", () => {
  it("builds a single daily cron from the shared time", () => {
    expect(cronFromReportConfig("08:00", ["daily", "weekly", "monthly"])).toEqual(["0 8 * * *"]);
  });

  it("returns no cron when no periods are enabled", () => {
    expect(cronFromReportConfig("08:00", [])).toEqual([]);
  });

  it("rejects an unknown period", () => {
    expect(() => cronFromReportConfig("08:00", ["yearly"])).toThrow(/Unknown REPORT_PERIODS entry/);
  });

  it("rejects a malformed time", () => {
    expect(() => cronFromReportConfig("8am", ["daily"])).toThrow(/HH:MM/);
  });

  it("rejects an out-of-range time", () => {
    expect(() => cronFromReportConfig("25:00", ["daily"])).toThrow(/hour must be 0-23/);
  });
});

describe("extractReportConfig", () => {
  it("reads REPORT_TIME, REPORT_PERIODS, and the day vars from [vars]", () => {
    const toml = `
[vars]
SITE_NAME = "example.com"
REPORT_PERIODS = ["daily", "weekly"]
REPORT_TIME = "08:00"
REPORT_WEEKLY_DAY = "mon"
REPORT_MONTHLY_DAY = 1

[triggers]
crons = ["0 8 * * *"]
`;
    expect(extractReportConfig(toml)).toEqual({
      time: "08:00",
      periods: ["daily", "weekly"],
      weeklyDay: "mon",
      monthlyDay: "1",
    });
  });

  it("strips trailing inline comments", () => {
    const toml = `REPORT_TIME = "08:00"   # UTC\nREPORT_PERIODS = ["daily"]  # digests\n`;
    expect(extractReportConfig(toml)).toEqual({ time: "08:00", periods: ["daily"], weeklyDay: undefined, monthlyDay: undefined });
  });

  it("returns null when neither REPORT_TIME nor REPORT_PERIODS is present", () => {
    expect(extractReportConfig('[vars]\nSITE_NAME = "example.com"\n')).toBeNull();
  });
});

describe("replaceCrons", () => {
  it("replaces the crons array under [triggers], leaving the rest untouched", () => {
    const toml = `[vars]\nSITE_NAME = "example.com" # keep me\n\n[triggers]\ncrons = ["0 0 * * *"]\n`;
    const updated = replaceCrons(toml, ["0 8 * * *"]);
    expect(updated).toBe(`[vars]\nSITE_NAME = "example.com" # keep me\n\n[triggers]\ncrons = ["0 8 * * *"]\n`);
  });

  it("adds a commented crons line when [triggers] exists but has none", () => {
    const toml = `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n`;
    expect(replaceCrons(toml, ["0 8 * * *"])).toBe(
      `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n# Generated from REPORT_TIME/REPORT_PERIODS above - don't hand-edit, it's\n# overwritten on the next \`npm run dev\`/\`deploy\`/\`sync-crons\`.\ncrons = ["0 8 * * *"]\n`,
    );
  });

  it("creates [triggers] and a commented crons line from scratch when neither exists", () => {
    const toml = `[vars]\nSITE_NAME = "example.com"\n`;
    expect(replaceCrons(toml, ["0 8 * * *"])).toBe(
      `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n# Generated from REPORT_TIME/REPORT_PERIODS above - don't hand-edit, it's\n# overwritten on the next \`npm run dev\`/\`deploy\`/\`sync-crons\`.\ncrons = ["0 8 * * *"]\n`,
    );
  });
});
