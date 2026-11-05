import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** "upcoming" (default) = not yet started and not cancelled; "past" = ended or completed; "cancelled"; "all". */
  filter: z.enum(["upcoming", "past", "cancelled", "all"]).optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminLiveLessonRow = {
  /** Distinguishes a 1:1 mentorship booking from a group lesson; the two tables are unioned for moderation. */
  kind: "booking" | "group";
  id: number;
  title: string;
  teacherId: number;
  teacherName: string | null;
  startTime: Date;
  durationMinutes: number;
  status: string;
  /** Learner for a booking, enrolled count for a group lesson. */
  studentId: number | null;
  studentName: string | null;
  enrolledCount: number | null;
  maxCapacity: number | null;
  price: number;
  cancellationReason: string | null;
  createdAt: Date;
};

export type OutputType = {
  rows: AdminLiveLessonRow[];
};

export const getAdminLiveLessonsList = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/admin/live-lessons/list?${params.toString()}`, {
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
