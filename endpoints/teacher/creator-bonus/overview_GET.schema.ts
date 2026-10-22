import { z } from "zod";
import superjson from "superjson";
import type {
  CampaignContentType,
  CampaignProgressItem,
  CampaignRequirements,
} from "../../../helpers/teacherCampaignRules";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/*
 * credited, claimed and reversed come from the item's claim. Otherwise:
 * excluded = live before the campaign started; final = declined too often;
 * building = rules not met yet; full = no slots left; ready = can claim with
 * its next submission for review.
 */
export type CampaignItemState = "credited" | "claimed" | "reversed" | "final" | "excluded" | "building" | "full" | "ready";

export type CampaignItem = {
  type: CampaignContentType;
  id: number;
  title: string;
  live: boolean;
  inReview: boolean;
  state: CampaignItemState;
  progress: CampaignProgressItem[];
  /** With claimed: whether the review was approved and the bonus decision is pending. */
  approved: boolean;
  /** The latest note from our team: why a bonus was declined or reversed. */
  note: string | null;
  declines: number;
  /** Courses only: video lessons that do not count (links, no file, repeats, too short). */
  uncountedVideos: number;
  /** A running Exam Bonus this test series can still claim, if any. */
  examBonus: { title: string; amount: number } | null;
  /** The Exam Bonus this item's claim belongs to; null for the Creator Bonus or no claim. */
  claimedExamBonus: string | null;
};

export type CampaignSlots = { used: number; credited: number; limit: number; amount: number };

/** A running Exam Bonus as every teacher sees it, with their own slots. */
export type ExamCampaignCard = {
  id: number;
  title: string;
  examId: number | null;
  examName: string;
  amount: number;
  totalSlots: number;
  slotsTaken: number;
  perTeacher: number;
  mine: number;
  minTests: number;
  minQuestions: number;
  endsAt: Date;
  news: { title: string; slug: string } | null;
};

export type OutputType =
  | { campaign: null }
  | {
      campaign: { title: string; startsAt: Date; requirements: CampaignRequirements; maxDeclinesPerItem: number };
      slots: Record<CampaignContentType, CampaignSlots>;
      /** Creator Bonus money only, so it stays within the campaign's maximum. */
      earned: number;
      examEarned: number;
      examCampaigns: ExamCampaignCard[];
      items: CampaignItem[];
    };

export const getTeacherCreatorBonusOverview = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/creator-bonus/overview`, {
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