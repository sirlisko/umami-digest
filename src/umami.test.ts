import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./types";
import { collect } from "./umami";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    SITE_NAME: "example.com",
    UMAMI_URL: "https://stats.example.com",
    UMAMI_WEBSITE_ID: "site-id",
    REPORT_TO: "you@example.com",
    REPORT_FROM: "reports@example.com",
    UMAMI_USERNAME: "user",
    UMAMI_PASSWORD: "pass",
    RESEND_API_KEY: "key",
    ...overrides,
  };
}

const emptyStats = {
  pageviews: 0,
  visitors: 0,
  visits: 0,
  bounces: 0,
  totaltime: 0,
  comparison: { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 },
};

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve("") } as unknown as Response);
}

function stubFetch() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      urls.push(url);
      if (url.includes("/api/auth/login")) return jsonResponse({ token: "t" });
      if (url.includes("/stats")) return jsonResponse(emptyStats);
      return jsonResponse([]);
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collect", () => {
  it("requests the default top-N (5) for every metric list when REPORT_TOP_N isn't set", async () => {
    const urls = stubFetch();

    await collect(makeEnv(), "weekly");

    const limits = urls.filter((u) => u.includes("/metrics")).map((u) => new URL(u).searchParams.get("limit"));
    expect(limits).toEqual(["5", "5", "5", "5", "5"]);
  });

  it("requests REPORT_TOP_N for every metric list when it's set", async () => {
    const urls = stubFetch();

    await collect(makeEnv({ REPORT_TOP_N: 3 }), "weekly");

    const limits = urls.filter((u) => u.includes("/metrics")).map((u) => new URL(u).searchParams.get("limit"));
    expect(limits).toEqual(["3", "3", "3", "3", "3"]);
  });
});
