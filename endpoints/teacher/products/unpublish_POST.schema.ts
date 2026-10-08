import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../../helpers/schema";
import type { AffectedBundle } from "../../../helpers/bundleDependencies";

export const schema = z.object({
  id: z.number().int().positive(),
  // Sent once the teacher has accepted that the published bundles holding the
  // product go down with it. Without it, such a product is not unpublished.
  confirmBundleUnpublish: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<DigitalProducts>, "price" | "rating" | "fileSizeBytes"> & {
  price: number;
  rating: number | null;
  fileSizeBytes: number | null;
  unpublishedBundles: AffectedBundle[];
};

export const postTeacherProductsUnpublish = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/unpublish`, {
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