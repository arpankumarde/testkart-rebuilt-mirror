import { defineScreens } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { MentorshipBookingRow, OutputType as BookingsOut } from "../endpoints/mentorship/bookings/list_GET.schema";
import type { OutputType as PackagesOut } from "../endpoints/mentorship/packages/list_GET.schema";
import type { OutputType as EnrollmentsOut } from "../endpoints/mentorship/group-lessons/my-enrollments_GET.schema";
import { exampleStudentSession } from "../helpers/spinWinExampleData";

const MIN = 60000;
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * MIN);

const booking = (over: Partial<MentorshipBookingRow>): MentorshipBookingRow => ({
  id: "d7870999-fb5a-4200-8f87-f15f6f1be76b",
  status: "scheduled",
  scheduledAt: at(5),
  durationMinutes: 25,
  amountPaid: 0,
  sessionTitle: "Trial class (25 min)",
  isTrial: true,
  teacherId: 3,
  teacherName: "MockVerse",
  teacherAvatarUrl: null,
  studentId: exampleStudentSession.user.id,
  studentName: exampleStudentSession.user.displayName,
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

const byFilter: Record<string, BookingsOut> = {
  upcoming: {
    bookings: [
      booking({ id: "a1111111-1111-4111-8111-111111111111", scheduledAt: at(5), freeChange: false }),
      booking({ id: "a2222222-2222-4222-8222-222222222222", scheduledAt: at(2 * 24 * 60), sessionTitle: "1:1 class (50 min)", durationMinutes: 50, isTrial: false, kind: "single" }),
    ],
  },
  past: {
    bookings: [
      booking({ id: "b1111111-1111-4111-8111-111111111111", scheduledAt: at(-24 * 60) }),
      booking({ id: "b2222222-2222-4222-8222-222222222222", scheduledAt: at(-3 * 24 * 60), status: "completed" }),
    ],
  },
  cancelled: {
    bookings: [
      booking({ id: "c1111111-1111-4111-8111-111111111111", scheduledAt: at(-2 * 24 * 60), status: "cancelled", cancellationReason: "Schedule conflict" }),
    ],
  },
};

const packages: PackagesOut = { balance: 0, packages: [], trialFollowUps: [] };
const enrollments: EnrollmentsOut = { enrollments: [] };

export default defineScreens({
  backend: {
    "auth/session_GET": exampleStudentSession as Session,
    "mentorship/packages/list_GET": packages,
    "mentorship/group-lessons/my-enrollments_GET": enrollments,
    "mentorship/bookings/list_GET": (req: Request) => {
      const filter = new URL(req.url, "http://localhost").searchParams.get("filter") ?? "upcoming";
      return byFilter[filter] ?? { bookings: [] };
    },
  },
  screens: [
    {
      title: "1:1 sessions",
      description: "Upcoming shows Classroom only inside the join window; Past and Cancelled have no join or change actions",
    },
  ],
});
