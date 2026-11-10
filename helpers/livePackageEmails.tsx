import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { escapeEmailHtml, getBrandedEmailHtml, type EmailTableRow } from "./emailBaseTemplate";
import { SITE_ORIGIN } from "./shareLinks";
import { formatRupees } from "./livePricing";
import { liveBookingPath } from "./liveBookingRoutes";

/** Emails for live 1:1 packages, trials and class reminders. None of these throw. */

export type CycleSummary = {
  packageId: string;
  studentId: number;
  teacherId: number;
  cycleNumber: number;
  classesPerWeek: number;
  classCount: number;
  classMinutes: number;
  booked: number;
  amount: number;
  endsAt: Date;
  live: boolean;
};

const STUDENT_URL = `${SITE_ORIGIN}/student/live-teaching`;
const TEACHER_URL = `${SITE_ORIGIN}/teacher/mentorship/bookings`;

export const formatIst = (d: Date) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }) + " IST";

async function people(studentId: number, teacherId: number) {
  const rows = await db
    .selectFrom("users")
    .select(["id", "slug", "email", "displayName"])
    .where("id", "in", [studentId, teacherId])
    .execute();
  return {
    student: rows.find((r) => r.id === studentId),
    teacher: rows.find((r) => r.id === teacherId),
  };
}

async function send(args: {
  to: string | null | undefined;
  student: boolean;
  subject: string;
  heading: string;
  greeting: string;
  lines: string[];
  table?: EmailTableRow[];
  ctaLabel: string;
  ctaUrl: string;
  eyebrow?: string;
}) {
  if (!args.to) return;
  try {
    const body = [`<p style="margin:0 0 12px;">Hi ${escapeEmailHtml(args.greeting || "there")},</p>`]
      .concat(args.lines.map((l) => `<p style="margin:0 0 12px;">${escapeEmailHtml(l)}</p>`))
      .join("");
    const html = getBrandedEmailHtml({
      title: args.subject,
      preheaderText: args.lines[0],
      heading: args.heading,
      bodyHtml: body,
      table: args.table,
      ctaLabel: args.ctaLabel,
      ctaUrl: args.ctaUrl,
      ...(args.student ? { studentAppPromo: true, tone: "lavender" as const, eyebrow: args.eyebrow } : { accent: "brand" as const }),
    });
    const text = [`Hi ${args.greeting || "there"},`, ...args.lines, `${args.ctaLabel}: ${args.ctaUrl}`].join("\n\n");
    await sendEmail({ to: args.to, subject: args.subject, html, text });
  } catch (error) {
    console.error(`[livePackageEmails] "${args.subject}" failed:`, error);
  }
}

export async function sendPackageStartedEmails(s: CycleSummary): Promise<void> {
  if (!s.live) return;
  const { student, teacher } = await people(s.studentId, s.teacherId);
  const waiting = s.classCount - s.booked;
  const table: EmailTableRow[] = [
    { label: "Teacher", value: escapeEmailHtml(teacher?.displayName ?? "Your teacher") },
    { label: "Plan", value: `${s.classesPerWeek} class${s.classesPerWeek > 1 ? "es" : ""} a week, ${s.classMinutes} min` },
    { label: "Classes booked", value: `${s.booked} of ${s.classCount}` },
    { label: "Paid", value: formatRupees(s.amount), emphasize: true },
    { label: "Renews", value: formatIst(s.endsAt) },
  ];
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Package active",
    subject: `Your classes with ${teacher?.displayName ?? "your teacher"} are booked`,
    heading: "Your package is active",
    greeting: student?.displayName ?? "",
    lines: [
      waiting > 0
        ? `${s.booked} classes are booked. ${waiting} more ${waiting > 1 ? "are" : "is"} waiting for you to pick a time.`
        : `All ${s.classCount} classes are booked.`,
      "You can cancel or move a class up to 6 hours before it starts.",
    ],
    table,
    ctaLabel: "See my classes",
    ctaUrl: STUDENT_URL,
  });
  await send({
    to: teacher?.email,
    student: false,
    subject: `New package: ${student?.displayName ?? "A student"} booked ${s.classesPerWeek} class${s.classesPerWeek > 1 ? "es" : ""} a week`,
    heading: "A student took a package",
    greeting: teacher?.displayName ?? "",
    lines: [
      `${student?.displayName ?? "A student"} booked ${s.classCount} classes of ${s.classMinutes} minutes over the next 4 weeks.`,
      "You are paid for each class once it is held.",
    ],
    ctaLabel: "See bookings",
    ctaUrl: TEACHER_URL,
  });
}

export async function sendRenewalPaidEmail(s: CycleSummary): Promise<void> {
  if (!s.live) return;
  const { student, teacher } = await people(s.studentId, s.teacherId);
  const waiting = s.classCount - s.booked;
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Package renewed",
    subject: `Your classes with ${teacher?.displayName ?? "your teacher"} are renewed`,
    heading: "Next 4 weeks are booked",
    greeting: student?.displayName ?? "",
    lines: [
      `We booked ${s.booked} classes at your usual times.${waiting > 0 ? ` Pick a time for the other ${waiting}.` : ""}`,
    ],
    table: [
      { label: "Paid", value: formatRupees(s.amount), emphasize: true },
      { label: "Next renewal", value: formatIst(s.endsAt) },
    ],
    ctaLabel: "See my classes",
    ctaUrl: STUDENT_URL,
  });
}

