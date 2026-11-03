import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles } from "../../../helpers/schema";
import { visibilityInputSchema } from "../../../helpers/contentVisibility";
import { noEmoji } from "../../../helpers/emojiText";

export const schema = z.object({
  title: noEmoji(z.string().min(3, "Title must be at least 3 characters long.")),
  description: z.string().optional(),
  courseIds: z.array(z.number()).optional().default([]),
  testIds: z.array(z.number()).optional().default([]),
  digitalProductIds: z.array(z.number()).optional().default([]),
  price: z.number().min(0, "Price cannot be negative."),
  // "" and null both mean no cover; the server stores null.
  thumbnailUrl: z.string().url().or(z.literal("")).optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  introVideoUrl: z.string().optional().nullable(),
  introVideoFileId: z.string().optional().nullable(),
  visibility: visibilityInputSchema,
});
// A draft may hold any number of items, published or not; bundles/publish
// enforces 2+ items, all live, and the price rule.

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<CourseBundles>, "price" | "originalPrice" | "discountPercentage"> & {
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  courseCount: number;
};

export const postTeacherBundlesCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/bundles/create`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.details || errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};