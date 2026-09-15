import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogCategories } from "../../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  type: z.enum(["blog", "knowledge_base"]),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  category: Selectable<BlogCategories>;
};

export const postAdminUpsertBlogCategory = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/blog/categories/upsert`, {
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