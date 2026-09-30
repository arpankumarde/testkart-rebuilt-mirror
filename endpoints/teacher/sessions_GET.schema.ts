import { z } from "zod";
import superjson from "superjson";
import type { OtherSignInsSummary } from "../../helpers/teacherSignIns";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = OtherSignInsSummary;

export const getTeacherSessions = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/sessions`, {
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