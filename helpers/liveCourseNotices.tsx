import { db } from "./db";
import { sendEmail } from "./sendEmail";
import {
  escapeEmailHtml as esc,
  formatEmailDateTime as formatDate,
  formatEmailRupees as rupees,
  getBrandedEmailHtml,
} from "./emailBaseTemplate";
import { waplify } from "./autopilotWhatsAppTemplates";
import { sendWhatsAppTemplate } from "./autopilotChannels";
import { formatIstShort } from "./liveCourseRules";
import { enrolledStudents, type CourseStudent } from "./liveCourseServer";

/*
 * Live course notices: email plus WhatsApp to students, email to the teacher. Every WhatsApp
 * template here is UTILITY (a transaction or schedule update, no offers) and is used only once Meta
 * has approved it on Waplify. Every send is awaited by the caller (Floot drops work after a handler
 * returns) and never throws.
 */

const SITE = "https://testkart.in";
const studentCourseUrl = (courseId: string) => `${SITE}/student/live-courses/${courseId}`;
const classroomUrl = (classId: string) => `${SITE}/mentorship/classroom/group/${classId}`;

type WaTemplate = {
  name: string;
  header: string;
  body: string;
  examples: string[];
  button: string;
  url: string;
  urlExample: string;
};

export const LIVE_COURSE_WHATSAPP_TEMPLATES: WaTemplate[] = [
  {
    name: "tk_live_course_enrolled",
    header: "Enrolment confirmed",
    body: "Hi {{1}},\n\nYour seat in the live course *{{2}}* is confirmed. The first class is on *{{3}}*.\n\nYou can see the full timetable from the link below.",
    examples: ["Priya", "SSC CGL Maths Batch", "Sun, 6 Dec, 7:00 pm"],
    button: "View timetable",
    url: `${SITE}/student/live-courses/{{1}}`,
    urlExample: `${SITE}/student/live-courses/3f1c2a9e-5b7d-4e2a-9c1f-8d6b4a2e7c10`,
  },
  {
    name: "tk_live_course_class_reminder",
    header: "Class reminder",
    body: "Hi {{1}},\n\nYour live class *{{2}}* of the course *{{3}}* starts on *{{4}}*.\n\nThe classroom opens 10 minutes before. Join from the link below.",
    examples: ["Priya", "Percentages", "SSC CGL Maths Batch", "Tue, 8 Dec, 7:00 pm"],
    button: "Open classroom",
    url: `${SITE}/mentorship/classroom/group/{{1}}`,
    urlExample: `${SITE}/mentorship/classroom/group/3f1c2a9e-5b7d-4e2a-9c1f-8d6b4a2e7c10`,
  },
  {
    name: "tk_live_course_class_update",
    header: "Timetable update",
    body: "Hi {{1}},\n\nThere is a change in your live course *{{2}}*: {{3}}.\n\nSee the updated timetable from the link below.",
    examples: ["Priya", "SSC CGL Maths Batch", "the class Percentages moved to Wed, 9 Dec, 7:00 pm"],
    button: "View timetable",
    url: `${SITE}/student/live-courses/{{1}}`,
    urlExample: `${SITE}/student/live-courses/3f1c2a9e-5b7d-4e2a-9c1f-8d6b4a2e7c10`,
  },
  {
    name: "tk_live_course_refund",
    header: "Refund started",
    body: "Hi {{1}},\n\nYour refund of *{{2}}* for the live course *{{3}}* has been started. It reaches your original payment method in 5 to 7 working days.",
    examples: ["Priya", "Rs 4999", "SSC CGL Maths Batch"],
    button: "View my courses",
    url: `${SITE}/student/live-courses/{{1}}`,
    urlExample: `${SITE}/student/live-courses/3f1c2a9e-5b7d-4e2a-9c1f-8d6b4a2e7c10`,
  },
];

export async function liveCourseTemplateStatuses(): Promise<{ name: string; status: string; category: string | null }[]> {
  const response = await waplify("/templates/");
  if (!response.ok) throw new Error(`Waplify answered ${response.status}`);
  const payload = (await response.json()) as { templates?: { name?: string; status?: string; category?: string }[] };
  const byName = new Map((payload.templates ?? []).map((t) => [t.name ?? "", t]));
  return LIVE_COURSE_WHATSAPP_TEMPLATES.map((t) => {
    const live = byName.get(t.name);
    return {
      name: t.name,
      status: live ? (live.status ?? "UNKNOWN").toUpperCase() : "MISSING",
      category: live?.category ? live.category.toUpperCase() : null,
    };
  });
}

