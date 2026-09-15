import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type StudentBankDetails } from "../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<StudentBankDetails> | null;

export const getStudentBankDetails = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/bank-details`, {
    method: "GET",
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