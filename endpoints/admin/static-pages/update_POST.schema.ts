import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { StaticPages } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  updatedPage: Selectable<StaticPages>;
};

export const postAdminUpdateStaticPage = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/static-pages/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(errorObject.error || "Failed to update static page");
  }

  return responseJson as OutputType;
};