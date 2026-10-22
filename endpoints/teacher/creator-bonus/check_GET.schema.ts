import { z } from "zod";
import superjson from "superjson";
import type { CampaignLesson, CampaignProgressItem, ExamBonusOption } from "../../../helpers/teacherCampaignRules";

export const schema = z.object({
  type: z.enum(["mock_test", "course"]),
  id: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | { active: false; examOptions: ExamBonusOption[] }
  | {
      active: true;
      title: string;
      amount: number;
      canClaim: boolean;
      /** Why it cannot be claimed now; null when it can. */
      reason: string | null;
      progress: CampaignProgressItem[] | null;
      /** Courses: every video lesson with whether it counts and why not. */
      videos: CampaignLesson[] | null;
      minMinutesPerVideo: number;
      /** Test series: the running Exam Bonus campaigns for the exams it is tagged with. */
      examOptions: ExamBonusOption[];
    };

export const getTeacherCreatorBonusCheck = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const search = new URLSearchParams({ type: params.type, id: String(params.id) });
  const result = await fetch(`/_api/teacher/creator-bonus/check?${search.toString()}`, {
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