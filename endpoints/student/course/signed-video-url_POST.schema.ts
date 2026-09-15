import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  videoUrl: z.string().url(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  signedUrl: string;
  expiresIn: number; // in seconds
};

export const postStudentCourseSignedVideoUrl = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/course/signed-video-url`, {
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