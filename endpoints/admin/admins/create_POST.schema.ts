import { z } from "zod";
import superjson from 'superjson';
import { AdminRoleArrayValues } from "../../../helpers/schema";
import { ADMIN_MODULE_KEYS, type AdminModule } from "../../../helpers/adminPermissions";

export const schema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be 64 characters or fewer"),
  role: z.enum(AdminRoleArrayValues),
  permissions: z.array(z.enum(ADMIN_MODULE_KEYS as [AdminModule, ...AdminModule[]])).default([]),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postAdminAdminsCreate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/admins/create`, {
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