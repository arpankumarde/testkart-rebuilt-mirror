import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWithdrawals } from "../../../helpers/schema";

export const schema = z.object({
  amount: z
    .number()
    .finite()
    .min(100, "Minimum withdrawal amount is ₹100")
    .max(1_000_000, "Maximum withdrawal amount is ₹10,00,000")
    .multipleOf(0.01, "Amount can have at most two decimal places"),
  notes: z.string().max(500, "Notes can be at most 500 characters").optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<TeacherWithdrawals>, 'amount'> & {
  amount: number;
};

export const postRequestWithdrawal = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/withdrawal/request`, {
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