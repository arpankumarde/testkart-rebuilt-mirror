import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ status: z.enum(["open", "resolved"]).optional() });
export type InputType = z.infer<typeof schema>;

export type LiveIssueRow = {
  bookingId: string;
  scheduledAt: Date;
  durationMinutes: number;
  amount: number;
  kind: "trial" | "package";
  studentId: number;
  studentName: string;
  teacherId: number;
  teacherName: string;
  note: string | null;
  reportedAt: Date;
  /** From the classroom join records. */
  teacherJoined: boolean;
  studentJoined: boolean;
  resolution: "refunded" | "rejected" | null;
  resolvedAt: Date | null;
};

export type OutputType = { issues: LiveIssueRow[] };

export const getAdminLiveLessonIssues = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  const result = await fetch(`/_api/admin/live-lessons/issues?${params.toString()}`, {
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
