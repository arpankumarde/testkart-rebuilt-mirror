import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  testItemId: z.number(),
  subjectId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

// We return a Blob because this endpoint responds with binary PDF data
export const getTeacherTestItemDownloadPdf = async (
  params: InputType,
  init?: RequestInit
): Promise<Blob> => {
  const validated = schema.parse(params);
  const searchParams = new URLSearchParams({
    testItemId: validated.testItemId.toString(),
    ...(validated.subjectId != null ? { subjectId: validated.subjectId.toString() } : {}),
  });

  const result = await fetch(`/_api/teacher/test-item/download-pdf?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return await result.blob();
};