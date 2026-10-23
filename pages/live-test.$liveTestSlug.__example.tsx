import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Details } from "../endpoints/live-tests/details_GET.schema";
import type { OutputType as Leaderboard } from "../endpoints/live-tests/leaderboard_GET.schema";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Promos } from "../endpoints/promo-codes/public_GET.schema";

const HOUR = 60 * 60 * 1000;
const now = Date.now();

const details = {
  id: 204,
  title: "Indian Geography Mock Test [250 MCQ (Hindi Medium)] for All competitive exam",
  description: "<p>Practice the full Indian Geography syllabus under exam conditions.</p>",
  thumbnailUrl: "https://cdn.testkart.in/thumbnails/live-tests/6e11f0bd-53a9-4954-99a2-b0dd3ded95ae.jpg",
  introVideoUrl: null,
  price: 499,
  discountPrice: 99,
  isFree: false,
  startTime: new Date(now - HOUR),
  endTime: new Date(now + 76 * 24 * HOUR),
  registrationDeadline: null,
  maxSeats: 100,
  enrolledCount: 7,
  hasPrizes: false,
  totalPrizePool: 0,
  firstPrize: 0,
  secondPrize: 0,
  thirdPrize: 0,
  isEnrolled: false,
  canEnroll: true,
  hasAttempted: false,
  examSlug: "ssc-cgl",
  slug: "indian-geography-mock-test",
  teacherIsVerified: true,
  teacherSlug: "studyforge-academy",
  teacherProfile: {
    id: 1,
    name: "StudyForge Academy",
    avatarUrl: null,
    bio: "Exam-focused mock tests for competitive exams.",
    websiteUrl: null,
    socialLinks: null,
    awardsCertificates: null,
  },
  mockTestDetails: {
    id: 1,
    title: "Indian Geography",
    description: null,
    examName: "SSC CGL",
    durationMinutes: 90,
    totalQuestions: 250,
    subject: "Indian Geography, Indian Geography 2, Indian Geography 3",
    firstTestItemId: 1,
  },
  disclaimer: "",
} as unknown as Details;

const student = {
  user: {
    id: 9001,
    email: "student@example.com",
    displayName: "Asha Student",
    avatarUrl: null,
    role: "student",
  },
} as Session;

const leaderboard: Leaderboard = {
  leaderboard: [
    { rank: 1, studentName: "Riya Sharma", score: 212.5, timeTaken: 74 },
    { rank: 2, studentName: "Asha Student", score: 198, timeTaken: 81 },
    { rank: 3, studentName: "Karan Mehta", score: 190.25, timeTaken: 85 },
  ],
  currentUserRank: null,
  currentUserStatus: "not_enrolled",
  testStatus: "ongoing",
  dynamicPrizes: null,
};

const noPromos: Promos = { promoCodes: [] };
const guest = { error: "Not authenticated" } as Session;

const world = {
  "live-tests/details_GET": details,
  "live-tests/leaderboard_GET": leaderboard,
  "promo-codes/public_GET": noPromos,
  "analytics/track_POST": { success: true },
};

export default defineScreens({
  screens: [
    {
      title: "Signed out - opens on About",
      route: "/live-test/indian-geography-mock-test",
      description: "No session: About is the default tab and Leaderboard asks for a login when chosen",
      backend: { ...world, "auth/session_GET": guest },
    },
    {
      title: "Signed in - opens on Leaderboard",
      route: "/live-test/indian-geography-mock-test",
      description: "Student session: the leaderboard loads immediately",
      backend: { ...world, "auth/session_GET": student },
    },
    {
      title: "Session still resolving",
      route: "/live-test/indian-geography-mock-test",
      description: "Neither tab is shown until the session answers",
      backend: { ...world, "auth/session_GET": pending },
    },
  ],
});
