import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherSubscriptions } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TeacherSubscriptions>;

export const postTeacherSubscriptionCancel = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/subscription/cancel`, {
    method: "POST",
    body: superjson.stringify(body),
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