import { z } from "zod";
import superjson from "superjson";
import { OutputType as LimitOutputType } from "../../upload-limits_GET.schema";
import { STUDY_NOTES_PDF_MAX_MB } from "../../../helpers/digitalProductRules";

export const schema = z.object({
  thumbnailMaxMb: z.number().int().min(1).max(10240).optional(),
  profilePictureMaxMb: z.number().int().min(1).max(10240).optional(),
  kycDocumentMaxMb: z.number().int().min(1).max(10240).optional(),
  coursePdfMaxMb: z.number().int().min(1).max(10240).optional(),
  courseIntroVideoMaxMb: z.number().int().min(1).max(10240).optional(),
  lessonVideoMaxMb: z.number().int().min(1).max(10240).optional(),
  digitalProductPdfMaxMb: z.number().int().min(1).max(STUDY_NOTES_PDF_MAX_MB).optional(),
  richTextImageMaxMb: z.number().int().min(1).max(10240).optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = LimitOutputType;

export const postAdminUploadLimitsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/upload-limits/update`, {
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