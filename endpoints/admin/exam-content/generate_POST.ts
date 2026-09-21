import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./generate_POST.schema";
import superjson from "superjson";
import { ADMIN_EXAM_SECTION_META, type FaqItem } from "../../../helpers/examContentTypes";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";
import { setExamOwnerToEditor } from "../../../helpers/examOwner";

// Parses the model's FAQ reply into clean {question, answer} pairs. Mirrors
// the tolerant parsing used for the teacher-facing "generate list" AI
// feature (endpoints/teacher/ai/generate-list_POST.ts) — strips a markdown
// fence if the model added one, falls back gracefully on malformed JSON.
function parseFaqResponse(raw: string): FaqItem[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (v): v is FaqItem =>
            v && typeof v === "object" && typeof v.question === "string" && typeof v.answer === "string"
        )
        .map((v) => ({ question: v.question.trim(), answer: v.answer.trim() }))
        .filter((v) => v.question.length > 0 && v.answer.length > 0);
    }
  } catch {
    // fall through — malformed JSON, return nothing rather than guess.
  }
  return [];
}

function stripHtmlFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const target = input.target;

    const exam = await db
      .selectFrom("exams")
      .innerJoin("examCategories", "exams.categoryId", "examCategories.id")
      .select([
        "exams.id",
        "exams.examName",
        "exams.fullName",
        "exams.description",
        "examCategories.categoryName",
      ])
      .where("exams.id", "=", input.examId)
      .executeTakeFirst();

    if (!exam) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DeepSeek API key is not configured.");
      return new Response(
        superjson.stringify({ error: "DeepSeek API key is not configured." }),
        { status: 500 }
      );
    }

    const meta = ADMIN_EXAM_SECTION_META[input.pageType];
    const examLabel = exam.fullName || exam.examName;

    const systemInstruction =
      "You are an expert exam-prep content writer for Testkart, an Indian online marketplace for competitive exam preparation. " +
      "You write accurate, well-organized, evergreen content for exam information pages. " +
      "CRITICAL: never invent specific numbers, dates, marks, cutoff scores, age limits, or fees you are not confident about — " +
      "write qualitatively/structurally instead, and where precision genuinely matters, add a short note telling the reader to verify against the exam's official notification. " +
      "This content will be reviewed by a human editor before publishing, but it must never present a fabricated fact as if it were certain.";

    let taskInstruction = "";

    if (target === "faqs") {
      switch (input.pageType) {
        case "overview":
          taskInstruction = `Generate 5-6 general FAQs about ${examLabel} as a whole — what the exam is, who should take it, how it's broadly structured, and how mock tests/practice help with preparation. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "syllabus":
          taskInstruction = `Generate 3-4 FAQs specific to the SYLLABUS of ${examLabel} — e.g. which topics carry more weight, how the syllabus differs across stages/tiers if relevant, how to prioritize topics. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "exam_pattern":
          taskInstruction = `Generate 3-4 FAQs specific to the EXAM PATTERN of ${examLabel} — e.g. negative marking, sectional timing, mode of exam, aids allowed. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "eligibility":
          taskInstruction = `Generate 3-4 FAQs specific to ELIGIBILITY for ${examLabel} — e.g. age relaxations for reserved categories, number of attempts, qualification equivalence. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "cutoff":
          taskInstruction = `Generate 3-4 FAQs specific to CUTOFFS for ${examLabel} — e.g. why cutoffs vary by category/year, how normalization works, what "a good score" typically depends on — without citing specific numeric cutoffs. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "mock_tests":
          taskInstruction = `Generate 3-4 FAQs a student would have before buying a MOCK TEST for ${examLabel} — e.g. how many mock tests are enough, how to review mistakes, how mock test difficulty compares to the real exam, how to use them for time management practice. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "courses":
          taskInstruction = `Generate 3-4 FAQs a student would have before enrolling in an online COURSE for ${examLabel} — e.g. how a structured course differs from self-study, what to look for in a good course, how much time to budget. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "study_notes":
          taskInstruction = `Generate 3-4 FAQs a student would have before buying STUDY NOTES/PDFs for ${examLabel} — e.g. how notes complement mock tests and courses, what makes good exam notes, how to use them for quick revision. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
        case "bundles":
          taskInstruction = `Generate 3-4 FAQs a student would have before buying a BUNDLE (combo of tests/courses/notes) for ${examLabel} — e.g. why bundles are usually better value, what a good bundle should include, how to check a bundle covers what they need. Output ONLY a JSON array of objects with "question" and "answer" string fields — no markdown, no commentary, no wrapper object.`;
          break;
      }
    } else {
      switch (input.pageType) {
        case "overview":
          taskInstruction = `Write a general overview page for ${examLabel} (category: ${exam.categoryName}) — what the exam is, who conducts it, who should take it, and a brief outline of how candidates typically prepare (e.g. the role of mock tests and practice). Keep it introductory and welcoming, not a duplicate of the syllabus/pattern/eligibility/cutoff pages. Use <h3> subheadings and <p>/<ul><li> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "syllabus":
          taskInstruction = `Write a syllabus page for ${examLabel} (category: ${exam.categoryName}). Organize by subject/section using <h3> subheadings, with <ul><li> topic lists under each. Cover the major sections/subjects typically part of this exam. Output ONLY HTML (h3, p, ul, li, strong) — no markdown, no <html>/<body> wrapper, no commentary.`;
          break;
        case "exam_pattern":
          taskInstruction = `Write an exam pattern page for ${examLabel}. Describe the typical structure: number of sections/papers, question types, general duration, and marking scheme approach (e.g. whether negative marking is typical for this category of exam) — described qualitatively, not with invented precise figures. Use <h3> subheadings and <ul><li> or a <table> where it aids clarity. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "eligibility":
          taskInstruction = `Write an eligibility criteria page for ${examLabel}, covering the typical categories of criteria (educational qualification, age-limit considerations, nationality, number of attempts if relevant to this exam category) at a general level. Use <h3> subheadings and <ul><li> lists. Include one short paragraph noting that exact criteria vary by notification/year and should be verified officially. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "cutoff":
          taskInstruction = `Write a page explaining how cutoffs work for ${examLabel} — what a cutoff is, what factors typically influence it (difficulty of that year's paper, number of vacancies, category-wise reservation, total applicants), and how a student should interpret past trends. Do NOT invent specific numeric cutoff marks or scores. Use <h3> subheadings and <p>/<ul> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "mock_tests":
          taskInstruction = `Write supporting content for the MOCK TESTS listing page for ${examLabel} (category: ${exam.categoryName}) — shown below the actual mock test listings. Explain why mock tests matter for this exam, how to use them effectively (timed attempts, error analysis, gradually increasing difficulty), and what to look for in a good mock test series. Do not claim any specific number of tests exists on the site. Use <h3> subheadings and <p>/<ul><li> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "courses":
          taskInstruction = `Write supporting content for the COURSES listing page for ${examLabel} (category: ${exam.categoryName}) — shown below the actual course listings. Explain what a structured course adds over self-study for this exam, how to evaluate a course (curriculum coverage, instructor experience, doubt support), and who benefits most from a course vs. self-study. Do not claim any specific number of courses exists on the site. Use <h3> subheadings and <p>/<ul><li> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "study_notes":
          taskInstruction = `Write supporting content for the STUDY NOTES listing page for ${examLabel} (category: ${exam.categoryName}) — shown below the actual study notes listings. Explain how good notes/PDFs help with quick revision and last-mile preparation for this exam, what makes notes worth buying, and how to combine them with mock tests. Do not claim any specific number of notes exists on the site. Use <h3> subheadings and <p>/<ul><li> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
        case "bundles":
          taskInstruction = `Write supporting content for the BUNDLES listing page for ${examLabel} (category: ${exam.categoryName}) — shown below the actual bundle listings. Explain the value of bundling mock tests, courses, and notes together for this exam (cost savings, coherent preparation plan), and what a student should check before buying a bundle. Do not claim any specific number of bundles exists on the site. Use <h3> subheadings and <p>/<ul><li> content. Output ONLY HTML — no markdown, no wrapper tags, no commentary.`;
          break;
      }
    }

    const contextLines = [exam.description ? `Existing short description: ${exam.description}` : null].filter(
      Boolean
    );

    const userMessageContent = `
Task: ${taskInstruction}

Exam: ${examLabel}
Category: ${exam.categoryName}
${contextLines.length > 0 ? contextLines.join("\n") : ""}
    `.trim();

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userMessageContent },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API Error: ${response.status}`, errorText);
      return new Response(
        superjson.stringify({ error: `Failed to call DeepSeek API: ${response.statusText}` }),
        { status: 500 }
      );
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || "";

    // The API can return 200 with an empty/whitespace-only completion (rate
    // limiting, a moderation refusal, a truncated response, etc). Silently
    // saving that as "successful" content/FAQs looks to the admin like it
    // worked while actually wiping out the field — this is the exact bug
    // that caused published exam sections to end up with FAQs but no body
    // content. Fail loudly instead so the admin can retry.
    if (target === "content" && stripHtmlFence(rawContent).length === 0) {
      console.error("[admin/exam-content/generate_POST] DeepSeek returned empty content", {
        examId: input.examId,
        pageType: input.pageType,
        rawResponse: JSON.stringify(aiResponse).slice(0, 500),
      });
      return new Response(
        superjson.stringify({ error: "AI returned empty content — nothing was saved. Please try again." }),
        { status: 502 }
      );
    }
    if (target === "faqs" && parseFaqResponse(rawContent).length === 0) {
      console.error("[admin/exam-content/generate_POST] DeepSeek returned no parseable FAQs", {
        examId: input.examId,
        pageType: input.pageType,
        rawResponse: JSON.stringify(aiResponse).slice(0, 500),
      });
      return new Response(
        superjson.stringify({ error: "AI returned no usable FAQs — nothing was saved. Please try again." }),
        { status: 502 }
      );
    }

    // Read whatever's already saved for this section so generating one
    // target (content vs faqs) never clobbers the other.
    const existing = await db
      .selectFrom("examContentPages")
      .selectAll()
      .where("examId", "=", input.examId)
      .where("pageType", "=", input.pageType)
      .executeTakeFirst();

    const defaultTitle = `${examLabel} ${meta.titleSuffix}`;
    // SEOHead already appends " | Testkart" to whatever title it's given, so
    // the seoTitle default here must NOT include the suffix itself.
    const defaultSeoDescription = `${meta.titleSuffix} for ${examLabel} — updated by Testkart.`;

    const finalValues =
      target === "faqs"
        ? {
            title: existing?.title || defaultTitle,
            seoTitle: existing?.seoTitle || defaultTitle,
            seoDescription: existing?.seoDescription || defaultSeoDescription,
            content: existing?.content ?? null,
            faqItems: parseFaqResponse(rawContent) as any,
          }
        : {
            title: defaultTitle,
            seoTitle: defaultTitle,
            seoDescription: defaultSeoDescription,
            content: stripHtmlFence(rawContent),
            faqItems: (existing?.faqItems ?? null) as any,
          };

    const saved = await db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("examContentPages")
        .values({
          examId: input.examId,
          pageType: input.pageType,
          ...finalValues,
          source: "ai",
          aiGeneratedAt: new Date(),
          status: "draft",
        })
        .onConflict((oc) =>
          oc.columns(["examId", "pageType"]).doUpdateSet({
            ...finalValues,
            source: "ai",
            aiGeneratedAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();
      await setExamOwnerToEditor(trx, input.examId, admin.id);
      return row;
    });

    const withReviewer = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.id", "=", saved.id)
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ page: mapExamContentRow(withReviewer) } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/generate_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
