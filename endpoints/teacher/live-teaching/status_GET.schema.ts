import superjson from "superjson";
import type { LiveTeachingChecklistItem, LiveTeachingStatus } from "../../../helpers/liveTeachingRules";

export type OutputType = {
  status: LiveTeachingStatus;
  checklist: LiveTeachingChecklistItem[];
  /** The academy owner's account email and mobile number; the application needs both. */
  contact: { email: string | null; mobileNumber: string | null };
  introVideoUrl: string | null;
  /** The admin's reason on the latest rejection or revocation. */
  decisionReason: string | null;
  appliedAt: Date | null;
  decidedAt: Date | null;
  /** Set when the teacher withdrew their latest application. */
  withdrawnAt: Date | null;
  /** Approved teachers: a new intro video waiting for review; the current one stays on the profile meanwhile. */
  pendingVideo: { url: string; sentAt: Date } | null;
  /** Approved teachers: why their last replacement video was turned down, until they send another. */
  videoRejection: { reason: string | null; decidedAt: Date | null } | null;
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
