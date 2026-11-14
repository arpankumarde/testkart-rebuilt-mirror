import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Status } from "../endpoints/teacher/live-teaching/status_GET.schema";
import type { OutputType as Rate } from "../endpoints/teacher/mentorship/rate_GET.schema";
import type { OutputType as Availability } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import type { LiveTeachingChecklistKey } from "../helpers/liveTeachingRules";

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
    tagline: "SSC Maths made simple",
    bio: "",
    languages: ["Hindi", "English"],
    expertiseAreas: ["Quantitative Aptitude"],
  },
};

const LABELS: Record<LiveTeachingChecklistKey, string> = {
  email: "Email address",
  phone: "Phone number",
  photo: "Profile photo",
  headline: "Headline",
  bio: "Bio of 150+ characters",
  subjects: "Subjects you teach",
  languages: "Languages you speak",
  rate: "1:1 rate",
  hours: "Weekly hours",
  video: "Intro video",
};

const checklist = (missing: LiveTeachingChecklistKey[]) =>
  (Object.keys(LABELS) as LiveTeachingChecklistKey[]).map((key) => ({
    key,
    label: LABELS[key],
    done: !missing.includes(key),
  }));

const VIDEO = "https://cdn.testkart.in/platform/marketing/live-onboarding-sample.mp4";

const base: Status = {
  status: "none",
  checklist: checklist([]),
  contact: { email: "teacher@example.test", mobileNumber: "9000000000" },
  introVideoUrl: null,
  decisionReason: null,
  appliedAt: null,
  decidedAt: null,
  withdrawnAt: null,
  pendingVideo: null,
  videoRejection: null,
  isOwner: true,
};

const fresh: Status = {
  ...base,
  contact: { email: "teacher@example.test", mobileNumber: null },
  checklist: checklist(["phone", "photo", "bio", "rate", "hours", "video"]),
};

const ready: Status = { ...base, introVideoUrl: VIDEO };

const approved: Status = {
  ...base,
  status: "approved",
  introVideoUrl: VIDEO,
  appliedAt: new Date("2026-10-01"),
  decidedAt: new Date("2026-10-03"),
};

const rate: Rate = {
  enabled: true,
  durations: [25, 50],
  prices: { classShort: 199, classFull: 349, trialShort: 139, trialFull: 175, trialDiscount: true },
  trialDiscount: true,
  minClassPriceShort: 49,
  minClassPriceFull: 99,
  trialDiscountPercentShort: 30,
  trialDiscountPercentFull: 50,
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
    "teacher/live-teaching/status_GET": approved,
    "teacher/mentorship/rate_GET": rate,
    "teacher/mentorship/availability/get_GET": availability,
    "teacher/dashboard/overview_GET": pending,
  },
  screens: [
    {
      title: "Not applied",
      description: "Landing before applying: phone, photo, bio, prices, hours and video still missing",
      route: "/teacher/mentorship",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 1 - Contact",
      description: "Email on the account, phone missing and editable",
      route: "/teacher/mentorship?step=contact",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 2 - Profile",
      route: "/teacher/mentorship?step=profile",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 3 - Prices",
      route: "/teacher/mentorship?step=prices",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 4 - Hours",
      description: "Two ranges on Tuesday, an overlap on Wednesday, Thursday off, an invalid Friday range",
      route: "/teacher/mentorship?step=hours",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 5 - Intro video",
      route: "/teacher/mentorship?step=video",
      backend: { "teacher/live-teaching/status_GET": fresh },
    },
    {
      title: "Step 6 - Review (ready)",
      route: "/teacher/mentorship?step=review",
      backend: { "teacher/live-teaching/status_GET": ready },
    },
    {
      title: "Submitted - pending approval",
      route: "/teacher/mentorship",
      backend: {
        "teacher/live-teaching/status_GET": { ...ready, status: "pending", appliedAt: new Date("2026-11-19") },
      },
    },
    {
      title: "Rejected - changes needed",
      route: "/teacher/mentorship",
      backend: {
        "teacher/live-teaching/status_GET": {
          ...ready,
          status: "rejected",
          appliedAt: new Date("2026-11-10"),
          decidedAt: new Date("2026-11-12"),
          decisionReason: "Your intro video is very quiet. Please record it again in a quieter room and say what you teach.",
        },
      },
    },
    {
      title: "Approved - Live settings",
      route: "/teacher/mentorship",
    },
    {
      title: "Approved - Availability tab",
      route: "/teacher/mentorship?tab=availability",
    },
    {
      title: "Approved - bookings off, no hours",
      route: "/teacher/mentorship",
      backend: {
        "teacher/mentorship/rate_GET": { ...rate, enabled: false },
        "teacher/mentorship/availability/get_GET": { timezone: "Asia/Kolkata", windows: [], blockedDates: [] },
      },
    },
  ],
});
