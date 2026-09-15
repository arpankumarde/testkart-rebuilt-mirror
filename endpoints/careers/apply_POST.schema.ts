import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  careerPostingId: z.number(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  coverLetter: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  resumeFileId: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postCareerApply = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/careers/apply`, {
    method: "POST",
    body: superjson.stringify(body),
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