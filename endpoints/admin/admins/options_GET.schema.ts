import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminOption = {
  id: number;
  fullName: string;
  isActive: boolean;
};

export type OutputType = {
  admins: AdminOption[];
};

export const getAdminOptions = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/admins/options`, {
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