import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Packages } from "../endpoints/mentorship/packages/list_GET.schema";
import type { OutputType as Bookings, MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import type { OutputType as Enrollments, MyGroupLessonEnrollmentRow } from "../endpoints/mentorship/group-lessons/my-enrollments_GET.schema";

const MIN = 60000;
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * MIN);

const me: Session = { user: { id: 501, email: "student@example.test", displayName: "Riya Sen", avatarUrl: null, role: "student", mobileNumber: "9000000000", mobileVerified: true, emailVerified: true } };
const packages: Packages = { balance: 0, packages: [], trialFollowUps: [] };

const booking = (over: Partial<MentorshipBookingRow>): MentorshipBookingRow => ({
  id: "b1",
  status: "scheduled",
  scheduledAt: at(60),
  durationMinutes: 25,
  amountPaid: 49,
  sessionTitle: "Trial class (25 min)",
  isTrial: true,
  teacherId: 7,
  teacherName: "MockVerse",
  teacherAvatarUrl: null,
  studentId: 501,
  studentName: "Riya Sen",
  studentAvatarUrl: null,
  cancellationReason: null,
  rescheduledFromBookingId: null,
  kind: "trial",
  packageId: null,
  freeChange: true,
  canReport: false,
  issue: null,
  noShowParty: null,
  ...over,
});

const upcoming: MentorshipBookingRow[] = [
  booking({ id: "b1", scheduledAt: at(5), freeChange: false }),
  booking({ id: "b2", scheduledAt: at(26 * 60), sessionTitle: "Regular class (50 min)", durationMinutes: 50, kind: "package", isTrial: false, teacherName: "Ananya Sharma" }),
  booking({ id: "b3", scheduledAt: at(3 * 24 * 60), sessionTitle: "Regular class (50 min)", durationMinutes: 50, kind: "package", isTrial: false, teacherName: "Ananya Sharma" }),
];

const past: MentorshipBookingRow[] = [
  booking({ id: "p1", scheduledAt: at(-2 * 24 * 60), status: "completed" }),
  booking({ id: "p2", scheduledAt: at(-5 * 24 * 60), status: "no_show", noShowParty: "teacher", canReport: true, teacherName: "Ananya Sharma" }),
];

const cancelled: MentorshipBookingRow[] = [
  booking({ id: "c1", scheduledAt: at(2 * 24 * 60), status: "cancelled", cancellationReason: "Schedule conflict with my mock test." }),
];

const enrollment = (over: Partial<MyGroupLessonEnrollmentRow>): MyGroupLessonEnrollmentRow => ({
  enrollmentId: "e1",
  status: "enrolled",
  groupLessonId: "g1",
  title: "Quant shortcuts: Percentages",
  subject: "Quantitative Aptitude",
  startTime: at(3 * 60),
  durationMinutes: 60,
  amountPaid: 99,
  lessonStatus: "scheduled",
  teacherId: 9,
  teacherName: "Rahul Verma",
  teacherAvatarUrl: null,
  removedByTeacher: false,
  ...over,
});

const filterOf = (req: { url: string }) => new URL(req.url, "http://x").searchParams.get("filter") ?? "upcoming";

const bookingsFor = (req: { url: string }): Bookings => {
  const filter = filterOf(req);
  return { bookings: filter === "past" ? past : filter === "cancelled" ? cancelled : upcoming };
};

const enrollmentsFor = (req: { url: string }): Enrollments => {
  const filter = filterOf(req);
  if (filter === "past") return { enrollments: [enrollment({ enrollmentId: "e9", startTime: at(-3 * 24 * 60), lessonStatus: "completed" })] };
  if (filter === "cancelled") return { enrollments: [] };
  return {
    enrollments: [
      enrollment({}),
      enrollment({ enrollmentId: "e2", groupLessonId: "g2", title: "Reasoning: Seating arrangement drill", subject: "Reasoning", startTime: at(2 * 24 * 60) }),
    ],
  };
};

export default defineScreens({
  backend: { "auth/session_GET": me, "mentorship/packages/list_GET": packages },
  screens: [
    {
      title: "Upcoming sessions",
      description: "First class is inside its join window; later ones show when the room opens",
      backend: { "mentorship/bookings/list_GET": bookingsFor, "mentorship/group-lessons/my-enrollments_GET": enrollmentsFor },
    },
    {
      title: "One upcoming session",
      backend: {
        "mentorship/bookings/list_GET": (req: { url: string }): Bookings =>
          filterOf(req) === "upcoming" ? { bookings: [booking({ id: "s1", scheduledAt: at(40) })] } : { bookings: [] },
        "mentorship/group-lessons/my-enrollments_GET": enrollmentsFor,
      },
    },
    {
      title: "Loading",
      backend: { "mentorship/bookings/list_GET": pending, "mentorship/group-lessons/my-enrollments_GET": pending },
    },
  ],
});
