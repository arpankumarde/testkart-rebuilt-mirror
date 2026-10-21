import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  masterclassId: z.number().int().positive(),
});
export type InputType = z.infer<typeof schema>;

export type AdminMasterclassRegistration = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  userId: number | null;
  registeredAt: Date | null;
  confirmationSentAt: Date | null;
  reminder1DaySentAt: Date | null;
  reminder1HourSentAt: Date | null;
  attended: boolean | null;
};

export type OutputType = {
  registrations: AdminMasterclassRegistration[];
};

export const getAdminMasterclassRegistrations = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(params);
  const searchParams = new URLSearchParams({ masterclassId: String(validatedInput.masterclassId) });
  const result = await fetch(`/_api/admin/masterclasses/registrations?${searchParams.toString()}`, {
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
