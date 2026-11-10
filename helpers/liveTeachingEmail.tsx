import { sendEmail } from "./sendEmail";
import { escapeEmailHtml, getBrandedEmailHtml } from "./emailBaseTemplate";
import { SITE_ORIGIN } from "./shareLinks";

export type LiveTeachingDecision = "approve" | "reject" | "revoke";

const COPY: Record<LiveTeachingDecision, { subject: string; heading: string; body: string; cta: string }> = {
  approve: {
    subject: "You are approved for live teaching on Testkart",
    heading: "You can now teach live",
    body: "Your application is approved. Students can now book 1:1 sessions from your profile, and you can schedule group classes. You can switch 1:1 bookings off any time.",
    cta: "Open live teaching",
  },
  reject: {
    subject: "Your live teaching application needs changes",
    heading: "Your application needs changes",
    body: "We could not approve your live teaching application yet. Fix the points below and apply again.",
    cta: "Update and apply again",
  },
  revoke: {
    subject: "Live teaching is paused on your Testkart profile",
    heading: "Live teaching is paused",
    body: "We have turned off 1:1 bookings and new group classes on your profile. Classes already scheduled are not affected. You can apply again once the points below are fixed.",
    cta: "Open live teaching",
  },
};

/** Never throws. Callers await it after their transaction commits. */
export async function sendLiveTeachingDecisionEmail(
  to: string,
  teacherName: string,
  decision: LiveTeachingDecision,
  reason: string | null
) {
  const copy = COPY[decision];
  const reasonHtml = reason
    ? `<p style="margin:16px 0 0"><strong>Reason</strong><br>${escapeEmailHtml(reason).replace(/\r?\n/g, "<br>")}</p>`
    : "";
  try {
    const html = getBrandedEmailHtml({
      title: copy.subject,
      preheaderText: copy.heading,
      accent: decision === "approve" ? "success" : "warning",
      heading: copy.heading,
      bodyHtml: `<p style="margin:0">Hi ${escapeEmailHtml(teacherName || "there")},</p><p style="margin:12px 0 0">${copy.body}</p>${reasonHtml}`,
      ctaLabel: copy.cta,
      ctaUrl: `${SITE_ORIGIN}/teacher/mentorship`,
    });
    const text = `Hi ${teacherName || "there"},\n\n${copy.body}${reason ? `\n\nReason: ${reason}` : ""}\n\n${copy.cta}: ${SITE_ORIGIN}/teacher/mentorship`;
    await sendEmail({ to, subject: copy.subject, html, text });
  } catch (err) {
    console.error(`Failed to send live teaching ${decision} email:`, err);
  }
}

/** The decision on an approved teacher's replacement intro video. Never throws. */
export async function sendIntroVideoDecisionEmail(to: string, teacherName: string, approved: boolean, reason: string | null) {
  const subject = approved ? "Your new intro video is live" : "Your new intro video needs changes";
  const body = approved
    ? "We approved your new intro video. It now plays on your profile."
    : "We could not approve your new intro video, so your current video stays on your profile. Upload another one after fixing the points below.";
  const reasonHtml = reason
    ? `<p style="margin:16px 0 0"><strong>Reason</strong><br>${escapeEmailHtml(reason).replace(/\r?\n/g, "<br>")}</p>`
    : "";
  try {
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: subject,
      accent: approved ? "success" : "warning",
      heading: subject,
      bodyHtml: `<p style="margin:0">Hi ${escapeEmailHtml(teacherName || "there")},</p><p style="margin:12px 0 0">${body}</p>${reasonHtml}`,
      ctaLabel: "Open live teaching",
      ctaUrl: `${SITE_ORIGIN}/teacher/mentorship`,
    });
    const text = `Hi ${teacherName || "there"},\n\n${body}${reason ? `\n\nReason: ${reason}` : ""}\n\nOpen live teaching: ${SITE_ORIGIN}/teacher/mentorship`;
    await sendEmail({ to, subject, html, text });
  } catch (err) {
    console.error("Failed to send intro video decision email:", err);
  }
}