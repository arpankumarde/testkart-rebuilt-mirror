import { db } from "./db";
import { waplify } from "./autopilotWhatsAppTemplates";
import { sendWhatsAppTemplate } from "./autopilotChannels";
import { formatIst } from "./livePackageEmails";

/**
 * WhatsApp class reminders for live 1:1 classes, one UTILITY template for the student and one for
 * the teacher, sent next to the reminder emails 24 hours and 1 hour before a class. Body
 * variables: {{1}} the reader's first name, {{2}} the other person's name, {{3}} the class time in
 * IST. The button opens the classroom; its dynamic part is the booking id. A template is used only
 * once Meta has approved it on Waplify.
 */

type LiveClassTemplate = {
  name: string;
  audience: "student" | "teacher";
  header: string;
  body: string;
  examples: string[];
  button: string;
};

export const LIVE_CLASS_WHATSAPP_TEMPLATES: LiveClassTemplate[] = [
  {
    name: "tk_live_class_reminder",
    audience: "student",
    header: "Class reminder",
    body: "Hi {{1}},\n\nYour live class with *{{2}}* starts on *{{3}}*.\n\nThe classroom opens 10 minutes before. Join from the link below.",
    examples: ["Priya", "Dipak Sir", "Tue, 17 Nov, 6:00 pm IST"],
    button: "Open classroom",
  },
  {
    name: "tk_live_class_reminder_teacher",
    audience: "teacher",
    header: "Class reminder",
    body: "Hi {{1}},\n\nYou are teaching a live class with *{{2}}* on *{{3}}*.\n\nPlease join on time from the link below. If you do not join, the student gets the class back.",
    examples: ["Dipak", "Priya Sharma", "Tue, 17 Nov, 6:00 pm IST"],
    button: "Open classroom",
  },
];

const CLASSROOM_URL = "https://testkart.in/mentorship/classroom/booking/{{1}}";
const CLASSROOM_URL_EXAMPLE = "https://testkart.in/mentorship/classroom/booking/3f1c2a9e-5b7d-4e2a-9c1f-8d6b4a2e7c10";

export type LiveClassTemplateStatus = { name: string; audience: string; status: string; category: string | null };

export async function liveClassTemplateStatuses(): Promise<LiveClassTemplateStatus[]> {
  const response = await waplify("/templates/");
  if (!response.ok) throw new Error(`Waplify answered ${response.status}`);
  const payload = (await response.json()) as { templates?: { name?: string; status?: string; category?: string }[] };
  const byName = new Map((payload.templates ?? []).map((t) => [t.name ?? "", t]));
  return LIVE_CLASS_WHATSAPP_TEMPLATES.map((t) => {
    const live = byName.get(t.name);
    return {
      name: t.name,
      audience: t.audience,
      status: live ? (live.status ?? "UNKNOWN").toUpperCase() : "MISSING",
      category: live?.category ? live.category.toUpperCase() : null,
    };
  });
}

/** Submits the templates that do not exist yet on Waplify, which passes them to Meta. */
export async function createLiveClassTemplates(): Promise<{ name: string; result: string }[]> {
  const statuses = await liveClassTemplateStatuses();
  const results: { name: string; result: string }[] = [];
  for (const t of LIVE_CLASS_WHATSAPP_TEMPLATES) {
    if (statuses.find((s) => s.name === t.name)?.status !== "MISSING") {
      results.push({ name: t.name, result: "already exists" });
      continue;
    }
    const response = await waplify("/templates/create", {
      method: "POST",
      body: JSON.stringify({
        name: t.name,
        category: "UTILITY",
        language: "en",
        header: { format: "TEXT", text: t.header },
        body: { text: t.body, examples: Object.fromEntries(t.examples.map((v, i) => [String(i + 1), v])) },
        buttons: [{ type: "URL", text: t.button, url: CLASSROOM_URL, url_example: CLASSROOM_URL_EXAMPLE }],
      }),
    });
    const text = await response.text();
    results.push({ name: t.name, result: response.ok ? "submitted to Meta" : `failed ${response.status}: ${text.slice(0, 300)}` });
  }
  return results;
}

let approvedCache: { at: number; names: Set<string> } | null = null;

async function approvedNames(): Promise<Set<string>> {
  if (approvedCache && Date.now() - approvedCache.at < 10 * 60000) return approvedCache.names;
  try {
    const statuses = await liveClassTemplateStatuses();
    approvedCache = { at: Date.now(), names: new Set(statuses.filter((s) => s.status === "APPROVED").map((s) => s.name)) };
  } catch (error) {
    console.warn("[liveClassWhatsApp] could not list templates:", error);
    approvedCache = { at: Date.now(), names: new Set() };
  }
  return approvedCache.names;
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";
const indianMobile = (raw: string | null | undefined) => {
  const digits = (raw ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
};

/** Sends the WhatsApp reminder for one booking to the student and the teacher. Never throws. */
export async function sendClassReminderWhatsApp(bookingId: string): Promise<void> {
  try {
    const approved = await approvedNames();
    if (approved.size === 0) return;
    const b = await db
      .selectFrom("mentorshipBookings")
      .innerJoin("users as student", "student.id", "mentorshipBookings.studentId")
      .innerJoin("users as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .select([
        "mentorshipBookings.scheduledAt",
        "student.displayName as studentName",
        "student.mobileNumber as studentMobile",
        "teacher.displayName as teacherName",
        "teacher.mobileNumber as teacherMobile",
      ])
      .where("mentorshipBookings.id", "=", bookingId)
      .executeTakeFirst();
    if (!b) return;
    const when = formatIst(new Date(b.scheduledAt));
    const sends = [
      {
        template: "tk_live_class_reminder",
        phone: indianMobile(b.studentMobile),
        name: b.studentName,
        variables: [firstName(b.studentName), b.teacherName, when],
      },
      {
        template: "tk_live_class_reminder_teacher",
        phone: indianMobile(b.teacherMobile),
        name: b.teacherName,
        variables: [firstName(b.teacherName), b.studentName, when],
      },
    ];
    for (const s of sends) {
      if (!s.phone || !approved.has(s.template)) continue;
      const outcome = await sendWhatsAppTemplate({
        phone: s.phone,
        template: s.template,
        name: s.name,
        variables: s.variables,
        linkCode: bookingId,
      });
      if (!outcome.ok) console.warn(`[liveClassWhatsApp] ${s.template} for booking ${bookingId} failed: ${outcome.error}`);
    }
  } catch (error) {
    console.error(`[liveClassWhatsApp] reminder for booking ${bookingId} failed:`, error);
  }
}
