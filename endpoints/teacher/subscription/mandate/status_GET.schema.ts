import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherSubscriptions } from "../../../../helpers/schema";

// No input schema needed for this GET request
export const schema = z.object({});

export type OutputType = Pick<
  Selectable<TeacherSubscriptions>,
  "mandateId" | "mandateStatus" | "nextChargeDate" | "mandateMaxAmount"
> | null;

export const getTeacherSubscriptionMandateStatus = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/subscription/mandate/status`, {
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