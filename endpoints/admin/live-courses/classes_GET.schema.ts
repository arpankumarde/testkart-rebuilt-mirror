import { z } from "zod";
import superjson from "superjson";

export const CLASS_VIEWS = ["upcoming", "unmarked", "past", "cancelled"] as const;
export type ClassView = (typeof CLASS_VIEWS)[number];

export const CLASSES_LIMIT = 300;

export const schema = z.object({
  view: z.enum(CLASS_VIEWS).default("upcoming"),
  q: z.string().trim().max(100).optional(),
});
export type InputType = z.input<typeof schema>;

export type AdminLiveCourseClassRow = {
  id: string;
  title: string;
  startTime: Date;
  durationMinutes: number;
  /** Did the teacher hold it: a missed class is stored cancelled with missed_at. */
  status: "scheduled" | "completed" | "missed" | "cancelled";
  /** Still scheduled although it has ended: nobody has marked it yet. */
  unmarked: boolean;
  cancellationReason: string | null;
  course: { id: string; title: string; status: string; enrolledCount: number };
  teacher: { id: number; name: string };
  presentCount: number;
};

export type OutputType = { classes: AdminLiveCourseClassRow[]; truncated: boolean };

export const getAdminLiveCourseClasses = async (input: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.view) params.set("view", input.view);
  if (input.q) params.set("q", input.q);
  const result = await fetch(`/_api/admin/live-courses/classes?${params.toString()}`, {
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
