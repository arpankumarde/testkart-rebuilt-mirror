import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { Admins } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminListItem = Pick<Selectable<Admins>, 'id' | 'email' | 'fullName' | 'role' | 'permissions' | 'isActive' | 'lastLoginAt' | 'createdAt'>;

export type OutputType = {
  admins: AdminListItem[]
};

export const getAdminAdminsList = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/admins/list`, {
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