import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ teacherId: z.coerce.number().int().positive() });
export type InputType = z.infer<typeof schema>;

export type MentorshipOfferingDuration = {
  durationMinutes: number;
  price: number;
};

export type OutputType = {
  teacher: {
    id: number;
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
  /** One entry per allowed duration (see MENTORSHIP_SESSION_DURATIONS), priced from the teacher's rate. */
  durations: MentorshipOfferingDuration[];
  /** True if the signed-in viewer is a student with no prior (non-cancelled) booking with this teacher - their first booking would be a trial. Always false when signed out or not a student. */
  isTrialEligible: boolean;
};

export const getMentorshipTeacherOfferings = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ teacherId: String(input.teacherId) });
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
