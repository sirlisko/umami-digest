import { render } from "./email";
import { send } from "./resend";
import { periodForCron } from "./schedule";
import type { Env } from "./types";
import { collect } from "./umami";

export type { Env };

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const period = periodForCron(controller.cron);
    const data = await collect(env, period);
    const subject = `${data.siteName} — ${period} analytics`;
    await send(env, subject, render(data));
  },
};
