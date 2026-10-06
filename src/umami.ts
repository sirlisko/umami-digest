import type { Collected, Env, Metric, Period, Stats } from "./types";

const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };
const DEFAULT_TOP_N = 5;

async function login(env: Env): Promise<string> {
  const res = await fetch(`${env.UMAMI_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.UMAMI_USERNAME, password: env.UMAMI_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login → ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function collect(env: Env, period: Period): Promise<Collected> {
  const token = await login(env);
  const headers = { Authorization: `Bearer ${token}` };
  const base = `${env.UMAMI_URL}/api/websites/${env.UMAMI_WEBSITE_ID}`;
  const days = PERIOD_DAYS[period];
  const endAt = Date.now();
  const startAt = endAt - days * 864e5;
  const qs = `startAt=${startAt}&endAt=${endAt}`;
  const topN = env.REPORT_TOP_N ?? DEFAULT_TOP_N;

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  };

  // Event and UTM metric types aren't accepted by every Umami v3 release; an
  // older instance answers 400, which shouldn't sink the whole digest.
  const getOptional = async (path: string): Promise<Metric[]> => {
    const res = await fetch(`${base}${path}`, { headers });
    if (res.status === 400) return [];
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<Metric[]>;
  };

  const [stats, pages, referrers, browsers, devices, countries, events, utmSources, utmCampaigns] = await Promise.all([
    get<Stats>(`/stats?${qs}`),
    get<Metric[]>(`/metrics?${qs}&type=path&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=referrer&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=browser&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=device&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=country&limit=${topN}`),
    getOptional(`/metrics?${qs}&type=event&limit=${topN}`),
    getOptional(`/metrics?${qs}&type=utmSource&limit=${topN}`),
    getOptional(`/metrics?${qs}&type=utmCampaign&limit=${topN}`),
  ]);

  return {
    siteName: env.SITE_NAME,
    stats,
    pages,
    referrers,
    browsers,
    devices,
    countries,
    events,
    utmSources,
    utmCampaigns,
    startAt,
    endAt,
    period,
  };
}
