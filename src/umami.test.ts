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
    REPORT_PERIODS: [],
    REPORT_TIME: "08:00",
    UMAMI_API_KEY: "umami_key",
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
  it("sends the API key as a bearer token on every request", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => (url.includes("/stats") ? jsonResponse(emptyStats) : jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    await collect(makeEnv(), "weekly");

    const auths = fetchMock.mock.calls.map(([, init]) => init?.headers);
    expect(auths).toEqual(Array(9).fill({ Authorization: "Bearer umami_key" }));
  });

  it("requests the default top-N (5) for every metric list when REPORT_TOP_N isn't set", async () => {
    const urls = stubFetch();

    await collect(makeEnv(), "weekly");

    const limits = urls.filter((u) => u.includes("/metrics")).map((u) => new URL(u).searchParams.get("limit"));
    expect(limits).toEqual(Array(8).fill("5"));
  });

  it("requests REPORT_TOP_N for every metric list when it's set", async () => {
    const urls = stubFetch();

    await collect(makeEnv({ REPORT_TOP_N: 3 }), "weekly");

    const limits = urls.filter((u) => u.includes("/metrics")).map((u) => new URL(u).searchParams.get("limit"));
    expect(limits).toEqual(Array(8).fill("3"));
  });

  it("falls back to empty lists when the instance rejects event/UTM metric types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/stats?")) return jsonResponse(emptyStats);
        if (/type=(event|utm)/.test(url)) {
          return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve("bad type") } as unknown as Response);
        }
        return jsonResponse([{ x: "a", y: 1 }]);
      }),
    );

    const data = await collect(makeEnv(), "weekly");

    expect(data.events).toEqual([]);
    expect(data.utmSources).toEqual([]);
    expect(data.utmCampaigns).toEqual([]);
    expect(data.pages).toEqual([{ x: "a", y: 1 }]);
  });
});
