import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles } from "../../../helpers/schema";

export const schema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  status: z.enum(["published", "draft"]).nullish(),
});

export type InputType = z.infer<typeof schema>;

export type BundleListItem = Pick<Selectable<CourseBundles>, "id" | "title" | "slug" | "isPublished" | "createdAt" | "publishedAt" | "thumbnailUrl"> & {
    price: number;
    // What students are shown, stored when the bundle was last saved or published.
    originalPrice: number;
    // The items' combined price right now.
    currentOriginalPrice: number;
    itemCount: number;
};

export type OutputType = {
  bundles: BundleListItem[];
  total: number;
};

export const getTeacherBundlesList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page);
  if (params.limit) searchParams.set("limit", params.limit);
  if (params.status) searchParams.set("status", params.status);

  const result = await fetch(`/_api/teacher/bundles/list?${searchParams.toString()}`, {
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