/** Submits the templates that do not exist yet on Waplify, which passes them to Meta for approval. */
export async function createLiveCourseTemplates(): Promise<{ name: string; result: string }[]> {
  const statuses = await liveCourseTemplateStatuses();
  const results: { name: string; result: string }[] = [];
  for (const t of LIVE_COURSE_WHATSAPP_TEMPLATES) {
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
        buttons: [{ type: "URL", text: t.button, url: t.url, url_example: t.urlExample }],
      }),
    });
    const text = await response.text();
    results.push({ name: t.name, result: response.ok ? "submitted to Meta" : `failed ${response.status}: ${text.slice(0, 300)}` });
  }
  return results;
}

let approvedCache: { at: number; names: Set<string> } | null = null;
async function approvedTemplates(): Promise<Set<string>> {
  if (approvedCache && Date.now() - approvedCache.at < 10 * 60000) return approvedCache.names;
  try {
    const statuses = await liveCourseTemplateStatuses();
    approvedCache = { at: Date.now(), names: new Set(statuses.filter((s) => s.status === "APPROVED").map((s) => s.name)) };
  } catch (error) {
    console.warn("[liveCourseNotices] could not list templates:", error);
    approvedCache = { at: Date.now(), names: new Set() };
  }
  return approvedCache.names;
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";
const indianMobile = (raw: string | null | undefined) => {
  const digits = (raw ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
};

async function inBatches<T>(items: T[], work: (item: T) => Promise<void>, size = 10) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item) => work(item).catch((e) => console.error("[liveCourseNotices]", e))));
  }
}

async function whatsApp(student: CourseStudent, template: string, variables: string[], linkCode: string) {
  const phone = indianMobile(student.mobileNumber);
  if (!phone) return;
  const approved = await approvedTemplates();
  if (!approved.has(template)) return;
  const outcome = await sendWhatsAppTemplate({ phone, template, name: student.name, variables, linkCode });
  if (!outcome.ok) console.warn(`[liveCourseNotices] ${template} to student ${student.studentId} failed: ${outcome.error}`);
}

async function email(to: string | null, subject: string, html: string, text: string) {
  if (!to) return;
  const result = await sendEmail({ to, subject, html, text });
  if (!result.success) console.warn(`[liveCourseNotices] email "${subject}" failed`);
}

type CourseInfo = { id: string; title: string; teacherId: number; teacherName: string; teacherEmail: string | null };

async function courseInfo(courseId: string): Promise<CourseInfo | null> {
  const row = await db
    .selectFrom("liveCourses")
    .innerJoin("teachers", "teachers.id", "liveCourses.teacherId")
    .select(["liveCourses.id", "liveCourses.title", "liveCourses.teacherId", "teachers.displayName as teacherName", "teachers.email as teacherEmail"])
    .where("liveCourses.id", "=", courseId)
    .executeTakeFirst();
  return row ?? null;
}

async function studentById(studentId: number): Promise<CourseStudent | null> {
  const row = await db
    .selectFrom("students")
    .select(["id as studentId", "displayName as name", "email", "mobileNumber"])
    .where("id", "=", studentId)
    .executeTakeFirst();
  return row ?? null;
}

/* ------------------------------------------------------------- enrolment --- */

