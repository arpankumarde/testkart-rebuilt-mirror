import superjson from "superjson";

export type LivePackageView = {
  id: string;
  status: "active" | "past_due";
  teacher: { id: number; displayName: string; avatarUrl: string | null };
  classesPerWeek: number;
  nextClassesPerWeek: number | null;
  classMinutes: number;
  pricePerClass: number;
  autoRenew: boolean;
  autopayActive: boolean;
  /** The cycle running now (the latest paid one). */
  cycle: { number: number; startsAt: Date; endsAt: Date; amount: number } | null;
  /** The next cycle while it is being paid, or a renewal whose debit failed. */
  renewal: {
    number: number;
    status: "pending" | "failed";
    startsAt: Date;
    amount: number;
    failureReason: string | null;
    graceUntil: Date | null;
  } | null;
  /** Paid classes waiting for a time: cancelled in time, or not picked yet. */
  waitingCredits: { id: string; amount: number }[];
  upcoming: { bookingId: string; scheduledAt: Date; durationMinutes: number; freeChange: boolean }[];
  heldCount: number;
};

export type TrialFollowUp = {
  bookingId: string;
  teacherId: number;
  teacherSlug: string | null;
  teacherName: string;
  teacherAvatarUrl: string | null;
  classAt: Date;
};

export type OutputType = {
  /** Live class balance: money from cancelled classes, usable with any teacher, never withdrawn. */
  balance: number;
  packages: LivePackageView[];
  trialFollowUps: TrialFollowUp[];
};

export const getMentorshipPackages = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/packages/list`, {
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
