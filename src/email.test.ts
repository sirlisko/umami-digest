import { describe, expect, it } from "vitest";
import { capitalize, countryName, deltaPill, formatDuration, render, truncate } from "./email";

const baseStats = {
  pageviews: 100,
  visitors: 50,
  visits: 60,
  bounces: 20,
  totaltime: 3600,
  comparison: {
    pageviews: 80,
    visitors: 60,
    visits: 60,
    bounces: 20,
    totaltime: 3600,
  },
};

const baseCollected = {
  siteName: "example.com",
  stats: baseStats,
  pages: [{ x: "/", y: 42 }],
  referrers: [{ x: "google.com", y: 10 }],
  browsers: [{ x: "chrome", y: 30 }],
  devices: [{ x: "desktop", y: 40 }],
  countries: [{ x: "US", y: 25 }],
  events: [] as { x: string; y: number }[],
  utmSources: [] as { x: string; y: number }[],
  utmCampaigns: [] as { x: string; y: number }[],
  startAt: Date.parse("2026-08-21T00:00:00Z"),
  endAt: Date.parse("2026-08-28T00:00:00Z"),
  period: "weekly" as const,
};

describe("render", () => {
  it("labels a weekly report and shows a date range", () => {
    const html = render(baseCollected);
    expect(html).toContain("Weekly digest");
    expect(html).toContain("Aug 21 – Aug 28");
  });

  it("labels a daily report and shows a single date", () => {
    const html = render({ ...baseCollected, period: "daily" });
    expect(html).toContain("Daily digest");
    expect(html).not.toContain("–");
  });

  it("labels a monthly report and shows a date range", () => {
    const html = render({ ...baseCollected, period: "monthly" });
    expect(html).toContain("Monthly digest");
    expect(html).toContain("Aug 21 – Aug 28");
  });

  it("links the footer credit back to the repo", () => {
    const html = render(baseCollected);
    expect(html).toContain('href="https://github.com/sirlisko/umami-digest"');
  });

  it("uses siteName for the title and avatar initial, escaped", () => {
    const html = render({ ...baseCollected, siteName: "<b>evil</b>.com" });
    expect(html).not.toContain("<b>evil</b>.com");
    expect(html).toContain("&lt;b&gt;evil&lt;/b&gt;.com");
  });

  it("falls back to a placeholder when a metric list is empty", () => {
    const html = render({ ...baseCollected, pages: [] });
    expect(html).toContain("No data for this period");
  });

  it("omits the events and UTM sections when they have no data", () => {
    const html = render(baseCollected);
    expect(html).not.toContain("Top events");
    expect(html).not.toContain("UTM sources");
    expect(html).not.toContain("UTM campaigns");
  });

  it("shows events and UTM sections when there is data", () => {
    const html = render({
      ...baseCollected,
      events: [{ x: "signup", y: 7 }],
      utmSources: [{ x: "newsletter", y: 4 }],
    });
    expect(html).toContain("Top events");
    expect(html).toContain("signup");
    expect(html).toContain("UTM sources");
    expect(html).toContain("newsletter");
    expect(html).toContain("UTM campaigns");
  });

  it("resolves country codes and capitalizes browser/device names", () => {
    const html = render(baseCollected);
    expect(html).toContain("United States");
    expect(html).toContain("Chrome");
    expect(html).toContain("Desktop");
  });
});

describe("deltaPill", () => {
  it("is empty with no prior-period baseline", () => {
    expect(deltaPill(10, 0)).toBe("");
  });

  it("colors an increase as good by default", () => {
    const pill = deltaPill(120, 100);
    expect(pill).toContain("▲");
    expect(pill).toContain("#006300");
  });

  it("colors a decrease as bad by default", () => {
    const pill = deltaPill(80, 100);
    expect(pill).toContain("▼");
    expect(pill).toContain("#d03b3b");
  });

  it("inverts good/bad for metrics where a decrease is the win (e.g. bounce rate)", () => {
    const pill = deltaPill(80, 100, true);
    expect(pill).toContain("▼");
    expect(pill).toContain("#006300");
  });
});

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minute-scale durations as m/s", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("drops the seconds when they're zero", () => {
    expect(formatDuration(120)).toBe("2m");
  });
});

describe("truncate", () => {
  it("leaves short strings alone", () => {
    expect(truncate("/about", 10)).toBe("/about");
  });

  it("truncates long strings with an ellipsis", () => {
    expect(truncate("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("capitalize", () => {
  it("upper-cases only the first letter", () => {
    expect(capitalize("chrome")).toBe("Chrome");
  });
});

describe("countryName", () => {
  it("resolves a known ISO code (case-insensitively)", () => {
    expect(countryName("us")).toBe("United States");
  });

  it("falls back to the raw code for an unassigned but well-formed code", () => {
    expect(countryName("XX")).toBe("XX");
  });

  it("falls back to the raw code instead of throwing on malformed input", () => {
    expect(countryName("")).toBe("");
  });
});
