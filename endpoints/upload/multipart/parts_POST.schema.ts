import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  key: z.string().min(1, "Key is required"),
  uploadId: z.string().min(1, "Upload ID is required"),
  // Parts the client still needs to send; each one not already stored gets a fresh upload URL.
  partNumbers: z.array(z.number().int().min(1).max(10000)).max(10000),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  uploadedParts: Array<{ partNumber: number; size: number }>;
  urls: Array<{ partNumber: number; presignedUrl: string }>;
};

/** The multipart upload is finished, aborted, expired or was never issued to this uploader. */
export class UploadNotFoundError extends Error {}

export const postUploadMultipartParts = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/upload/multipart/parts`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    if (result.status === 404) throw new UploadNotFoundError(errorObject.error);
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};
