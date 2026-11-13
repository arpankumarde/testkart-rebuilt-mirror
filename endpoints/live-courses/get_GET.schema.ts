import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseDetail } from "../../helpers/liveCourseData";

export const schema = z
  .object({ slug: z.string().trim().min(1).max(220).optional(), id: z.string().uuid().optional() })
  .refine((v) => !!v.slug || !!v.id, { message: "Pass a slug or an id" });
export type InputType = z.infer<typeof schema>;

export type LiveCourseViewer = {
  role: "guest" | "student" | "teacher" | "admin";
  isOwner: boolean;
  enrollment: {
    id: string;
    status: "enrolled" | "refunded" | "removed";
    enrolledAt: Date;
    refundedAt: Date | null;
    refundStatus: string | null;
  } | null;
  canRefund: boolean;
  /** The enrolled student's own attendance marks. */
  attendance: { classId: string; present: boolean }[];
};

export type OutputType = {
  course: LiveCourseDetail & { teacherBio: string | null; teacherTagline: string | null };
  seatsLeft: number;
  /** Why enrolment is closed, or null when a student can buy now. */
  closedReason: "full" | "deadline" | "not_open" | "ended" | null;
  refundClosesAt: Date | null;
  viewer: LiveCourseViewer;
};

export const getLiveCourse = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams(input.id ? { id: input.id } : { slug: input.slug ?? "" });
  const result = await fetch(`/_api/live-courses/get?${params.toString()}`, {
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
