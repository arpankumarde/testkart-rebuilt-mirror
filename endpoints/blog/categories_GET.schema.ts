import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogCategories } from "../../helpers/schema";

export const schema = z.object({
  type: z.enum(["blog", "knowledge_base"]).default("blog"),
});

export type InputType = z.infer<typeof schema>;

export type PublicCategoryItem = Selectable<BlogCategories> & {
  postCount: number;
};

export type OutputType = {
  categories: PublicCategoryItem[];
};

export const getBlogCategoriesList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.type) params.append("type", input.type);

  const result = await fetch(`/_api/blog/categories?${params.toString()}`, {
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