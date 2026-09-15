import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.number().int().positive(),
  platformFeePercentage: z.number().min(0).max(100),
  durationDays: z.number().int().min(1).max(365),
  note: z.string().optional(),
  retroactiveFromOrderItemId: z.number().int().positive().optional(),
  retroactiveFromDate: z.string().optional(),
}).refine(
  (data) => !(data.retroactiveFromOrderItemId != null && data.retroactiveFromDate != null),
  { message: "Provide either retroactiveFromOrderItemId or retroactiveFromDate, not both" }
);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  subscriptionId: number;
};

export const postStartTrial = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/subscriptions/start-trial`, {
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