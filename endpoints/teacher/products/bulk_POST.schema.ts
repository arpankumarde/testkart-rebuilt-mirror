import { z } from "zod";
import superjson from "superjson";
import type { AffectedBundle } from "../../../helpers/bundleDependencies";

export const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Select at least one product."),
  action: z.enum(["publish", "unpublish", "archive"]),
  // Sent once the teacher has accepted that the published bundles holding any
  // of the products go down with them. Without it, unpublish and archive stop
  // before changing anything when such a product is selected.
  confirmBundleUnpublish: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  succeeded: number[];
  failed: { id: number; title?: string; reason: string }[];
  unpublishedBundles: AffectedBundle[];
  /** For publish: true when the succeeded items went live at once, false when they were queued for review. */
  published: boolean;
};

export const postTeacherProductsBulk = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/bulk`, {
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
