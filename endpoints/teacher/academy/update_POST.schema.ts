import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    academyName: z.string().min(1, "Academy name cannot be empty."),
    description: z.string().optional(),
    website: z.string().url("Invalid website URL.").optional(),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postTeacherAcademyUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/academy/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};