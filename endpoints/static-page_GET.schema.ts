import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { StaticPages } from '../helpers/schema';

export const schema = z.object({
  slug: z.string().min(1, "Slug is required")
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Pick<
  Selectable<StaticPages>,
  "id" | "slug" | "title" | "content" | "updatedAt">;


export const getStaticPage = async (
params: InputType,
init?: RequestInit)
: Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({ slug: validatedParams.slug });
  const result = await fetch(`/_api/static-page?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};