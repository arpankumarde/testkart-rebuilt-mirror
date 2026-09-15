import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  fileName: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "Content type is required"),
  fileSize: z.number().int().positive("File size must be positive"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  presignedUrl: string;
  key: string;
  publicUrl: string;
};

export const postUploadResume = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/careers/upload-resume`, {
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