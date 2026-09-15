import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, AIProvider } from "./ai-provider_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin']);

    const setting = await db
      .selectFrom("platformSettings")
      .where("settingKey", "=", "ai_provider")
      .select("settingValue")
      .executeTakeFirst();

    // Default to 'openai' if the setting is not found or invalid
    let aiProvider: AIProvider = "openai";
    if (
      setting &&
      (setting.settingValue === "openai" || setting.settingValue === "deepseek")
    ) {
      aiProvider = setting.settingValue as AIProvider;
    }

    const responseData: OutputType = {
      aiProvider,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    };

    return new Response(superjson.stringify(responseData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to get AI provider setting:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}