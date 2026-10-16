import { z } from "zod";
import superjson from "superjson";
import type { CurrentAffairsContentType, CurrentAffairsStatus } from "../../../helpers/schema";
import type { InputType as SaveInput } from "./save_POST.schema";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type CurrentAffairsRelatedSummary = {
  id: number;
  title: string;
  slug: string;
  contentType: CurrentAffairsContentType;
  status: CurrentAffairsStatus;
};

/** The editable aggregate in the editor's own shape, plus the read-only record fields. */
export type CurrentAffairsPostDetail = Omit<SaveInput, "status"> & {
  id: number;
  status: CurrentAffairsStatus;
  previousSlugs: string[];
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  related: CurrentAffairsRelatedSummary[];
};

export type OutputType = { post: CurrentAffairsPostDetail };

export const getAdminCurrentAffairsPost = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: String(input.id) });
  const result = await fetch(`/_api/admin/current-affairs/get?${params.toString()}`, {
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