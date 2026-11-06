import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminTcoinGrant = {
  id: number;
  createdAt: Date;
  coins: number;
  reason: string | null;
  grantedBy: string | null;
  expiresAt: Date;
  studentName: string | null;
  studentEmail: string | null;
};

export type OutputType = { grants: AdminTcoinGrant[] };

export const getAdminTcoinGrants = async (params: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/settings/tcoins/grants`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};