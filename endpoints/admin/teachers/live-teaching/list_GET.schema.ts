import { z } from "zod";
import superjson from "superjson";

export const ApplicationFilterValues = ["pending", "approved", "rejected", "revoked", "all"] as const;
export type ApplicationFilter = (typeof ApplicationFilterValues)[number];

export const schema = z.object({
  status: z.enum(ApplicationFilterValues).default("pending"),
});
export type InputType = z.infer<typeof schema>;

export type LiveTeachingApplicationRow = {
  id: number;
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
  introVideoUrl: string;
  /** Price per 25 minutes when they applied. */
  ratePerUnit: number | null;
  /** True for the teacher's latest application; only that one can be decided or revoked. */
  isLatest: boolean;
  teacher: {
    id: number;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    slug: string | null;
    tagline: string | null;
    bio: string | null;
    subjects: string[];
    languages: string[];
    yearsOfExperience: number | null;
    isVerified: boolean;
    weeklyHourWindows: number;
  };
};

export type OutputType = {
  applications: LiveTeachingApplicationRow[];
  counts: Record<"pending" | "approved" | "rejected" | "revoked", number>;
};

export const getAdminLiveTeachingApplications = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ status: input.status });
  const result = await fetch(`/_api/admin/teachers/live-teaching/list?${params.toString()}`, {
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