import { readVisitorContext } from "./readVisitorContext";

/**
 * The attribution columns for a new order, read from this browser's cookies
 * only: the visitor id, the first and last traffic source, and the autopilot
 * message whose link set tk_mid. Spread it next to getOrderClientInfo in the
 * orders insert. It touches no database, so it is safe inside a transaction.
 * The autopilotAttribution job later checks the message belongs to the buyer
 * and credits a message clicked on another device in the 72 hours before.
 * teacherRef marks a sale that came through a teacher's own share link (the
 * console and profile share buttons tag their links, helpers/shareLinks), for
 * the fee-by-source model, which runs in shadow: it changes no fee.
 */

const TEACHER_SHARE_CAMPAIGNS = new Set(["teacher_share", "expert_profile_share"]);

export type OrderAttribution = {
  visitorId: string | null;
  firstTouchSource: string | null;
  firstTouchAt: Date | null;
  lastTouchSource: string | null;
  lastTouchCampaign: string | null;
  attributedMessageId: string | null;
  teacherRef: string | null;
};

export function getOrderAttribution(request: Request): OrderAttribution {
  try {
    const context = readVisitorContext(request);
    const campaign = [context.lastTouch?.utmCampaign, context.firstTouch?.utmCampaign].find(
      (value) => value && TEACHER_SHARE_CAMPAIGNS.has(value)
    );
    return {
      visitorId: context.visitorId,
      firstTouchSource: context.firstTouch?.source ?? null,
      firstTouchAt: context.firstTouch?.at ?? null,
      lastTouchSource: context.lastTouch?.source ?? null,
      lastTouchCampaign: context.lastTouch?.utmCampaign ?? null,
      attributedMessageId: context.messageId,
      teacherRef: campaign ?? null,
    };
  } catch {
    return {
      visitorId: null,
      firstTouchSource: null,
      firstTouchAt: null,
      lastTouchSource: null,
      lastTouchCampaign: null,
      attributedMessageId: null,
      teacherRef: null,
    };
  }
}
