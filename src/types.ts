export interface Env {
  SITE_NAME: string;
  UMAMI_URL: string;
  UMAMI_WEBSITE_ID: string;
  REPORT_TO: string;
  REPORT_FROM: string;
  REPORT_TOP_N?: number;
  REPORT_PERIODS: Period[];
  REPORT_TIME: string;
  REPORT_WEEKLY_DAY?: string;
  REPORT_MONTHLY_DAY?: number;
  UMAMI_USERNAME: string;
  UMAMI_PASSWORD: string;
  RESEND_API_KEY: string;
}

export type Period = "daily" | "weekly" | "monthly";

export type Metric = { x: string; y: number };

// Self-hosted Umami v3's /stats response: flat current-period numbers plus a
// `comparison` sibling holding the same fields for the prior period (not a
// per-field { value, prev } shape).
export type Stats = {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  comparison: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
  };
};

export type Collected = {
  siteName: string;
  stats: Stats;
  pages: Metric[];
  referrers: Metric[];
  browsers: Metric[];
  devices: Metric[];
  countries: Metric[];
  startAt: number;
  endAt: number;
  period: Period;
};
