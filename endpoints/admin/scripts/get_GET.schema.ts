import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  headerScript: string | null;
  footerScript: string | null;
};

export const getAdminScripts = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/scripts/get`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  // The response includes a Cache-Control header, but the browser/client fetch API
  // automatically caches responses based on this header. No manual caching needed here.

  return superjson.parse<OutputType>(await result.text());
};