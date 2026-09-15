import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  field: z.enum(["whatYouLearn", "requirements"]),
  context: z
    .object({
      title: z.string().optional(),
      examName: z.string().optional(),
      shortDescription: z.string().optional(),
      longDescription: z.string().optional(),
      subjects: z.array(z.string()).optional(),
      // Items already in the list — passed so the AI adds new, non-redundant
      // suggestions rather than repeating what's already there.
      existingItems: z.array(z.string()).optional(),
    })
    .optional()
    .default({}),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  items: string[];
};

export class AiGenerateListError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = "AiGenerateListError";
  }
}

export const postTeacherAIGenerateList = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/ai/generate-list`, {
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
    throw new AiGenerateListError(errorObject.error, errorObject.code);
  }

  return superjson.parse<OutputType>(await result.text());
};
