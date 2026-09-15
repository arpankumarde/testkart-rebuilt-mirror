import { schema } from "./generate-ai_POST.schema";
import { db } from '../../../helpers/db';
import { getServerUserSession } from '../../../helpers/getServerUserSession';

import { z } from "zod";
import { AiResponseSchema, GeneratedQuestionDraft, OutputType } from "./generate-ai_POST.schema";
import { startAiGenerationLog, completeAiGenerationLog } from '../../../helpers/aiGenerationLog';

function convertLatexToTiptap(text: string): string {
  // Convert inline LaTeX \(...\) to Tiptap math spans
  let convertedText = text.replace(/\\\((.*?)\\\)/g, (match, math) => {
    return `<span data-type="mathematics" data-math="${math.replace(/"/g, '&quot;')}"></span>`;
  });
  // Convert display LaTeX \[...\] to Tiptap math spans
  convertedText = convertedText.replace(/\\\[(.*?)\\\]/g, (match, math) => {
    return `<span data-type="mathematics" data-math="${math.replace(/"/g, '&quot;')}"></span>`;
  });
  return convertedText;
}

// The model is told to emit LaTeX, and LaTeX is full of backslashes ("\(", "\frac",
// "\ne"). Inside a JSON string those are invalid escape sequences, so a response
// that is otherwise perfect fails JSON.parse with "Bad escaped character in JSON".
// Doubling the backslashes recovers the intended literal text, which is exactly
// what convertLatexToTiptap expects.
//
// Two rules, both learned from real DeepSeek responses:
//
// 1. A valid escape is consumed as a UNIT via the first alternative, so an
//    already-correct "\\" is skipped whole. Matching backslashes one at a time
//    instead corrupts "\\(" into "\\\(" — a valid document turned invalid,
//    which is how a live generation failed with "Bad escaped character at
//    position 59". Responses routinely mix correct "\\(" with one stray escape,
//    so the repair must leave the correct parts alone.
//
// 2. \n \t \r \b \f are deliberately NOT treated as valid here, even though
//    JSON says they are. This function only runs on a payload that already
//    failed to parse — one the model wrote with raw LaTeX — where those bytes
//    are "\ne", "\times", "\rightarrow", "\binom" and "\frac" far more often
//    than control characters. Sparing them silently turns \frac into "rac".
function repairLatexEscapes(jsonString: string): string {
  return jsonString.replace(
    /\\(["\\/]|u[0-9a-fA-F]{4})|\\/g,
    (match, validEscape) => (validEscape ? match : "\\\\")
  );
}

// Walks the text and returns each balanced top-level {...} block, tracking
// string/escape state so braces inside question text don't confuse it. This is
// what lets a TRUNCATED response still yield questions: the model sometimes
// rambles inside "explanation" (thousands of characters of self-correction),
// exhausts the token budget and cuts off mid-string, leaving the array
// unclosed. The objects that did finish are perfectly good questions.
function extractCompleteObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

// Tries, in order: parse as-is; parse with LaTeX escapes repaired; salvage the
// individual objects that completed. Returns raw values for zod to validate.
function parseAiQuestions(content: string): unknown[] {
  const open = content.indexOf("[");
  const close = content.lastIndexOf("]");

  if (open !== -1 && close > open) {
    const slice = content.substring(open, close + 1);
    for (const candidate of [slice, repairLatexEscapes(slice)]) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through to the next strategy
      }
    }
  }

  const region = repairLatexEscapes(open !== -1 ? content.substring(open) : content);
  const salvaged: unknown[] = [];
  for (const block of extractCompleteObjects(region)) {
    try {
      salvaged.push(JSON.parse(block));
    } catch {
      // skip the one block that didn't survive
    }
  }
  return salvaged;
}

