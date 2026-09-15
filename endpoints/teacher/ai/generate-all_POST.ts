import { schema, OutputType } from "./generate-all_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { startAiGenerationLog, completeAiGenerationLog } from "../../../helpers/aiGenerationLog";

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

    const systemInstruction =
      "You are an expert educational content writer for Testkart, India's largest marketplace for competitive exam preparation materials. You help teachers create compelling product listings.";

    let fieldsInstruction = "";
    switch (input.contentType) {
      case "product":
        fieldsInstruction = `title, shortDescription, description (HTML with bullet points, bold, structured), examName, category (one of "Study Material", "Question Bank", "Notes", "eBooks", "Practice Papers", "Reference Material", "Other"), language, tags, suggestedPrice`;
        break;
      case "test":
        fieldsInstruction = `title, shortDescription (short bio for card), description (detailed description in HTML), examName, language, tags, suggestedPrice`;
        break;
      case "course":
        fieldsInstruction = `title, shortDescription, description (HTML with bullet points), category (e.g. "General" or relevant category), level ("beginner" | "intermediate" | "advanced"), language, tags, suggestedPrice`;
        break;
      case "liveTest":
        fieldsInstruction = `title, shortDescription, description (HTML), examName, language, tags, suggestedPrice, durationMinutes (e.g. 60, 90, 120, 180)`;
        break;
      case "bundle":
        fieldsInstruction = `title, shortDescription, description (HTML), tags, suggestedPrice. Use the provided bundleItemTitles as context for what the bundle contains.`;
        break;
    }

    const jsonSchema = `{
  "title": "string (SEO-friendly product title, 40-60 characters, ideally under 60. Plain, natural phrasing a student would search for - e.g. 'SSC CGL Tier 1 Mock Test Series 2026'. Do NOT stuff it with pipe-separated keyword lists, repeat the exam name more than once, or append phrases like 'Complete Practice Set | NCERT-Based | 2026 Exam Preparation'. One clear, concise noun phrase only.)",
  "shortDescription": "string (max 200 chars, plain text)",
  "description": "string (HTML formatted for rich text editor)",
  "examName": "string (optional, detected exam name like 'UPSC CSE', 'SSC CGL', etc.)",
  "category": "string (optional)",
  "language": "string (optional, e.g. 'English', 'Hindi')",
  "tags": ["string"] (optional array of strings),
  "suggestedPrice": number (optional, reasonable price in INR),
  "level": "string" (optional),
  "durationMinutes": number (optional)
}`;

    const userMessageContent = `
Task: Generate content fields based on the teacher's prompt. 
Output ONLY valid JSON matching the exact schema below. Do not wrap it in markdown code blocks (\`\`\`json) or include any extra text.

JSON Schema:
${jsonSchema}

Requested Fields to populate based on content type: ${fieldsInstruction}

Teacher Prompt: "${input.prompt}"
Content Type: ${input.contentType}
${input.bundleItemTitles ? `Bundle Item Titles: ${input.bundleItemTitles.join(", ")}` : ""}
`.trim();

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system" as const, content: systemInstruction },
      { role: "user" as const, content: userMessageContent },
    ];

    aiLogStartedAt = Date.now();
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "generate_all", {
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

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify(parsedResult satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Generate All error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}