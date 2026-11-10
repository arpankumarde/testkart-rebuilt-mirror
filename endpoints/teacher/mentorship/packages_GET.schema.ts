import superjson from "superjson";

export type TeacherPackageRow = {
  id: string;
  status: "active" | "past_due";
  studentName: string;
  studentAvatarUrl: string | null;
  classesPerWeek: number;
  classMinutes: number;
  pricePerClass: number;
  cycleEndsAt: Date | null;
  autoRenew: boolean;
  upcomingCount: number;
  heldCount: number;
};

export type OutputType = { packages: TeacherPackageRow[] };

export const getTeacherMentorshipPackages = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/packages`, {
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
