import superjson from "superjson";
import { schema, OutputType, type InputType } from "./generate-quiz_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";
import { currentAffairsMeta } from "../../../helpers/currentAffairsMeta";
import type { CurrentAffairsQuestionInput } from "./save_POST.schema";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
/** Below this much text a digest cannot carry even one well-grounded question. */
const MIN_DIGEST_WORDS = 25;

const DIFFICULTY_BRIEF: Record<InputType["difficulty"], string> = {
  easy: "EASY: direct recall of a single stated fact (who, what, where, when).",
  medium: "MEDIUM: needs the reader to connect two stated facts or recognise a fact from a paraphrase.",
  hard: "HARD: needs careful reading - close distractors drawn from other facts in the digest, or combining details across an item. Still answerable only from the digest.",
};

/** Lowercase words only, so quotes survive punctuation and spacing differences. */
const normalize = (text: string) =>
  currentAffairsMeta
    .stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const itemText = (item: InputType["items"][number]) =>
  [item.headline, item.whyInNews, currentAffairsMeta.stripHtml(item.keyPoints), currentAffairsMeta.stripHtml(item.background)]
    .filter((part) => part.trim())
    .join("\n");

/** The quoted evidence must really be in the item: verbatim, or nearly every content word of it. */
const isGrounded = (evidence: string, source: string) => {
  const quote = normalize(evidence);
  const haystack = normalize(source);
  if (quote.length < 12) return false;
  if (haystack.includes(quote)) return true;
  const words = quote.split(" ").filter((w) => w.length > 3);
  if (words.length < 3) return false;
  const found = words.filter((w) => haystack.includes(w)).length;
  return found / words.length >= 0.85;
};

type RawQuestion = {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  explanation?: unknown;
  item?: unknown;
  evidence?: unknown;
};

const parseReply = (raw: string): { questions: RawQuestion[]; note: string | null } => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const note = typeof parsed?.note === "string" && parsed.note.trim() ? parsed.note.trim() : null;
    return { questions, note };
  } catch {
    return { questions: [], note: null };
  }
};

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const items = input.items.filter((item) => itemText(item).trim());
    const itemTexts = items.map(itemText);
    const overview = currentAffairsMeta.stripHtml(input.body);
    const totalWords = [...itemTexts, overview].join(" ").split(/\s+/).filter(Boolean).length;
    if (items.length === 0 || totalWords < MIN_DIGEST_WORDS) {
      return new Response(
        superjson.stringify({ error: "Add news items with a summary first - the quiz is written only from the digest's own content." }),
        { status: 422 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("[admin/current-affairs/generate-quiz] DEEPSEEK_API_KEY is not configured");
      return new Response(superjson.stringify({ error: "The AI service is not configured." }), { status: 500 });
    }

    const period = input.digestDate ? currentAffairsMeta.periodLabel(input.contentType, input.digestDate) : "";
    const digestText = [
      `DIGEST: ${input.title}${period ? ` (${period})` : ""}`,
      overview ? `OVERVIEW:\n${overview}` : "",
      ...items.map((_, index) => `ITEM ${index + 1}:\n${itemTexts[index]}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    const system =
      "You write multiple-choice quiz questions for Indian competitive exam aspirants (UPSC, SSC, banking) from a current affairs digest. " +
      "STRICT RULES: use ONLY facts stated in the digest text you are given. Never add outside knowledge, dates, numbers or names that are not in the digest. " +
      "Every question must be answerable from one item, and you must copy the supporting sentence or phrase from that item word for word as evidence. " +
      "Each question has exactly 4 options, exactly one correct; the wrong options must be plausible but clearly wrong according to the digest. " +
      "Do not use 'All of the above' or 'None of the above'. Keep explanations to one or two sentences that cite the digest's fact. " +
      "If the digest does not hold enough distinct facts for the number of questions asked, return fewer questions and say so in note - never pad or invent. " +
      "Reply with JSON only.";

    const user = [
      `Write ${input.count} question${input.count === 1 ? "" : "s"}.`,
      `Difficulty - ${DIFFICULTY_BRIEF[input.difficulty]}`,
      "Spread questions across different items where the content allows.",
      input.avoid.length > 0 ? `Do not repeat or closely rephrase these existing questions:\n- ${input.avoid.join("\n- ")}` : "",
      'Return: {"questions":[{"question":string,"options":[string,string,string,string],"correctIndex":0-3,"explanation":string,"item":item number,"evidence":exact text copied from that item}],"note":string or null}',
      `\n${digestText}`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        stream: false,
      }),
    });
    if (!response.ok) {
      console.error("[admin/current-affairs/generate-quiz] DeepSeek error", response.status, (await response.text()).slice(0, 500));
      return new Response(superjson.stringify({ error: "The AI service did not respond. Try again in a moment." }), { status: 502 });
    }

    const reply = await response.json();
    const { questions: raw, note } = parseReply(reply.choices?.[0]?.message?.content ?? "");

    // Keep only well-formed questions whose evidence is really in the cited item, without repeats.
    const seen = new Set(input.avoid.map(normalize));
    const accepted: CurrentAffairsQuestionInput[] = [];
    let rejected = 0;
    for (const candidate of raw) {
      if (accepted.length >= input.count) break;
      const question = typeof candidate.question === "string" ? candidate.question.trim() : "";
      const options = Array.isArray(candidate.options) ? candidate.options.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
      const correctIndex = typeof candidate.correctIndex === "number" ? candidate.correctIndex : -1;
      const explanation = typeof candidate.explanation === "string" ? candidate.explanation.trim() : "";
      const itemNumber = typeof candidate.item === "number" ? candidate.item : Number(candidate.item);
      const evidence = typeof candidate.evidence === "string" ? candidate.evidence : "";
      const sourceIndex = Number.isInteger(itemNumber) ? itemNumber - 1 : -1;

      const wellFormed =
        question.length > 8 &&
        options.length === 4 &&
        options.every(Boolean) &&
        new Set(options.map((o) => o.toLowerCase())).size === 4 &&
        Number.isInteger(correctIndex) &&
        correctIndex >= 0 &&
        correctIndex <= 3 &&
        explanation.length > 0 &&
        sourceIndex >= 0 &&
        sourceIndex < items.length;
      if (!wellFormed || !isGrounded(evidence, itemTexts[sourceIndex]) || seen.has(normalize(question))) {
        rejected++;
        continue;
      }
      seen.add(normalize(question));
      accepted.push({
        key: `ai-${Date.now().toString(36)}-${accepted.length}`,
        question: question.slice(0, 2000),
        options: options.map((o) => o.slice(0, 500)),
        correctOption: correctIndex,
        explanation: explanation.slice(0, 5000),
        tags: items[sourceIndex].tags.filter((t) => t.kind !== "syllabus"),
      });
    }

    if (accepted.length === 0) {
      console.error("[admin/current-affairs/generate-quiz] no usable questions", { rejected, note });
      return new Response(
        superjson.stringify({
          error: note
            ? `No reliable questions could be made: ${note}`
            : "No reliable questions could be made from this digest. Add more detail to the news items and try again.",
        }),
        { status: 422 }
      );
    }

    const warning =
      accepted.length < input.count
        ? `Only ${accepted.length} of ${input.count} questions could be grounded in this digest's content${
            rejected > 0 ? ` (${rejected} draft question${rejected === 1 ? " was" : "s were"} dropped for not matching the text)` : ""
          }. Add more detail to the items or ask for fewer questions.`
        : null;

    return new Response(superjson.stringify({ questions: accepted, warning } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error generating current affairs quiz");
  }
}