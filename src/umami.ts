import type { Collected, Env, Metric, Period, Stats } from "./types";

const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };

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

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  };

  const [stats, pages, referrers, browsers, devices, countries] = await Promise.all([
    get<Stats>(`/stats?${qs}`),
    get<Metric[]>(`/metrics?${qs}&type=path&limit=5`),
    get<Metric[]>(`/metrics?${qs}&type=referrer&limit=5`),
    get<Metric[]>(`/metrics?${qs}&type=browser&limit=4`),
    get<Metric[]>(`/metrics?${qs}&type=device&limit=4`),
    get<Metric[]>(`/metrics?${qs}&type=country&limit=5`),
  ]);

  return { siteName: env.SITE_NAME, stats, pages, referrers, browsers, devices, countries, startAt, endAt, period };
}
