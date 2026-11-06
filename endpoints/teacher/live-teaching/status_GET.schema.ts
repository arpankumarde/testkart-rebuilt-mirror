import superjson from "superjson";
import type { LiveTeachingChecklistItem, LiveTeachingStatus } from "../../../helpers/liveTeachingRules";

export type OutputType = {
  status: LiveTeachingStatus;
  checklist: LiveTeachingChecklistItem[];
  introVideoUrl: string | null;
  /** The admin's reason on the latest rejection or revocation. */
  decisionReason: string | null;
  appliedAt: Date | null;
  decidedAt: Date | null;
  /** Team managers can see the status but only the account owner can apply. */
  isOwner: boolean;
};

export const getTeacherLiveTeachingStatus = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-teaching/status`, {
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