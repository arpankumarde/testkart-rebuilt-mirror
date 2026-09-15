import { schema, OutputType } from "./rewrite_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { startAiGenerationLog, completeAiGenerationLog } from '../../../helpers/aiGenerationLog';

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

    // Use DeepSeek API directly (no @floot/ai)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DeepSeek API key is not configured.");
      return new Response(
        superjson.stringify({ error: "DeepSeek API key is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let systemInstruction =
    "You are an expert educational content writer for Testkart, an Indian online marketplace for competitive exam preparation.";
    let taskInstruction = "";

    switch (input.field) {
      case "title":
        taskInstruction =
        "Rewrite/improve this title to be more professional, SEO-friendly, and engaging for Indian exam aspirants. Keep it concise (under 100 chars). If currentValue is empty, generate a title from the context. Output ONLY the title text, no quotes or extra formatting.";
        break;
      case "description":
        taskInstruction =
        "Generate a compelling, detailed description in HTML format suitable for a rich text editor. Include what's covered, who it's for, and key highlights. Use bullet points and bold text. If currentValue is provided, improve it. Keep it relevant to the Indian competitive exam context. Output ONLY valid HTML, no markdown wrappers like ```html.";
        break;
      case "shortDescription":
        taskInstruction =
        "Generate a concise summary (max 200 chars) that captures the key value proposition. Plain text only, no HTML. Output ONLY the summary text.";
        break;
      case "questionText":
        taskInstruction =
        "This is an exam question's text (HTML from a rich text editor, may contain <span data-type=\"inline-math\" data-latex=\"...\"></span> or similar math markup elements). Improve grammar, clarity, and precision only — do not change what is being asked, do not change any numbers or the meaning, and do not alter the correct answer in any way. CRITICAL: any <span> tags carrying data-latex/data-math/data-type attributes must be preserved character-for-character, exactly where they appear — never edit, remove, or rephrase their attributes or add new ones. Output ONLY the improved HTML, no markdown wrappers, no commentary.";
        break;
      case "explanation":
        taskInstruction =
        "Write a clear, step-by-step explanation of why the correct answer to this exam question is correct, suitable for a student reviewing their attempt after a mock test. Use the question text, options, and correct answer given in the context. Keep it concise (3-5 sentences) and output as simple HTML (a paragraph, optionally with a short <ul> of steps) — no markdown wrappers, no commentary, no restating the full question.";
        break;
    }

    const contextStr = Object.entries(input.context || {}).
    filter(([_, v]) => v !== undefined && v !== null && v !== "").
    map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).
    join("\n");

    const userMessageContent = `
Task: ${taskInstruction}

Content Type: ${input.contentType}

Context Information:
${contextStr || "None provided"}

Current Value:
${input.currentValue || "(Empty)"}
    `.trim();

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system" as const, content: systemInstruction },
      { role: "user" as const, content: userMessageContent },
    ];

    aiLogStartedAt = Date.now();
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "rewrite", {
      field: input.field,
      contentType: input.contentType,
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
    const suggestion = aiResponse.choices?.[0]?.message?.content || "";

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ suggestion: suggestion.trim() } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Rewrite error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}