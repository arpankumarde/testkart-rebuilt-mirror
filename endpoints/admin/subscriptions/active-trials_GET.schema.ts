import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type ActiveTrialView = {
  subscriptionId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  platformFeePercentage: number | null;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number;
  adminNote: string | null;
};

export type OutputType = {
  trials: ActiveTrialView[];
};

export const getActiveAdminTrials = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/subscriptions/active-trials`, {
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