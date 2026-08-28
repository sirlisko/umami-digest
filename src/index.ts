import { render } from "./email";
import { send } from "./resend";
import type { Env } from "./types";
import { collect } from "./umami";

export type { Env };

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const data = await collect(env);
    const subject = `${data.siteName} — ${data.days === 1 ? "daily" : "weekly"} analytics`;
    await send(env, subject, render(data));
  },
};
