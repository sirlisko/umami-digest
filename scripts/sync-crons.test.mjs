import { describe, expect, it } from "vitest";
import { cronsFromReportTimes, extractReportTimes, replaceCrons } from "./sync-crons.mjs";

describe("cronsFromReportTimes", () => {
  it("converts daily/weekly/monthly times to cron strings, in that order", () => {
    expect(cronsFromReportTimes({ monthly: "1 08:00", daily: "08:00", weekly: "mon 08:00" })).toEqual([
      "0 8 * * *",
      "0 8 * * 1",
      "0 8 1 * *",
    ]);
  });

  it("only emits crons for periods that are present", () => {
    expect(cronsFromReportTimes({ weekly: "mon 08:00" })).toEqual(["0 8 * * 1"]);
  });

  it("accepts a numeric day-of-week for weekly", () => {
    expect(cronsFromReportTimes({ weekly: "5 17:30" })).toEqual(["30 17 * * 5"]);
  });

  it("rejects an unknown period key", () => {
    expect(() => cronsFromReportTimes({ yearly: "1 1 08:00" })).toThrow(/Unknown REPORT_TIMES key/);
  });

  it("rejects a malformed daily time", () => {
    expect(() => cronsFromReportTimes({ daily: "8am" })).toThrow(/HH:MM/);
  });

  it("rejects an out-of-range time", () => {
    expect(() => cronsFromReportTimes({ daily: "25:00" })).toThrow(/hour must be 0-23/);
  });

  it("rejects an unrecognized weekday", () => {
    expect(() => cronsFromReportTimes({ weekly: "funday 08:00" })).toThrow(/Invalid REPORT_TIMES.weekly day/);
  });

  it("rejects an out-of-range day-of-month", () => {
    expect(() => cronsFromReportTimes({ monthly: "32 08:00" })).toThrow(/day-of-month/);
  });
});

describe("extractReportTimes", () => {
  it("parses a REPORT_TIMES table out of a larger toml document", () => {
    const toml = `
[vars]
SITE_NAME = "example.com"

[vars.REPORT_TIMES]
weekly = "mon 08:00"
monthly = "1 08:00"

[triggers]
crons = ["0 8 * * 1", "0 8 1 * *"]
`;
    expect(extractReportTimes(toml)).toEqual({ weekly: "mon 08:00", monthly: "1 08:00" });
  });

  it("ignores blank lines and comments inside the section", () => {
    const toml = `[vars.REPORT_TIMES]\n# a comment\n\ndaily = "08:00"\n\n[triggers]\ncrons = []\n`;
    expect(extractReportTimes(toml)).toEqual({ daily: "08:00" });
  });

  it("strips trailing inline comments and reads every entry, not just the first", () => {
    const toml = `[vars.REPORT_TIMES]\nweekly = "mon 08:00"        # every Monday\nmonthly = "1 08:00"         # the 1st\n\n[triggers]\ncrons = []\n`;
    expect(extractReportTimes(toml)).toEqual({ weekly: "mon 08:00", monthly: "1 08:00" });
  });

  it("reads a section that runs to the end of the file with no trailing table", () => {
    const toml = `[vars.REPORT_TIMES]\ndaily = "08:00"\nweekly = "mon 08:00"`;
    expect(extractReportTimes(toml)).toEqual({ daily: "08:00", weekly: "mon 08:00" });
  });

  it("returns null when there's no REPORT_TIMES section", () => {
    expect(extractReportTimes('[vars]\nSITE_NAME = "example.com"\n')).toBeNull();
  });
});

describe("replaceCrons", () => {
  it("replaces the crons array under [triggers], leaving the rest untouched", () => {
    const toml = `[vars]\nSITE_NAME = "example.com" # keep me\n\n[triggers]\ncrons = ["0 0 * * *"]\n`;
    const updated = replaceCrons(toml, ["0 8 * * 1", "0 8 1 * *"]);
    expect(updated).toBe(
      `[vars]\nSITE_NAME = "example.com" # keep me\n\n[triggers]\ncrons = ["0 8 * * 1", "0 8 1 * *"]\n`,
    );
  });

  it("adds a commented crons line when [triggers] exists but has none", () => {
    const toml = `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n`;
    expect(replaceCrons(toml, ["0 8 * * 1"])).toBe(
      `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n# Generated from [vars.REPORT_TIMES] above - don't hand-edit, it's overwritten\n# on the next \`npm run dev\`/\`deploy\`/\`sync-crons\`.\ncrons = ["0 8 * * 1"]\n`,
    );
  });

  it("creates [triggers] and a commented crons line from scratch when neither exists", () => {
    const toml = `[vars]\nSITE_NAME = "example.com"\n`;
    expect(replaceCrons(toml, ["0 8 * * 1", "0 8 1 * *"])).toBe(
      `[vars]\nSITE_NAME = "example.com"\n\n[triggers]\n# Generated from [vars.REPORT_TIMES] above - don't hand-edit, it's overwritten\n# on the next \`npm run dev\`/\`deploy\`/\`sync-crons\`.\ncrons = ["0 8 * * 1", "0 8 1 * *"]\n`,
    );
  });
});
