import superjson from "superjson";

export type OutputType = {
  enabled: boolean;
  ratePerUnit: number | null;
  rateUnitMinutes: number;
  minRatePerUnit: number;
  durations: number[];
};

export const getTeacherMentorshipRate = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/rate`, {
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
