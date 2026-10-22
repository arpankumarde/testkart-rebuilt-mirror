import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** An exam with published news in the last 7 days and no running campaign. */
export type ExamCampaignSuggestion = {
  postId: number;
  title: string;
  newsType: string;
  publishedAt: Date;
  examId: number;
  examName: string;
  taggedSeries: number;
};

export type ExamCampaignAdminView = {
  id: number;
  title: string;
  examName: string | null;
  newsTitle: string | null;
  amount: number;
  totalSlots: number;
  perTeacher: number;
  minTests: number;
  minQuestions: number;
  startsAt: Date;
  endsAt: Date;
  running: boolean;
  /** Slots gone, counting reversed bonuses. */
  taken: number;
  waiting: number;
  credited: number;
  creditedAmount: number;
};

export type OutputType = {
  suggestions: ExamCampaignSuggestion[];
  running: ExamCampaignAdminView[];
  past: ExamCampaignAdminView[];
};

export const getAdminExamCampaigns = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/content-reviews/exam-campaigns`, {
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