export async function sendEnrolledNotices(courseId: string, studentId: number, amountPaid: number): Promise<void> {
  try {
    const [course, student, first] = await Promise.all([
      courseInfo(courseId),
      studentById(studentId),
      db
        .selectFrom("groupLessons")
        .select(["startTime"])
        .where("liveCourseId", "=", courseId)
        .where("status", "=", "scheduled")
        .where("startTime", ">", new Date())
        .orderBy("startTime", "asc")
        .executeTakeFirst(),
    ]);
    if (!course || !student) return;
    const firstWhen = first ? formatIstShort(first.startTime) : "to be announced";
    const subject = `You're enrolled: ${course.title}`;
    await email(
      student.email,
      subject,
      getBrandedEmailHtml({
        title: subject,
        preheaderText: first ? `Your first class is on ${formatDate(new Date(first.startTime))}.` : "Your seat is confirmed.",
        eyebrow: "Live course",
        accent: "success",
        heading: "Your seat is confirmed",
        bodyHtml: `<p style="margin:0;">Hi ${esc(student.name)}, you are enrolled in <strong>${esc(course.title)}</strong> with ${esc(course.teacherName)}.</p>`,
        table: [
          { label: "Course", value: esc(course.title) },
          { label: "Paid", value: rupees(amountPaid) },
          { label: "First class", value: first ? formatDate(new Date(first.startTime)) : "To be announced", emphasize: true },
        ],
        ctaLabel: "View timetable",
        ctaUrl: studentCourseUrl(course.id),
        studentAppPromo: true,
      }),
      `Hi ${student.name}, you are enrolled in "${course.title}". First class: ${firstWhen}. ${studentCourseUrl(course.id)}`
    );
    await whatsApp(student, "tk_live_course_enrolled", [firstName(student.name), course.title, firstWhen], course.id);

    const teacherSubject = `New enrolment: ${course.title}`;
    await email(
      course.teacherEmail,
      teacherSubject,
      getBrandedEmailHtml({
        title: teacherSubject,
        heading: "A student joined your live course",
        bodyHtml: `<p style="margin:0;">${esc(student.name)} enrolled in <strong>${esc(course.title)}</strong>.</p>`,
        ctaLabel: "Open the course",
        ctaUrl: `${SITE}/teacher/live-courses/${course.id}`,
      }),
      `${student.name} enrolled in "${course.title}".`
    );
  } catch (error) {
    console.error(`[liveCourseNotices] enrolment notices for course ${courseId} failed:`, error);
  }
}

/* ------------------------------------------------------------- reminders --- */

export async function sendClassReminder(classId: string, lead: "24h" | "1h"): Promise<void> {
  try {
    const cls = await db
      .selectFrom("groupLessons")
      .select(["id", "title", "startTime", "liveCourseId"])
      .where("id", "=", classId)
      .executeTakeFirst();
    if (!cls?.liveCourseId) return;
    const course = await courseInfo(cls.liveCourseId);
    if (!course) return;
    const students = await enrolledStudents(course.id);
    const when = formatIstShort(cls.startTime);
    const subject = lead === "24h" ? `Tomorrow: ${cls.title}` : `Starting in an hour: ${cls.title}`;
    await inBatches(students, async (s) => {
      await email(
        s.email,
        subject,
        getBrandedEmailHtml({
          title: subject,
          preheaderText: `${course.title} - ${when}`,
          eyebrow: "Class reminder",
          accent: "info",
          heading: lead === "24h" ? "Your class is tomorrow" : "Your class starts in an hour",
          bodyHtml: `<p style="margin:0;">Hi ${esc(s.name)}, the classroom opens 10 minutes before the start.</p>`,
          table: [
            { label: "Class", value: esc(cls.title) },
            { label: "Course", value: esc(course.title) },
            { label: "Starts", value: formatDate(new Date(cls.startTime)), emphasize: true },
          ],
          ctaLabel: "Open classroom",
          ctaUrl: classroomUrl(cls.id),
          studentAppPromo: true,
        }),
        `Hi ${s.name}, your class "${cls.title}" (${course.title}) starts ${when}. ${classroomUrl(cls.id)}`
      );
      await whatsApp(s, "tk_live_course_class_reminder", [firstName(s.name), cls.title, course.title, when], cls.id);
    });
    const teacherSubject = lead === "24h" ? `Tomorrow you teach: ${cls.title}` : `In an hour you teach: ${cls.title}`;
    await email(
      course.teacherEmail,
      teacherSubject,
      getBrandedEmailHtml({
        title: teacherSubject,
        heading: lead === "24h" ? "You have a live class tomorrow" : "Your live class starts in an hour",
        bodyHtml: `<p style="margin:0;"><strong>${esc(cls.title)}</strong> of ${esc(course.title)}, ${esc(when)} IST, ${students.length} enrolled.</p>`,
        ctaLabel: "Open classroom",
        ctaUrl: classroomUrl(cls.id),
      }),
      `${cls.title} (${course.title}) at ${when} IST. ${classroomUrl(cls.id)}`
    );
  } catch (error) {
    console.error(`[liveCourseNotices] reminder for class ${classId} failed:`, error);
  }
}

/* --------------------------------------------------------- class changes --- */

export type ClassChange =
  | { kind: "added"; title: string; startTime: Date }
  | { kind: "rescheduled"; title: string; from: Date; to: Date }
  | { kind: "cancelled"; title: string; startTime: Date; reason?: string | null };

