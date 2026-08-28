import type { Env } from "./types";

export async function send(env: Env, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.REPORT_FROM,
      to: env.REPORT_TO,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`resend → ${res.status} ${await res.text()}`);
}
