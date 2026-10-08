import { z } from "zod";
import superjson from "superjson";
import type { AffectedBundle } from "../../../helpers/bundleDependencies";

export const MAX_CHECKED_ITEMS = 200;

export const schema = z.object({
  itemType: z.enum(["course", "test", "digital_product"]),
  ids: z.array(z.number().int().positive()).min(1).max(MAX_CHECKED_ITEMS),
});

export type InputType = z.infer<typeof schema>;

// The teacher's published bundles that hold at least one of the items.
export type OutputType = {
  bundles: AffectedBundle[];
};

export const getTeacherBundlesContaining = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  searchParams.set("itemType", params.itemType);
  searchParams.set("ids", params.ids.join(","));

  const result = await fetch(`/_api/teacher/bundles/containing?${searchParams.toString()}`, {
    method: "GET",
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
