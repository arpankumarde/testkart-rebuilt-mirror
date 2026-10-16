import { z } from "zod";
import superjson from "superjson";
import { tagRefSchema, type CurrentAffairsQuestionInput } from "./save_POST.schema";

export const MAX_GENERATED_QUESTIONS = 20;

/** The digest as it is in the editor, saved or not; only what the questions may draw on. */
export const schema = z.object({
  title: z.string().max(255),
  contentType: z.enum(["daily_digest", "editorial_analysis", "weekly_digest", "monthly_digest", "individual_item"]),
  digestDate: z.string(),
  summary: z.string().max(600),
  body: z.string().max(200000),
  items: z
    .array(
      z.object({
        headline: z.string().max(300),
        whyInNews: z.string().max(5000),
        keyPoints: z.string().max(40000),
        background: z.string().max(40000),
        tags: z.array(tagRefSchema),
        sources: z.array(z.object({ name: z.string().max(160), url: z.string().max(2000) })),
      })
    )
    .max(40),
  count: z.number().int().min(1).max(MAX_GENERATED_QUESTIONS),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /** Questions already in the quiz, so new ones do not repeat them. */
  avoid: z.array(z.string().max(2000)).max(60),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  questions: CurrentAffairsQuestionInput[];
  /** Set when fewer reliable questions came back than were asked for. */
  warning: string | null;
};

export const postAdminCurrentAffairsGenerateQuiz = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/current-affairs/generate-quiz`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};