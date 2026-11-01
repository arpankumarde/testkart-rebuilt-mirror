import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Profile } from "../endpoints/teachers/profile_GET.schema";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const route = "/expert/priya-sharma";
const THUMB = "https://cdn.testkart.in/platform/masterclass/ec91d84b-809e-4db7-85fe-5c17ef251507.png";

const course = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `course-${id}`,
  title,
  examName: "SSC CGL",
  price: 999,
  discountPrice: 499,
  thumbnailImageUrl: THUMB,
  enrollmentCount: 320,
  avgRating: 4.6,
  ratingsCount: 48,
  views: 900,
  ...extra,
});

const test = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `test-${id}`,
  title,
  examName: "IBPS PO",
  price: 299,
  discountPrice: 149,
  rating: 4.4,
  reviewsCount: 31,
  totalTests: 25,
  thumbnailUrl: THUMB,
  studentsEnrolled: 540,
  totalQuestions: 2500,
  actualQuestionCount: 2500,
  views: 1200,
  ...extra,
});

const product = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `notes-${id}`,
  title,
  examName: "SSC CHSL",
  price: 99,
  rating: 4.8,
  ratingsCount: 12,
  pageCount: 120,
  fileCount: 1,
  totalPurchases: 80,
  views: 400,
  ...extra,
});

const rich = {
  teacher: {
    id: 77,
    displayName: "Priya Sharma",
    slug: "priya-sharma",
    avatarUrl: null,
    tagline: "Quantitative aptitude and reasoning for bank and SSC exams",
    bio: "I have taught quantitative aptitude for nine years, first in classrooms in Jaipur and now online.\n\nMy sessions start from first principles and build to exam-level speed, with a mock test after every topic so students can see exactly where they lose marks.",
    location: "Jaipur, Rajasthan",
    languages: ["Hindi", "English"],
    websiteUrl: "https://priyasharma.example.com",
    socialLinks: { youtube: "https://youtube.com/@example", linkedin: "https://linkedin.com/in/example", instagram: "https://instagram.com/example" },
    isVerified: true,
    academyName: "Sharma Classes",
    yearsOfExperience: 9,
    joinedAt: new Date(now - 700 * DAY),
    responseTime: "Usually responds within a day",
    expertiseAreas: ["Quantitative Aptitude", "Reasoning", { examId: 1, examName: "IBPS PO" }],
    workExperiences: [
      { id: 1, companyName: "Sharma Classes", position: "Founder and lead faculty", startDate: new Date(now - 1500 * DAY), endDate: null, isCurrent: true, description: "Runs the aptitude batches for bank and SSC aspirants and writes the mock test series.", location: "Jaipur" },
      { id: 2, companyName: "Career Point", position: "Senior faculty, Mathematics", startDate: new Date(now - 3300 * DAY), endDate: new Date(now - 1550 * DAY), isCurrent: false, description: "Taught arithmetic and data interpretation to classroom batches of 120 students.", location: "Kota" },
    ],
    awardsCertificates: [
      { title: "M.Sc. Mathematics, University of Rajasthan" },
      { title: "UGC NET qualified (Mathematics)", description: "December 2019 cycle" },
      { title: "Best Faculty Award, Career Point", description: "Highest student feedback score, 2020" },
      { title: "Testkart Top Creator, 2025" },
    ],
  },
  courses: [course(1, "Quantitative Aptitude Complete Course"), course(2, "Data Interpretation Masterclass", { price: 0, discountPrice: null }), course(3, "Reasoning Shortcuts for Bank Exams")],
  tests: [
    test(11, "IBPS PO Prelims Mock Test Series 2026"),
    test(12, "SSC CGL Tier 1 Full Mocks"),
    test(13, "SBI Clerk Prelims Sectional Tests"),
    test(14, "RRB NTPC CBT 1 Practice Set", { rating: null, reviewsCount: 0 }),
  ],
  liveTests: [],
  products: [product(21, "Arithmetic Formula Sheet (PDF)"), product(22, "Data Interpretation Practice Book", { pageCount: 240, fileCount: 3 })],
  bundles: [],
  examNames: ["IBPS PO", "SSC CGL", "SBI Clerk"],
  followerCount: 128,
  isFollowing: false,
  organization: null,
} as unknown as Profile;

const sparse = {
  ...rich,
  teacher: {
    ...rich.teacher,
    displayName: "Deep's Physics Classes",
    slug: "deeps-physics-classes",
    isVerified: false,
    tagline: null,
    bio: null,
    websiteUrl: null,
    socialLinks: null,
    academyName: null,
    yearsOfExperience: null,
    responseTime: null,
    expertiseAreas: null,
    workExperiences: [],
    awardsCertificates: [],
  },
  courses: [],
  tests: [],
  products: [],
  examNames: [],
  followerCount: 0,
} as unknown as Profile;

const student = {
  user: { id: 9001, email: "student@example.com", displayName: "Asha Student", avatarUrl: null, role: "student" },
} as Session;
const guest = { error: "Not authenticated" } as Session;

const world = {
  "teachers/posts_GET": { posts: [] },
  "analytics/track_POST": { success: true },
  "spin-win/active_GET": { active: null },
};

export default defineScreens({
  screens: [
    { title: "Verified, full profile - guest", route, backend: { ...world, "auth/session_GET": guest, "teachers/profile_GET": rich } },
    {
      title: "Student - not following",
      route,
      description: "Follow returns the new count",
      backend: { ...world, "auth/session_GET": student, "teachers/profile_GET": rich, "teachers/follow_POST": { isFollowing: true, followerCount: 129 } },
    },
    {
      title: "Student - following",
      route,
      backend: {
        ...world,
        "auth/session_GET": student,
        "teachers/profile_GET": { ...rich, isFollowing: true, followerCount: 129 },
        "teachers/follow_POST": { isFollowing: false, followerCount: 128 },
      },
    },
    { title: "Sparse profile, nothing published", route: "/expert/deeps-physics-classes", backend: { ...world, "auth/session_GET": guest, "teachers/profile_GET": sparse } },
    { title: "Loading", route, backend: { ...world, "auth/session_GET": guest, "teachers/profile_GET": pending } },
  ],
});
