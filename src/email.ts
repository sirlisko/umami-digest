import type { Collected, Metric } from "./types";

const ink = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781" };
const surface = { page: "#f9f9f7", card: "#fcfcfb", tile: "#ffffff" };
const line = "#e1e0d9";
const accent = "#2a78d6";
const barTrack = "#eef0ee";
const good = "#006300";
const goodBg = "#e7f3e7";
const bad = "#d03b3b";
const badBg = "#fbeaea";
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

export const truncate = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string): string => {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function deltaPill(curr: number, prevValue: number, invert = false): string {
  if (prevValue <= 0) return "";
  const pct = Math.round(((curr - prevValue) / prevValue) * 100);
  const isUp = pct >= 0;
  const isGood = invert ? !isUp : isUp;
  const fg = isGood ? good : bad;
  const bg = isGood ? goodBg : badBg;
  const arrow = isUp ? "▲" : "▼";
  return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:600;font-family:${FONT};">${arrow} ${Math.abs(pct)}%</span>`;
}

function statTile(label: string, value: string, pill: string): string {
  return `
    <td width="50%" valign="top" style="padding:6px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${surface.tile};border:1px solid ${line};border-radius:10px;">
        <tr><td style="padding:18px 18px 16px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${ink.muted};font-family:${FONT};">${label}</p>
          <p style="margin:0 0 10px;font-size:28px;line-height:1.1;font-weight:700;color:${ink.primary};font-family:${FONT};">${value}</p>
          ${pill}
        </td></tr>
      </table>
    </td>`;
}

type MetricRowOptions = {
  labelFor?: (x: string) => string;
  emptyLabel?: string;
  truncateMax?: number;
};

function metricRows(items: Metric[], opts: MetricRowOptions = {}): string {
  const { labelFor = (x: string) => x, emptyLabel = "(direct)", truncateMax } = opts;

  if (!items.length) {
    return `<tr><td style="padding:4px 0 8px;font-size:14px;color:${ink.muted};font-style:italic;font-family:${FONT};">No data for this period</td></tr>`;
  }

  const max = Math.max(...items.map((i) => i.y), 1);

  return items
    .map((item, idx) => {
      const pct = Math.max(4, Math.round((item.y / max) * 100));
      const rawLabel = labelFor(item.x);
      const label = item.x
        ? escapeHtml(truncateMax ? truncate(rawLabel, truncateMax) : rawLabel)
        : `<span style="color:${ink.muted};font-style:italic;">${emptyLabel}</span>`;
      return `
        <tr>
          <td colspan="2" style="padding:${idx > 0 ? "14px" : "0"} 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;color:${ink.primary};font-family:${FONT};word-break:break-all;">${label}</td>
              <td align="right" style="padding-left:16px;font-size:14px;color:${ink.secondary};font-variant-numeric:tabular-nums;font-family:${FONT};white-space:nowrap;">${fmt(item.y)}</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="${pct}%" height="4" style="background:${accent};font-size:0;line-height:4px;">&nbsp;</td>
              <td width="${100 - pct}%" height="4" style="background:${barTrack};font-size:0;line-height:4px;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>`;
    })
    .join("");
}

function metricSection(title: string, items: Metric[], opts?: MetricRowOptions): string {
  return `
    <tr><td style="padding:22px 32px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${ink.primary};font-family:${FONT};">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${metricRows(items, opts)}</table>
    </td></tr>`;
}

function metricColumn(title: string, items: Metric[], opts?: MetricRowOptions): string {
  return `
    <td width="50%" valign="top" style="padding:0 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${ink.primary};font-family:${FONT};">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${metricRows(items, opts)}</table>
    </td>`;
}

export function render({
  siteName,
  stats,
  pages,
  referrers,
  browsers,
  devices,
  countries,
  startAt,
  endAt,
  period,
}: Collected): string {
  const isDaily = period === "daily";
  const dateRange = isDaily ? fmtDate(startAt) : `${fmtDate(startAt)} – ${fmtDate(endAt)}`;
  const eyebrow = `${capitalize(period)} digest`;
  const { comparison } = stats;

  const bounceRate = stats.visits > 0 ? (stats.bounces / stats.visits) * 100 : 0;
  const prevBounceRate = comparison.visits > 0 ? (comparison.bounces / comparison.visits) * 100 : 0;
  const avgTime = stats.visits > 0 ? stats.totaltime / stats.visits : 0;
  const prevAvgTime = comparison.visits > 0 ? comparison.totaltime / comparison.visits : 0;

  return `
<div style="background:${surface.page};padding:32px 16px;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${surface.card};border:1px solid rgba(11,11,11,0.10);border-radius:12px;">
    <tr><td height="4" style="background:${accent};border-radius:12px 12px 0 0;font-size:0;line-height:4px;">&nbsp;</td></tr>
    <tr>
      <td style="padding:28px 32px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="40" valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td width="40" height="40" bgcolor="${accent}" style="border-radius:10px;text-align:center;">
                <span style="display:inline-block;line-height:40px;color:#ffffff;font-size:17px;font-weight:700;font-family:${FONT};">${escapeHtml(siteName.charAt(0).toUpperCase())}</span>
              </td>
            </tr></table>
          </td>
          <td valign="middle" style="padding-left:12px;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${ink.muted};font-family:${FONT};">${eyebrow}</p>
            <h1 style="margin:0;font-size:19px;font-weight:700;color:${ink.primary};font-family:${FONT};">${escapeHtml(siteName)}</h1>
          </td>
          <td align="right" valign="middle">
            <p style="margin:0;font-size:13px;color:${ink.secondary};font-family:${FONT};">${dateRange}</p>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${statTile("Visitors", fmt(stats.visitors), deltaPill(stats.visitors, comparison.visitors))}
          ${statTile("Pageviews", fmt(stats.pageviews), deltaPill(stats.pageviews, comparison.pageviews))}
        </tr><tr>
          ${statTile("Avg. time", formatDuration(avgTime), deltaPill(avgTime, prevAvgTime))}
          ${statTile("Bounce rate", `${Math.round(bounceRate)}%`, deltaPill(bounceRate, prevBounceRate, true))}
        </tr></table>
      </td>
    </tr>
    ${metricSection("Top pages", pages)}
    ${metricSection("Top referrers", referrers)}
    <tr>
      <td style="padding:22px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${metricColumn("Browsers", browsers, { labelFor: capitalize, emptyLabel: "(unknown)", truncateMax: 18 })}
          ${metricColumn("Devices", devices, { labelFor: capitalize, emptyLabel: "(unknown)", truncateMax: 18 })}
        </tr></table>
      </td>
    </tr>
    ${metricSection("Countries", countries, { labelFor: countryName, emptyLabel: "(unknown)" })}
    <tr>
      <td style="padding:26px 32px 28px;">
        <div style="border-top:1px solid ${line};padding-top:16px;">
          <p style="margin:0;font-size:12px;color:${ink.muted};font-family:${FONT};">Sent by <a href="https://github.com/sirlisko/umami-digest" style="color:${ink.primary};text-decoration:none;font-family:${FONT};">umami-digest</a></p>
        </div>
      </td>
    </tr>
  </table>
</div>`;
}
