import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  courseId: z.number().int().positive(),
  /** Also claim the Creator Bonus with this submission (helpers/teacherCampaign). */
  claimCreatorBonus: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  /** True when it went live at once; false when it was queued for admin review. */
  published: boolean;
  message: string;
};

export const postTeacherCoursesPublish = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/courses/publish`, {
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