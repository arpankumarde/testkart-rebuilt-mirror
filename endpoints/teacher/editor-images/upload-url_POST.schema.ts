import { z } from "zod";
import superjson from "superjson";
import { EDITOR_IMAGE_CONTENT_TYPES } from "../../../helpers/editorImageRules";
import type { EditorImageContentType } from "../../../helpers/editorImageRules";

export const schema = z.object({
  contentType: z
    .enum(EDITOR_IMAGE_CONTENT_TYPES)
    .describe("The image type. The PUT must send it as the Content-Type header."),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .describe("The file size in bytes. The PUT must send exactly this many bytes."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": EditorImageContentType };
  url: string;
  key: string;
  expiresInSeconds: number;
};

export const postTeacherEditorImagesUploadUrl = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/editor-images/upload-url`, {
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