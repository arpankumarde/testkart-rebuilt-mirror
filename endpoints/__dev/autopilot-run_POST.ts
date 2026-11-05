import { getAutopilotSettings } from "../../helpers/getAutopilotSettings";
import { runAutopilotEngine } from "../../helpers/autopilotEngine";

/** Dev-only (never published): one autopilot engine pass, to test it in the preview. */
export async function handle(): Promise<Response> {
  const settings = await getAutopilotSettings();
  if (!settings.shadow) {
    return new Response(JSON.stringify({ error: "Refusing to run outside shadow mode from a dev endpoint" }), { status: 400 });
  }
  await runAutopilotEngine();
  return new Response(JSON.stringify({ ok: true, settings: { enabled: settings.enabled, shadow: settings.shadow } }));
}