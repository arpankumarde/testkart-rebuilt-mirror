import { z } from "zod";
import superjson from "superjson";
import { schema as detailsSchema } from "../../teacher/live-courses/upsert_POST.schema";

export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), courseId: z.string().uuid(), details: detailsSchema }),
  z.object({ action: z.literal("cancel_course"), courseId: z.string().uuid(), reason: z.string().trim().min(5, "Give a reason").max(500) }),
  z.object({ action: z.literal("refund"), enrollmentId: z.string().uuid(), reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("cancel_class"), classId: z.string().uuid(), reason: z.string().trim().min(5, "Give a reason").max(500) }),
]);

export type InputType = z.input<typeof schema>;
export type OutputType = { message: string };

export const postAdminLiveCourseAction = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-lessons/courses/action`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
