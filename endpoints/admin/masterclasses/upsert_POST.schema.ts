import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  slug: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(3, "Title is required"),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  coverImageUrl: z.string().trim().optional(),
  coverImageFileId: z.string().trim().optional(),
  hostName: z.string().trim().optional(),
  hostTitle: z.string().trim().optional(),
  hostImageUrl: z.string().trim().optional(),
  platformLabel: z.string().trim().optional(),
  joinUrl: z.string().trim().optional(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "cancelled"]),
});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  id: number;
};

export const postAdminMasterclassUpsert = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/masterclasses/upsert`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