export async function sendRenewalFailedEmail(packageId: string, reason: string): Promise<void> {
  const pkg = await db.selectFrom("livePackages").select(["studentId", "teacherId"]).where("id", "=", packageId).executeTakeFirst();
  if (!pkg) return;
  const { student, teacher } = await people(pkg.studentId, pkg.teacherId);
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Payment needed",
    subject: `Autopay for your classes with ${teacher?.displayName ?? "your teacher"} did not go through`,
    heading: "Your renewal payment failed",
    greeting: student?.displayName ?? "",
    lines: [
      `The autopay debit for your next 4 weeks did not go through (${reason}).`,
      "Pay within 3 days to keep your class times. After that the package ends.",
    ],
    ctaLabel: "Pay now",
    ctaUrl: STUDENT_URL,
  });
}

export async function sendPackageCancelledEmails(packageId: string, released: number): Promise<void> {
  const pkg = await db.selectFrom("livePackages").select(["studentId", "teacherId"]).where("id", "=", packageId).executeTakeFirst();
  if (!pkg) return;
  const { student, teacher } = await people(pkg.studentId, pkg.teacherId);
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Package cancelled",
    subject: `Your package with ${teacher?.displayName ?? "your teacher"} is cancelled`,
    heading: "Package cancelled",
    greeting: student?.displayName ?? "",
    lines: [
      released > 0
        ? `${formatRupees(released)} is back in your live class balance. Use it to book classes with any teacher.`
        : "No more classes will be booked or charged.",
    ],
    ctaLabel: "Find a teacher",
    ctaUrl: `${SITE_ORIGIN}/expert`,
  });
  await send({
    to: teacher?.email,
    student: false,
    subject: `${student?.displayName ?? "A student"} cancelled their package`,
    heading: "A package was cancelled",
    greeting: teacher?.displayName ?? "",
    lines: ["Their classes more than 6 hours away are off your calendar."],
    ctaLabel: "See bookings",
    ctaUrl: TEACHER_URL,
  });
}

export async function sendClassReminderEmails(bookingId: string, window: "24h" | "1h"): Promise<void> {
  const b = await db
    .selectFrom("mentorshipBookings")
    .select(["studentId", "teacherId", "scheduledAt", "durationMinutes", "isTrial"])
    .where("id", "=", bookingId)
    .executeTakeFirst();
  if (!b) return;
  const { student, teacher } = await people(b.studentId, b.teacherId);
  const when = formatIst(new Date(b.scheduledAt));
  const label = `${b.isTrial ? "trial " : ""}class`;
  const soon = window === "1h" ? "starts within the hour" : "is tomorrow";
  const classroom = `${SITE_ORIGIN}/mentorship/classroom/booking/${bookingId}`;
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Class reminder",
    subject: `Your ${label} with ${teacher?.displayName ?? "your teacher"} ${soon}`,
    heading: window === "1h" ? "Your class starts soon" : "Your class is tomorrow",
    greeting: student?.displayName ?? "",
    lines: [`${when}, ${b.durationMinutes} minutes. The room opens 10 minutes before.`],
    ctaLabel: "Open classroom",
    ctaUrl: classroom,
  });
  await send({
    to: teacher?.email,
    student: false,
    subject: `Your ${label} with ${student?.displayName ?? "a student"} ${soon}`,
    heading: window === "1h" ? "Class starts soon" : "Class tomorrow",
    greeting: teacher?.displayName ?? "",
    lines: [`${when}, ${b.durationMinutes} minutes.`],
    ctaLabel: "Open classroom",
    ctaUrl: classroom,
  });
}

export async function sendTrialFollowUpEmail(bookingId: string): Promise<void> {
  const b = await db
    .selectFrom("mentorshipBookings")
    .select(["studentId", "teacherId"])
    .where("id", "=", bookingId)
    .executeTakeFirst();
  if (!b) return;
  const { student, teacher } = await people(b.studentId, b.teacherId);
  await send({
    to: student?.email,
    student: true,
    eyebrow: "After your trial",
    subject: `Keep learning with ${teacher?.displayName ?? "your teacher"}`,
    heading: "How was your trial?",
    greeting: student?.displayName ?? "",
    lines: [
      `Pick 1 to 6 classes a week with ${teacher?.displayName ?? "your teacher"} and lock in your times for the next 4 weeks.`,
      "Not the right fit? Try another teacher in the same subject.",
    ],
    ctaLabel: "Choose a plan",
    ctaUrl: `${SITE_ORIGIN}${liveBookingPath({ slug: teacher?.slug ?? null })}`,
  });
}

/** The class was called off because the teacher did not join, or an admin upheld the student's report. */
export async function sendClassRefundedEmail(bookingId: string, outcome: "unscheduled" | "released"): Promise<void> {
  const b = await db
    .selectFrom("mentorshipBookings")
    .select(["studentId", "teacherId", "scheduledAt", "amountPaid"])
    .where("id", "=", bookingId)
    .executeTakeFirst();
  if (!b) return;
  const { student, teacher } = await people(b.studentId, b.teacherId);
  await send({
    to: student?.email,
    student: true,
    eyebrow: "Class refunded",
    subject: `Your class on ${formatIst(new Date(b.scheduledAt))} did not happen`,
    heading: "You have not lost this class",
    greeting: student?.displayName ?? "",
    lines: [
      outcome === "unscheduled"
        ? `${teacher?.displayName ?? "The teacher"} did not take this class, so it is back in your package. Pick a new time.`
        : `${formatRupees(Number(b.amountPaid ?? 0))} is back in your live class balance. Use it to book any teacher.`,
    ],
    ctaLabel: "See my classes",
    ctaUrl: STUDENT_URL,
  });
}
