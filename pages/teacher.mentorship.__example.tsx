import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Status } from "../endpoints/teacher/live-teaching/status_GET.schema";
import type { OutputType as Rate } from "../endpoints/teacher/mentorship/rate_GET.schema";
import type { OutputType as Availability } from "../endpoints/teacher/mentorship/availability/get_GET.schema";

const me: Session = {
  user: {
    id: 77,
    email: "teacher@example.test",
    displayName: "MockVerse",
    avatarUrl: null,
    role: "teacher",
    teacherRole: "owner",
    mobileNumber: "9000000000",
    mobileVerified: true,
    emailVerified: true,
    onboardingCompleted: true,
  },
};

const status: Status = {
  status: "approved",
  checklist: [],
  introVideoUrl: "https://cdn.testkart.in/platform/marketing/live-onboarding-sample.mp4",
  decisionReason: null,
  appliedAt: new Date("2026-10-01"),
  decidedAt: new Date("2026-10-03"),
  withdrawnAt: null,
  pendingVideo: null,
  videoRejection: null,
  isOwner: true,
};

const rate: Rate = {
  enabled: true,
  durations: [30, 60],
  prices: { class30: 199, class60: 349, trial30: 139, trial60: 175, trialDiscount: true },
  trialDiscount: true,
  minClassPrice30: 49,
  minClassPrice60: 99,
  trialDiscountPercent30: 30,
  trialDiscountPercent60: 50,
};

const w = (id: string, dayOfWeek: number, startTime: string, endTime: string, isActive = true) => ({ id, dayOfWeek, startTime, endTime, isActive });

const availability: Availability = {
  timezone: "Asia/Kolkata",
  windows: [
    w("1", 1, "09:00", "17:00"),
    w("2", 2, "09:00", "13:00"),
    w("3", 2, "18:00", "23:50"),
    w("4", 3, "09:00", "17:00"),
    w("5", 3, "12:00", "14:00"),
    w("6", 4, "09:00", "17:00", false),
    w("7", 5, "17:00", "09:00"),
  ],
  blockedDates: [
    { id: "b1", blockedDate: new Date("2026-11-24"), reason: "Family function" },
    { id: "b2", blockedDate: new Date("2026-12-25"), reason: null },
  ],
};

export default defineScreens({
  backend: {
    "auth/session_GET": me,
    "teacher/live-teaching/status_GET": status,
    "teacher/mentorship/rate_GET": rate,
    "teacher/dashboard/overview_GET": pending,
  },
  screens: [
    {
      title: "Weekly hours",
      description: "Two ranges on Tuesday, an overlap on Wednesday, Thursday off, an invalid Friday range, weekend empty",
      backend: { "teacher/mentorship/availability/get_GET": availability },
    },
    {
      title: "No hours yet",
      backend: { "teacher/mentorship/availability/get_GET": { timezone: "Asia/Kolkata", windows: [], blockedDates: [] } },
    },
  ],
});
