import { z } from "zod";
import superjson from "superjson";
import type { LivePrices } from "../../helpers/livePricing";
import type { TrialState } from "../../helpers/livePackages";

/** Pass teacherId, or teacherSlug (the booking page URL). */
export const schema = z
  .object({
    teacherId: z.coerce.number().int().positive().optional(),
    teacherSlug: z.string().trim().min(1).max(200).optional(),
  })
  .refine((v) => v.teacherId != null || !!v.teacherSlug, { message: "teacherId or teacherSlug is required" });
export type InputType = z.infer<typeof schema>;

export type MentorshipOfferingDuration = {
  durationMinutes: number;
  price: number;
};

export type OutputType = {
  teacher: {
    id: number;
    slug: string | null;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    tagline: string | null;
    timezone: string;
  };
  /** Whether this teacher currently offers 1:1 sessions at all (needs an approved live teaching application). */
  enabled: boolean;
  /** The approved intro video, shown on the profile. Null unless live teaching is approved. */
  introVideoUrl: string | null;
  /** Regular class price per allowed length (see MENTORSHIP_SESSION_DURATIONS). */
  durations: MentorshipOfferingDuration[];
  /** Class and trial prices for both lengths. Null when 1:1 is off. */
  prices: LivePrices | null;
  /** Most classes a week a package can hold: the weekdays this teacher has open hours (one class a day), at most 6. */
  maxClassesPerWeek: number;
  /** True if the signed-in viewer is a student who can book a trial with this teacher. */
  isTrialEligible: boolean;
  /** Signed-in student only: where they stand with this teacher. Null when signed out or not a student. */
  trialState: TrialState | null;
  /** Signed-in student only: their active or payment-due package with this teacher. */
  activePackageId: string | null;
  /** Signed-in student only: live class balance they can spend here. */
  balance: number | null;
};

export const getMentorshipTeacherOfferings = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.teacherId != null) params.set("teacherId", String(input.teacherId));
  if (input.teacherSlug) params.set("teacherSlug", input.teacherSlug);
  const result = await fetch(`/_api/mentorship/teacher-offerings?${params.toString()}`, {
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
