import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.number().int().positive(),
});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  roomId: string;
  token: string;
  url: string;
  expiresAt: Date;
  provider: "mock" | "daily";
  role: "teacher" | "learner";
  attendanceId: number;
  title: string;
};

export const postMentorshipClassroomJoin = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/classroom/join`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