const describeChange = (c: ClassChange): string =>
  c.kind === "added"
    ? `a new class ${c.title} is added on ${formatIstShort(c.startTime)}`
    : c.kind === "rescheduled"
      ? `the class ${c.title} moved from ${formatIstShort(c.from)} to ${formatIstShort(c.to)}`
      : `the class ${c.title} on ${formatIstShort(c.startTime)} is cancelled`;

/** Tells every enrolled student about class changes. Several changes go out as one notice. */
export async function sendClassChangeNotices(courseId: string, changes: ClassChange[]): Promise<void> {
  if (changes.length === 0) return;
  try {
    const course = await courseInfo(courseId);
    if (!course) return;
    const students = await enrolledStudents(courseId);
    if (students.length === 0) return;
    const lines = changes.map(describeChange);
    const summary = changes.length === 1 ? lines[0] : `${changes.length} classes changed`;
    const reason = changes.length === 1 && changes[0].kind === "cancelled" ? changes[0].reason : null;
    const subject = `Timetable update: ${course.title}`;
    await inBatches(students, async (s) => {
      await email(
        s.email,
        subject,
        getBrandedEmailHtml({
          title: subject,
          preheaderText: lines[0],
          eyebrow: "Timetable update",
          accent: "warning",
          heading: "Your timetable changed",
          bodyHtml: `<p style="margin:0 0 12px;">Hi ${esc(s.name)}, ${esc(course.teacherName)} updated <strong>${esc(course.title)}</strong>:</p><ul style="margin:0;padding-left:18px;">${lines
            .map((l) => `<li style="margin:0 0 6px;">${esc(l.charAt(0).toUpperCase() + l.slice(1))} (IST)</li>`)
            .join("")}</ul>${reason ? `<p style="margin:12px 0 0;">Reason: ${esc(reason)}</p>` : ""}`,
          ctaLabel: "View timetable",
          ctaUrl: studentCourseUrl(course.id),
          studentAppPromo: true,
        }),
        `Hi ${s.name}, ${course.title} changed: ${lines.join("; ")}. ${studentCourseUrl(course.id)}`
      );
      await whatsApp(s, "tk_live_course_class_update", [firstName(s.name), course.title, summary], course.id);
    });
  } catch (error) {
    console.error(`[liveCourseNotices] change notices for course ${courseId} failed:`, error);
  }
}

/* --------------------------------------------------------------- refunds --- */

/** `partial`: a share back for classes that will not be held; the student keeps the seat. */
export async function sendRefundNotices(
  courseId: string,
  studentId: number,
  amount: number,
  reason?: string,
  opts?: { partial?: boolean }
): Promise<void> {
  try {
    const [course, student] = await Promise.all([courseInfo(courseId), studentById(studentId)]);
    if (!course || !student) return;
    const subject = `Refund started: ${course.title}`;
    await email(
      student.email,
      subject,
      getBrandedEmailHtml({
        title: subject,
        eyebrow: "Refund",
        accent: "success",
        heading: "Your refund has started",
        bodyHtml: `<p style="margin:0;">Hi ${esc(student.name)}, we have refunded <strong>${rupees(amount)}</strong> for <strong>${esc(course.title)}</strong>. It reaches your original payment method in 5 to 7 working days.</p>${reason ? `<p style="margin:12px 0 0;">${esc(reason)}</p>` : ""}`,
        ctaLabel: "View my courses",
        ctaUrl: `${SITE}/student/live-courses`,
        studentAppPromo: true,
      }),
      `Hi ${student.name}, your refund of ${rupees(amount)} for "${course.title}" has started. It reaches your original payment method in 5 to 7 working days.`
    );
    await whatsApp(student, "tk_live_course_refund", [firstName(student.name), `Rs ${amount}`, course.title], course.id);
    const teacherSubject = `Refund: ${course.title}`;
    const teacherLine = opts?.partial
      ? `${student.name} got ${rupees(amount)} back for classes of "${course.title}" that will not be held. They keep their seat.`
      : `${student.name} was refunded for "${course.title}" and no longer has a seat.`;
    await email(
      course.teacherEmail,
      teacherSubject,
      getBrandedEmailHtml({
        title: teacherSubject,
        heading: opts?.partial ? "A student got a partial refund" : "A student left your live course",
        bodyHtml: `<p style="margin:0;">${esc(teacherLine)}</p>`,
        ctaLabel: "Open the course",
        ctaUrl: `${SITE}/teacher/live-courses/${course.id}`,
      }),
      teacherLine
    );
  } catch (error) {
    console.error(`[liveCourseNotices] refund notices for course ${courseId} failed:`, error);
  }
}
