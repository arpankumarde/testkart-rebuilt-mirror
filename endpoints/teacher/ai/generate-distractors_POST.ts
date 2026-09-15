import { schema, OutputType } from "./generate-distractors_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { startAiGenerationLog, completeAiGenerationLog } from "../../../helpers/aiGenerationLog";

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
      "You are an expert exam question writer for Testkart, an Indian online marketplace for competitive exam preparation. You write plausible but definitively incorrect answer options (distractors) for multiple-choice questions.";

    const existingList = input.existingOptionTexts.length > 0
      ? `\nOptions already in use (do not repeat these, do not repeat the correct answer either):\n${input.existingOptionTexts.map((o) => `- ${o}`).join("\n")}`
      : "";

    const userMessageContent = `
Question: ${input.questionText}

Correct answer: ${input.correctAnswerText}
${existingList}

Write exactly ${input.count} distractor option${input.count === 1 ? "" : "s"} — plausible, same format/style/units as the correct answer, but clearly and unambiguously wrong. A student who doesn't know the answer should find them believable; a student who does know it should immediately rule them out.

Output ONLY a JSON array of exactly ${input.count} string${input.count === 1 ? "" : "s"}, nothing else. No markdown, no commentary, no numbering. Example format: ["option one", "option two"]
    `.trim();

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system" as const, content: systemInstruction },
      { role: "user" as const, content: userMessageContent },
    ];

    aiLogStartedAt = Date.now();
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "rewrite", {
      field: "distractors",
      contentType: "test",
    });

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        stream: false,
      }),
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
    const rawContent: string = aiResponse.choices?.[0]?.message?.content || "";

    let distractors: string[] = [];
    try {
      // Model may wrap the array in a markdown code fence despite instructions — strip it defensively.
      const cleaned = rawContent.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        distractors = parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Fallback: split on newlines if the model didn't return valid JSON.
      distractors = rawContent
        .split("\n")
        .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean);
    }
    distractors = distractors.slice(0, input.count);

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ distractors } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Generate Distractors error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
