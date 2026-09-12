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

  const [stats, pages, referrers, browsers, devices, countries] = await Promise.all([
    get<Stats>(`/stats?${qs}`),
    get<Metric[]>(`/metrics?${qs}&type=path&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=referrer&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=browser&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=device&limit=${topN}`),
    get<Metric[]>(`/metrics?${qs}&type=country&limit=${topN}`),
  ]);

  return { siteName: env.SITE_NAME, stats, pages, referrers, browsers, devices, countries, startAt, endAt, period };
}
