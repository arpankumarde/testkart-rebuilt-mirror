import { schema, OutputType } from "./analyze-pdf_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { startAiGenerationLog, completeAiGenerationLog } from "../../../helpers/aiGenerationLog";

const VALID_CATEGORIES = ["Study Material", "Question Bank", "Notes", "eBooks", "Practice Papers", "Reference Material", "Other"];

export async function handle(request: Request) {
  let aiLogId: number | null = null;
  let aiLogStartedAt: number | null = null;
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized access" }), {
        status: 403,
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DeepSeek API key is not configured.");
      return new Response(
        superjson.stringify({ error: "DeepSeek API key is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Cap defensively — the client already truncates, but never trust it.
    const excerpt = input.extractedText.slice(0, 8000);

    const systemInstruction =
      "You are an assistant that classifies competitive-exam study material for Testkart, India's largest marketplace for exam prep content. You read an excerpt of a PDF a teacher uploaded and infer metadata for the listing. Be conservative — only infer an exam name if the excerpt clearly names one; leave it out otherwise.";

    const userMessageContent = `
Task: Based on the PDF excerpt below, suggest listing metadata. Output ONLY valid JSON matching the exact schema below. Do not wrap it in markdown code blocks or include any extra text.

JSON Schema:
{
  "category": "string (optional, must be exactly one of: ${VALID_CATEGORIES.join(", ")})",
  "tags": ["string"] (optional, 3-6 short lowercase topical tags),
  "examName": "string (optional, only if a specific competitive exam like 'SSC CGL', 'UPSC CSE', 'NEET' is clearly identifiable)"
}

${input.title ? `Product Title: "${input.title}"` : ""}
PDF Excerpt:
"""
${excerpt}
"""
`.trim();

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system" as const, content: systemInstruction },
      { role: "user" as const, content: userMessageContent },
    ];

    aiLogStartedAt = Date.now();
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "generate_all", {
      contentType: "product-pdf-analysis",
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
    let responseText = aiResponse.choices?.[0]?.message?.content || "";
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let parsedResult: OutputType;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON.");
    }

    // Defensively coerce category to one of the known values only.
    if (parsedResult.category && !VALID_CATEGORIES.includes(parsedResult.category)) {
      parsedResult.category = undefined;
    }
    if (parsedResult.tags && !Array.isArray(parsedResult.tags)) {
      parsedResult.tags = undefined;
    }

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify(parsedResult satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Analyze PDF error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
