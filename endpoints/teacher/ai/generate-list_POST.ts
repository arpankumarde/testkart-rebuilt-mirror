import { schema, OutputType } from "./generate-list_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { startAiGenerationLog, completeAiGenerationLog } from '../../../helpers/aiGenerationLog';

// Parses the model's reply into a clean string array. The prompt asks for a
// strict JSON array, but models occasionally wrap it in a markdown fence or
// (rarely) fall back to a plain bullet/numbered list — handle both so a
// formatting quirk doesn't surface as a hard failure to the teacher.
function parseListResponse(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim());
    }
  } catch {
    // Fall through to line-based parsing below.
  }

  return cleaned
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0);
}

export async function handle(request: Request) {
  let aiLogId: number | null = null;
  let aiLogStartedAt: number | null = null;
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DeepSeek API key is not configured.");
      return new Response(
        superjson.stringify({ error: "DeepSeek API key is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemInstruction =
      "You are an expert educational content writer for Testkart, an Indian online marketplace for competitive exam preparation. You always reply with ONLY a valid JSON array of strings — no markdown, no commentary, no keys, just the array.";

    const taskInstruction =
      input.field === "whatYouLearn"
        ? "Generate 4-6 short, specific bullet points (each under 90 characters) describing what a student will master by taking this test series. Base them on the test's title, description, and subjects. Avoid generic filler — tie each point to the actual exam/subject content. Do not repeat any of the existing items provided."
        : "Generate 2-4 short bullet points (each under 90 characters) listing realistic prerequisites or requirements a student should have before taking this test series (e.g. prior syllabus coverage, a device to take the test, basic familiarity with the subject). Keep them practical, not generic. Do not repeat any of the existing items provided.";

    const contextStr = Object.entries(input.context || {})
      .filter(([_, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");

    const userMessageContent = `
Task: ${taskInstruction}

Context Information:
${contextStr || "None provided"}

Output ONLY a JSON array of strings, e.g. ["First point", "Second point"].
    `.trim();

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system" as const, content: systemInstruction },
      { role: "user" as const, content: userMessageContent },
    ];

    aiLogStartedAt = Date.now();
    // Logged under the "rewrite" feature bucket (like other small storefront
    // AI assists) with a requestMeta.field discriminator, to avoid touching
    // the admin AI-usage UI's feature-label maps for what's a close cousin
    // of the existing rewrite flow.
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "rewrite", {
      field: input.field,
      contentType: "test",
    });

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API Error: ${response.status}`, errorText);
      await completeAiGenerationLog(aiLogId, "failed", {
        errorMessage: `DeepSeek API Error ${response.status}: ${response.statusText}`,
        startedAt: aiLogStartedAt,
      });
      return new Response(
        superjson.stringify({ error: `Failed to call DeepSeek API: ${response.statusText}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || "[]";
    const items = parseListResponse(rawContent).slice(0, 6);

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ items } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Generate List error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
