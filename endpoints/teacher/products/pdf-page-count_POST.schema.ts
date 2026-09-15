import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  fileUrl: z.string().url(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  pageCount: number;
  textPreview: string;
};

// The server opened the file and found it password-protected or not a readable PDF.
export class PdfRejectedError extends Error {}

export const postTeacherProductsPdfPageCount = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/pdf-page-count`, {
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
    if (result.status === 422) throw new PdfRejectedError(errorObject.error);
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
