import { z } from "zod";
import superjson from "superjson";
import { SalesStageArrayValues, CallDispositionArrayValues } from "../../../../helpers/schema";

export const schema = z.object({
  contactId: z.number().int().positive(),
  stage: z.enum(SalesStageArrayValues).optional(),
  note: z.string().trim().min(1).optional(),
  assignedToAdminId: z.number().int().nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  disposition: z.enum(CallDispositionArrayValues).optional(),
}).refine(data => {
  const hasUpdate = data.stage || data.note || data.assignedToAdminId !== undefined || data.followUpDate !== undefined;
  if (!hasUpdate) {
    return false;
  }
  if (data.disposition && !data.note) {
    return false;
  }
  return true;
}, {
  message: "At least one of stage, note, assignedToAdminId, or followUpDate is required. disposition must accompany a note.",
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postUpdateSalesContact = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/sales/contacts/update`, {
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