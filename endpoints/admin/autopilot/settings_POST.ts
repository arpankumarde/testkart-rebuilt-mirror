import { randomBytes } from "crypto";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  AUTOPILOT_SETTINGS_KEY,
  getAutopilotSettings,
  normalizeAutopilotSettings,
} from "../../../helpers/getAutopilotSettings";
import { schema, OutputType } from "./settings_POST.schema";

/**
 * Admin (autopilot module): the kill switch, shadow mode and the AI provider
 * for the autopilot's own AI (DeepSeek or Floot AI). The holdout salt
 * is created once, the first time settings are saved, and never changed here,
 * so holdout membership stays fixed for the life of the autopilot.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const current = await getAutopilotSettings();
    const next = normalizeAutopilotSettings({
      ...current,
      holdoutSalt: current.holdoutSalt || randomBytes(16).toString("hex"),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.shadow !== undefined ? { shadow: input.shadow } : {}),
      ...(input.aiProvider !== undefined ? { aiProvider: input.aiProvider } : {}),
    });

    const value = JSON.stringify(next);
    const updated = await db
      .updateTable("platformSettings")
      .set({ settingValue: value })
      .where("settingKey", "=", AUTOPILOT_SETTINGS_KEY)
      .returning("id")
      .executeTakeFirst();
    if (!updated) {
      await db.insertInto("platformSettings").values({ settingKey: AUTOPILOT_SETTINGS_KEY, settingValue: value }).execute();
    }

    console.log(
      `Autopilot settings changed by admin ${admin.id}: enabled=${next.enabled} shadow=${next.shadow} ai=${next.aiProvider}`
    );
    return new Response(
      superjson.stringify({ enabled: next.enabled, shadow: next.shadow, aiProvider: next.aiProvider } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the autopilot settings";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}