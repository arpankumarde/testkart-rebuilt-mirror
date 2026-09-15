import { z } from "zod";
import superjson from "superjson";
import { CertificateTypeArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  certificateType: z.enum(CertificateTypeArrayValues),
  itemId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

// Output is a PDF file, so no specific JSON output type is defined.
// The client will receive a Blob.
export type OutputType = Blob;

export const postStudentCertificateGenerate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/certificate/generate`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    // Try to parse error as JSON, but fallback to text
    try {
      const errorObject = superjson.parse<{ error: string }>(
        await result.text()
      );
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Failed to generate certificate: ${result.statusText}`);
    }
  }

  return result.blob();
};