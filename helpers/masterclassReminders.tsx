import { db } from "./db";
import { sendTemplateEmail } from "./sendTemplateEmail";
import { googleCalendarUrl, masterclassIcsPath } from "./masterclassCalendarLinks";

const BASE_URL = "https://testkart.in";
const MASTERCLASS_BASE_URL = `${BASE_URL}/masterclass`;

const formatStartTime = (startTime: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(startTime)
  );

/**
 * Scheduled job (static/__dev/scheduled-jobs.json): sends the fixed two-step
 * reminder sequence - 1 day before and 1 hour before - to everyone registered
 * for a published masterclass. Idempotent via the sentAt columns on
 * masterclass_registrations, so running this on a tight interval never double-
 * sends: each registration gets each reminder at most once, whichever run
 * first finds it inside that reminder's window.
 */
export async function masterclassReminders() {
  try {
    const now = new Date();

    const dayWindowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const dayWindowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const hourWindowStart = new Date(now.getTime() + 40 * 60 * 1000);
    const hourWindowEnd = new Date(now.getTime() + 80 * 60 * 1000);

    const dayCandidates = await db
      .selectFrom("masterclasses")
      .select(["id", "slug", "title", "subtitle", "hostName", "startTime", "durationMinutes"])
      .where("status", "=", "published")
      .where("startTime", ">=", dayWindowStart)
      .where("startTime", "<=", dayWindowEnd)
      .execute();

    let dayCount = 0;
    for (const m of dayCandidates) {
      const registrants = await db
        .selectFrom("masterclassRegistrations")
        .select(["id", "name", "email"])
        .where("masterclassId", "=", m.id)
        .where("reminder1DaySentAt", "is", null)
        .execute();

      const formattedStartTime = formatStartTime(m.startTime);
      const masterclassUrl = `${MASTERCLASS_BASE_URL}/${m.slug}`;
      for (const r of registrants) {
        const result = await sendTemplateEmail("masterclass_reminder_1_day", r.email, {
          name: r.name,
          title: m.title,
          hostName: m.hostName || "the Testkart team",
          startTime: formattedStartTime,
          masterclassUrl,
          googleCalendarUrl: googleCalendarUrl({
            title: m.title,
            description: m.subtitle || "A free live masterclass for teachers, hosted on Testkart.",
            pageUrl: masterclassUrl,
            startTime: m.startTime,
            durationMinutes: m.durationMinutes,
          }),
          icsUrl: `${BASE_URL}${masterclassIcsPath(m.slug)}`,
        });
        if (result.success) {
          await db
            .updateTable("masterclassRegistrations")
            .set({ reminder1DaySentAt: new Date() })
            .where("id", "=", r.id)
            .execute();
          dayCount++;
        }
      }
    }

    const hourCandidates = await db
      .selectFrom("masterclasses")
      .select(["id", "slug", "title", "hostName", "startTime", "joinUrl"])
      .where("status", "=", "published")
      .where("startTime", ">=", hourWindowStart)
      .where("startTime", "<=", hourWindowEnd)
      .execute();

    let hourCount = 0;
    for (const m of hourCandidates) {
      const registrants = await db
        .selectFrom("masterclassRegistrations")
        .select(["id", "name", "email"])
        .where("masterclassId", "=", m.id)
        .where("reminder1HourSentAt", "is", null)
        .execute();

      const formattedStartTime = formatStartTime(m.startTime);
      for (const r of registrants) {
        const result = await sendTemplateEmail("masterclass_reminder_1_hour", r.email, {
          name: r.name,
          title: m.title,
          hostName: m.hostName || "the Testkart team",
          startTime: formattedStartTime,
          joinUrl: m.joinUrl || `${MASTERCLASS_BASE_URL}/${m.slug}`,
        });
        if (result.success) {
          await db
            .updateTable("masterclassRegistrations")
            .set({ reminder1HourSentAt: new Date() })
            .where("id", "=", r.id)
            .execute();
          hourCount++;
        }
      }
    }

    console.log(`[masterclassReminders] Sent ${dayCount} 1-day and ${hourCount} 1-hour reminders.`);
  } catch (error) {
    console.error("[masterclassReminders] Failed to process reminders:", error);
  }
}
