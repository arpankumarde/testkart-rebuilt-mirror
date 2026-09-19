import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.number().int().positive(),
  drmEnabled: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  teacherId: number;
  drmEnabled: boolean;
};

export const postAdminToggleTeacherDrm = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/teachers/toggle-drm`, {
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