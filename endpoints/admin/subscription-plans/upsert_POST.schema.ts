import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { SubscriptionPlans } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  price: z.string().refine((val) => !isNaN(parseFloat(val)), "Price must be a valid number"),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day"),
  billingCycle: z.enum(["monthly", "yearly", "none"]),
  platformFeePercentage: z.string().refine((val) => !isNaN(parseFloat(val)), "Platform fee must be a valid number"),
  features: z.array(z.string()).optional().nullable(),
  isActive: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<SubscriptionPlans>;

export const postAdminUpsertSubscriptionPlan = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/subscription-plans/upsert`, {
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