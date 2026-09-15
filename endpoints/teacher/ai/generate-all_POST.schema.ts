import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters long"),
  contentType: z.enum(["product", "test", "liveTest", "course", "bundle"]),
  bundleItemTitles: z.array(z.string()).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  title: string;
  shortDescription: string;
  description: string;
  examName?: string;
  category?: string;
  language?: string;
  tags?: string[];
  suggestedPrice?: number;
  level?: string;
  durationMinutes?: number;
};

export class AiGenerateAllError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = "AiGenerateAllError";
  }
}

export const postTeacherAIGenerateAll = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/ai/generate-all`, {
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
    throw new AiGenerateAllError(errorObject.error, errorObject.code);
  }

  return superjson.parse<OutputType>(await result.text());
};