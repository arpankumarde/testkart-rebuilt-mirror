import { z } from "zod";
import superjson from "superjson";

export const REVIEW_REPLY_MAX = 1000;

export const schema = z.object({
  reviewId: z.number().int().positive(),
  /** The public reply; empty or null removes it. */
  reply: z.string().max(REVIEW_REPLY_MAX, `Keep the reply under ${REVIEW_REPLY_MAX} characters.`).nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { reviewId: number; teacherReply: string | null; teacherRepliedAt: Date | null };

export const postTeacherReviewReply = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/reviews/reply`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Your reply was not saved.");
  }
  return superjson.parse<OutputType>(await result.text());
};