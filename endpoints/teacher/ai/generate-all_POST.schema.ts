import { z } from "zod";
import superjson from "superjson";
import {
  AI_PROMPT_MESSAGES,
  AI_PROMPT_MIN_LENGTH,
  readAiErrorPayload,
} from "../../../helpers/aiPromptValidation";

export const schema = z.object({
  prompt: z.string().trim().min(AI_PROMPT_MIN_LENGTH, AI_PROMPT_MESSAGES.tooShort),
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
    const { message, code } = readAiErrorPayload(await result.text(), (raw) => superjson.parse(raw));
    throw new AiGenerateAllError(message, code);
  }

  return superjson.parse<OutputType>(await result.text());
};