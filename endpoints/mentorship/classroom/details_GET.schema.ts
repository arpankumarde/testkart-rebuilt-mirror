import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
});
export type InputType = z.infer<typeof schema>;

export type ClassroomRosterMember = { id: number; name: string; avatarUrl: string | null; role: "teacher" | "learner" };

export type OutputType = {
  kind: "booking" | "group";
  id: string;
  title: string;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  startTime: Date;
  durationMinutes: number;
  status: string;
  viewerRole: "teacher" | "learner";
  roster: ClassroomRosterMember[];
  materialsCount: number;
  /** Whether the join window is open right now, and why if not. */
  joinWindow: { isOpen: boolean; opensAt: Date; closesAt: Date };
  /** What a join would connect to right now: a real Daily.co call, or the development-only mock. */
  videoProvider: "mock" | "daily";
};

export const getMentorshipClassroomDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, id: String(input.id) });
  const result = await fetch(`/_api/mentorship/classroom/details?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
