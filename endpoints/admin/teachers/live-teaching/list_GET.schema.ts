import { z } from "zod";
import superjson from "superjson";

export const ApplicationFilterValues = ["pending", "approved", "rejected", "revoked", "all"] as const;
export type ApplicationFilter = (typeof ApplicationFilterValues)[number];

export const schema = z.object({
  status: z.enum(ApplicationFilterValues).default("pending"),
});
export type InputType = z.infer<typeof schema>;

export type LiveTeachingApplicationRow = {
  id: string;
  /** "video": an approved teacher's replacement intro video, reviewed on its own. */
  kind: "application" | "video";
  /** Video changes only: the video on the profile now, which the new one would replace. */
  currentVideoUrl: string | null;
  status: "pending" | "approved" | "rejected" | "revoked" | "withdrawn";
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
  introVideoUrl: string;
  /** Short session class price when they applied (the 30-minute price for applications from 18-11-2026 to 20-11-2026). */
  ratePerUnit: number | null;
  /** True for the teacher's latest row of this kind; only that one can be decided or revoked. */
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