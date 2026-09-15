import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { WellKnownFiles } from "../../../helpers/schema";

export const schema = z.object({
  fileKey: z.string().min(1, "File key is required"),
  content: z.string().min(1, "Content is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  updatedFile: Selectable<WellKnownFiles>;
};

export const postAdminWellKnownUpdate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/well-known/update`, {
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