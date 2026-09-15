import { z } from "zod";
import superjson from "superjson";
import type { EditorImageContentType } from "../../../helpers/editorImageRules";

export const schema = z
  .object({
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe("A public https link that returns the image file itself. Testkart downloads it and hosts a copy."),
    dataBase64: z
      .string()
      .optional()
      .describe("The image file as base64, or as a data:image/...;base64, URL."),
  })
  .superRefine((input, ctx) => {
    if (Boolean(input.sourceUrl) === Boolean(input.dataBase64)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Send exactly one of sourceUrl or dataBase64." });
    }
  });

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  url: string;
  key: string;
  contentType: EditorImageContentType;
  sizeBytes: number;
};

export const postTeacherEditorImagesUpload = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/editor-images/upload`, {
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