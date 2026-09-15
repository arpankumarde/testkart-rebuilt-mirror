import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  totalQuestions: number;
  questionsByExam: { examName: string; count: number }[];
  customPromptsCount: number;
  markedForReviewCount: number;
  thisMonthCount: number;
  lastMonthCount: number;
  monthlyGrowthRate: number;
};

export const getAdminAIQuestionsStats = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/ai-questions/stats`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};