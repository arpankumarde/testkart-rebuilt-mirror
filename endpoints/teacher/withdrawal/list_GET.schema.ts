import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWithdrawals } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type WithdrawalRecord = Omit<Selectable<TeacherWithdrawals>, 'amount'> & {
  amount: number;
};

export type OutputType = {
  withdrawals: WithdrawalRecord[];
};

export const getTeacherWithdrawals = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/withdrawal/list`, {
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
  return superjson.parse<OutputType>(await result.text());
};