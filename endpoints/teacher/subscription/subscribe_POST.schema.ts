import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherSubscriptions } from "../../../helpers/schema";

export const schema = z.object({
  planId: z.number().int().positive(),
  paymentMethod: z.string().min(1, "Payment method is required").optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TeacherSubscriptions>;

export const postTeacherSubscriptionSubscribe = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/subscription/subscribe`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
  return superjson.parse<OutputType>(await result.text());
};