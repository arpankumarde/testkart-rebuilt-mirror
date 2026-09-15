import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TrialHistoryView = {
  subscriptionId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  platformFeePercentage: number | null;
  startDate: Date | null;
  endDate: Date | null;
  adminNote: string | null;
  // True only while the trial is both still marked active AND its end date
  // hasn't passed yet — a trial that simply ran out its clock keeps
  // status "active" in the database forever (nothing flips it), so
  // "active" here is derived the same way the Active Custom Trials list
  // derives it, not read directly off the status column.
  isActive: boolean;
};

export type OutputType = {
  trials: TrialHistoryView[];
};

export const getAdminTrialHistory = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/subscriptions/trial-history`, {
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
