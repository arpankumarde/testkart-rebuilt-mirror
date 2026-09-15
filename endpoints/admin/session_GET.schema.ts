import { z } from "zod";
import superjson from "superjson";
import { AdminProfile } from "../../helpers/AdminTypes";

export const schema = z.object({});

export type OutputType =
  | {
      admin: AdminProfile;
    }
  | {
      error: string;
    };

export const getAdminSession = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/session`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return superjson.parse<OutputType>(await result.text());
};