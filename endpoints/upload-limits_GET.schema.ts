import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  thumbnailMaxMb: number;
  profilePictureMaxMb: number;
  kycDocumentMaxMb: number;
  coursePdfMaxMb: number;
  courseIntroVideoMaxMb: number;
  lessonVideoMaxMb: number;
  digitalProductPdfMaxMb: number;
  richTextImageMaxMb: number;
};

export const getUploadLimits = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/upload-limits`, {
    method: "GET",
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