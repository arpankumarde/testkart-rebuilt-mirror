import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  certificateId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

// Output is a PDF file, so no specific JSON output type is defined.
export type OutputType = Blob;

export const postStudentCertificateDownload = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/certificate/download`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(
        await result.text()
      );
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Failed to download certificate: ${result.statusText}`);
    }
  }

  return result.blob();
};