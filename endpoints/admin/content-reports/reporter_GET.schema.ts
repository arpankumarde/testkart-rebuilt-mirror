import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

/** Captured at submission on the server; never sent to the public site or editable. */
export type OutputType = {
  reporterIp: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export const getAdminContentReportReporter = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const { id } = schema.parse(params);
  const result = await fetch(`/_api/admin/content-reports/reporter?id=${id}`, {
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