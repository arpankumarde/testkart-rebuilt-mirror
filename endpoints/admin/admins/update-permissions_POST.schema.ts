import { z } from "zod";
import superjson from "superjson";
import { ADMIN_MODULE_KEYS, type AdminModule } from "../../../helpers/adminPermissions";

export const schema = z.object({
  adminId: z.number().int().positive(),
  permissions: z.array(z.enum(ADMIN_MODULE_KEYS as [AdminModule, ...AdminModule[]])),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  permissions: AdminModule[];
};

export const postAdminAdminsUpdatePermissions = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/admins/update-permissions`, {
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