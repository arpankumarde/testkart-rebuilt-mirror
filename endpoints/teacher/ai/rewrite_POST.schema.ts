import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  field: z.enum(["title", "description", "shortDescription", "questionText", "explanation"]),
  currentValue: z.string().optional().default(""),
  contentType: z.enum(["product", "test", "liveTest", "course", "bundle"]),
  context: z
    .object({
      examName: z.string().optional(),
      category: z.string().optional(),
      subjects: z.array(z.string()).optional(),
      fileTitles: z.array(z.string()).optional(),
      language: z.string().optional(),
      tags: z.array(z.string()).optional(),
      level: z.string().optional(),
      bundleItemTitles: z.array(z.string()).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      duration: z.number().optional(),
      // Used by "explanation": what the question actually asks and what the
      // marked-correct answer is, so the drafted explanation matches.
      questionText: z.string().optional(),
      correctAnswerText: z.string().optional(),
      optionTexts: z.array(z.string()).optional(),
    })
    .optional()
    .default({}),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  suggestion: string;
};

export class AiRewriteError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = "AiRewriteError";
  }
}

export const postTeacherAIRewrite = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/ai/rewrite`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; code?: string }>(
      await result.text()
    );
    throw new AiRewriteError(errorObject.error, errorObject.code);
  }

  return superjson.parse<OutputType>(await result.text());
};