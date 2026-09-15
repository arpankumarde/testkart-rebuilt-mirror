import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  key: z.string().min(1, "Key is required"),
  uploadId: z.string().min(1, "Upload ID is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  publicUrl: string;
};

export const postUploadMultipartComplete = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/upload/multipart/complete`, {
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
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};