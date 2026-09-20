import { z } from "zod";
import superjson from "superjson";
import { ASSET_NAME_MAX, type TeacherAsset } from "../../../helpers/teacherAssetFiles";

export const schema = z.object({
  key: z.string().min(1).max(500),
  name: z.string().trim().min(1, "Enter a name.").max(ASSET_NAME_MAX),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { asset: TeacherAsset };

export const postTeacherAssetsCreate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/assets/create`, {
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