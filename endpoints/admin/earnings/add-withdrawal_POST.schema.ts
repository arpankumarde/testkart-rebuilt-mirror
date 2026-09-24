import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWithdrawals } from "../../../helpers/schema";

export const schema = z.object({
  teacherId: z.number().int().positive(),
  amount: z
    .number()
    .finite()
    .positive("Amount must be positive")
    .max(1_000_000, "Maximum payout is ₹10,00,000")
    .multipleOf(0.01, "Amount can have at most two decimal places"),
  transactionId: z.string().optional(),
  notes: z.string().max(500, "Notes can be at most 500 characters").optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<TeacherWithdrawals>, 'amount'> & {
  amount: number;
};

export const postAdminAddWithdrawal = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/earnings/add-withdrawal`, {
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