export async function handle(request: Request) {
  let aiLogId: number | null = null;
  let aiLogStartedAt: number | null = null;
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only teachers can generate AI questions." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const input = schema.parse(body);
    const { 
      subjectId, 
      examName, 
      subjectName, 
      numberOfQuestions, 
      customPrompt,
      chapterTopic,
      syllabus,
      questionType,
      positiveMarks,
      negativeMarks,
      language,
      includeExplanation
    } = input;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "DeepSeek API key is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify ownership through testItemSubjects -> mockTestItems -> mockTests.
    // Nothing is written here, but generation still costs an AI call, so the
    // caller must own the subject they are generating for.
    const subjectAndOwner = await db
      .selectFrom("testItemSubjects")
      .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select([
        "mockTests.teacherId",
        "mockTests.id as mockTestId",
        "mockTestItems.id as testItemId",
        "testItemSubjects.subjectName",
      ])
      .where("testItemSubjects.id", "=", subjectId)
      .executeTakeFirst();

    if (!subjectAndOwner) {
      return new Response(
        JSON.stringify({ error: "Subject not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (subjectAndOwner.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "You do not own this subject" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get syllabus topics for the exam subject
    const subjectInfo = await db
      .selectFrom("examSubjects")
      .select("syllabusTopics")
      .where("id", "=", subjectId)
      .executeTakeFirst();

    let questionFormatInstruction = "";
    if (questionType === "single_correct_mcq") {
      questionFormatInstruction = `Generate multiple-choice questions with 4 options (A, B, C, D) and a single correct option. The JSON structure must be: { "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctOption": "A" | "B" | "C" | "D"${includeExplanation ? ', "explanation": "..."' : ''} }`;
    } else if (questionType === "multiple_correct_mcq") {
      questionFormatInstruction = `Generate multiple-choice questions with 4 options (A, B, C, D) and multiple correct options (at least 2 correct). The JSON structure must be: { "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctOptions": ["A", "C"]${includeExplanation ? ', "explanation": "..."' : ''} }`;
    } else if (questionType === "numerical") {
      questionFormatInstruction = `Generate numerical answer questions with no options. The JSON structure must be: { "questionText": "...", "numericalAnswer": number, "numericalTolerance": number${includeExplanation ? ', "explanation": "..."' : ''} }`;
    }

    let languageInstruction = "";
    if (language === "hindi") {
      languageInstruction = "Generate the questions and options in Hindi (Devanagari script).";
    } else if (language === "bilingual") {
      languageInstruction = "Generate the questions and options in both English and Hindi (English first, then Hindi translation).";
    } else {
      languageInstruction = "Generate the questions and options in English.";
    }

    const systemPrompt = `You are an expert question creator for competitive exams. Your task is to generate high-quality questions.

Instructions:
1. Generate exactly ${numberOfQuestions} questions. The array you return MUST contain exactly ${numberOfQuestions} objects — no fewer.
2. The exam is: "${examName}".
3. The subject is: "${subjectName}".
${chapterTopic ? `4. The specific chapter/topic is: "${chapterTopic}".` : '4. No specific chapter/topic provided.'}
${syllabus ? `5. Focus specifically on the following syllabus topics: "${syllabus}".` : (subjectInfo?.syllabusTopics ? `5. The questions MUST cover the following topics/syllabus: "${subjectInfo.syllabusTopics}". This is a strict requirement.` : '5. No specific syllabus topics provided.')}
6. ${questionFormatInstruction}
7. ${languageInstruction}
${positiveMarks !== undefined && negativeMarks !== undefined ? `8. Each question carries ${positiveMarks} marks with ${negativeMarks} negative marks for a wrong answer. Set the difficulty level accordingly.` : ''}
9. Format all mathematical equations and symbols using LaTeX. Use \\(...\\) for inline math and \\[...\\] for display math.
${customPrompt ? `10. Follow this additional instruction: "${customPrompt}"` : ''}
11. Your entire response MUST be a single valid JSON array of objects, with no other text before or after the array.
12. Decide each answer BEFORE you write it. Never reason, re-derive or second-guess inside a field — no "wait", no "let me reconsider", no working-out. If unsure, discard that question and write a different one you are sure of.
13. Keep every "explanation" under 60 words and every option under 25 words. Explanations are for the student, not a derivation log.`;

    aiLogStartedAt = Date.now();
    aiLogId = await startAiGenerationLog(effectiveTeacherId, "question_generation", {
      examName,
      subjectName,
      numberOfQuestions,
      questionType,
      language,
      hasCustomPrompt: !!customPrompt,
    });

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${numberOfQuestions} questions.` }
        ],
        // Roughly 700 tokens per question plus headroom, capped so one runaway
        // explanation can't burn the whole budget and truncate the array.
        max_tokens: Math.min(8000, 700 * numberOfQuestions + 1000),
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
        JSON.stringify({ error: `Failed to call DeepSeek API: ${response.statusText}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const accumulatedContent = aiResponse.choices[0]?.message?.content || "";
    console.log("[generate-ai] Raw AI response (first 2000 chars):", accumulatedContent.substring(0, 2000));

    let generatedQuestions: z.infer<typeof AiResponseSchema> = [];

    try {
      const candidates = parseAiQuestions(accumulatedContent);
      if (candidates.length === 0) {
        throw new Error("AI response did not contain any parsable question objects.");
      }

      // Validate per item rather than all-or-nothing: a salvaged response can
      // carry one malformed object, and dropping it beats losing the batch.
      generatedQuestions = candidates
        .map((c) => AiResponseSchema.element.safeParse(c))
        .filter((r): r is { success: true; data: z.infer<typeof AiResponseSchema>[number] } => r.success)
        .map((r) => r.data);

      if (generatedQuestions.length === 0) {
        throw new Error("No question object matched the expected shape.");
      }
      if (generatedQuestions.length < candidates.length) {
        console.warn(
          `[generate-ai] Dropped ${candidates.length - generatedQuestions.length} malformed question object(s) of ${candidates.length}`
        );
      }
    } catch (e) {
            const parseErrorMsg = e instanceof Error ? e.message : String(e);
      console.error("Error parsing AI response:", parseErrorMsg, "Raw content (first 1000):", accumulatedContent.substring(0, 1000));
      await completeAiGenerationLog(aiLogId, "failed", {
        errorMessage: `Failed to parse AI response: ${parseErrorMsg}`,
        startedAt: aiLogStartedAt,
      });
      return new Response(
                JSON.stringify({ error: "Failed to parse AI response. The AI did not return valid JSON." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (generatedQuestions.length === 0) {
      await completeAiGenerationLog(aiLogId, "failed", {
        errorMessage: "AI returned an empty array of questions.",
        startedAt: aiLogStartedAt,
      });
      return new Response(
        JSON.stringify({ error: "Failed to generate any questions. The AI returned an empty array." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Shape the drafts exactly the way accept-ai will store them, so what the
    // teacher reviews is what lands in the test. Nothing is persisted here.
    const drafts: GeneratedQuestionDraft[] = generatedQuestions.map((q) => {
      const isMcq = questionType === "single_correct_mcq" || questionType === "multiple_correct_mcq";
      return {
        questionText: convertLatexToTiptap(q.questionText),
        questionType,
        optionA: isMcq ? convertLatexToTiptap(q.optionA || "") : null,
        optionB: isMcq ? convertLatexToTiptap(q.optionB || "") : null,
        optionC: isMcq ? convertLatexToTiptap(q.optionC || "") : null,
        optionD: isMcq ? convertLatexToTiptap(q.optionD || "") : null,
        correctOption: questionType === "single_correct_mcq" ? (q.correctOption ?? null) : null,
        correctOptions: questionType === "multiple_correct_mcq" ? (q.correctOptions ?? []) : null,
        numericalAnswer:
          questionType === "numerical" && q.numericalAnswer !== undefined
            ? Number(q.numericalAnswer)
            : null,
        numericalTolerance:
          questionType === "numerical"
            ? (q.numericalTolerance !== undefined ? Number(q.numericalTolerance) : 0)
            : null,
        explanation: includeExplanation && q.explanation ? convertLatexToTiptap(q.explanation) : null,
        positiveMarks: positiveMarks ?? null,
        negativeMarks: negativeMarks ?? null,
      };
    });

    console.log(
      `[generate-ai] Generated ${drafts.length} draft question(s) for review by teacher ${user.id} (requested ${numberOfQuestions})`
    );

    await completeAiGenerationLog(aiLogId, "done", { startedAt: aiLogStartedAt });

    const output: OutputType = {
      success: true,
      questionsGenerated: drafts.length,
      questions: drafts,
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Question Generation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    await completeAiGenerationLog(aiLogId, "failed", { errorMessage, startedAt: aiLogStartedAt });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
