import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWithdrawals } from "../../../helpers/schema";

export const schema = z.object({
  withdrawalId: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<TeacherWithdrawals>, 'amount'> & {
  amount: number;
};

export const postProcessWithdrawal = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/withdrawals/process`, {
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