/**
 * Content for the /app landing page.
 *
 * The app is Android-only: testkart-app's app.config has an empty `ios` block
 * and its ForceUpdate screen only links to Play, so the page shows no App
 * Store badge. APP_STORE_NAME is the listing's own title on Google Play
 * (checked 2026-11-17: free, with in-app purchases, category Education).
 */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.testkart.mocktest.courses.studynotes";

export const PLAY_BADGE_IMAGE =
  "https://cdn.testkart.in/platform/app/google-playstore.png";

export const APP_STORE_NAME = "Testkart: Student App";

/**
 * The app's Play Store screenshots, re-encoded as 600 x 1200 WebP (25-50 KB
 * each, down from 0.6-1.7 MB PNGs in R2 at platform/app/screenN.png) and
 * hosted as project assets under descriptive names. 9:18, the same as
 * AppPhoneMockup's screen, so each is shown whole.
 */
export interface AppScreen {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const screen = (src: string, alt: string): AppScreen => ({ src, alt, width: 600, height: 1200 });

const SCREENS = {
  homeSearch: screen(
    "/_cdn/static/6fbbcdc7-6d55-4524-bf26-5b835490a072-testkart-app-home-search-screen.webp",
    "Testkart app home screen with a search bar for exams, mock tests and courses",
  ),
  mockTestListing: screen(
    "/_cdn/static/abbcb587-9834-484f-9c9d-9295a97f87d6-testkart-app-mock-test-listing.webp",
    "Mock test listing in the Testkart app showing question count, duration, rating and price",
  ),
  coursePage: screen(
    "/_cdn/static/f72a6b27-a46c-405e-996d-c7a9f7b3808d-testkart-app-course-page.webp",
    "UGC NET recorded course page in the Testkart app with level, educator and price",
  ),
  mockTestInProgress: screen(
    "/_cdn/static/9d9b33a9-cc0d-45af-8e3e-b03faea9aac7-testkart-app-mock-test-in-progress.webp",
    "RRB Group D mock test in progress in the Testkart app with a timer and question palette",
  ),
  studentLibrary: screen(
    "/_cdn/static/5303e026-2899-4580-b477-b23c5bb13419-testkart-app-student-library.webp",
    "Student library in the Testkart app with test series progress and purchased study notes",
  ),
  liveLeaderboard: screen(
    "/_cdn/static/1fcc5925-4789-4133-9bba-731a2375ccf5-testkart-app-live-competition-leaderboard.webp",
    "Live competition leaderboard in the Testkart app ranking students by score and time",
  ),
};

export const HERO_SCREENS = {
  front: SCREENS.homeSearch,
  back: SCREENS.mockTestListing,
};

export const ALL_SCREENS: AppScreen[] = Object.values(SCREENS);

export type ArtTone = "peach" | "lavender" | "mint" | "butter" | "powder";

export interface AppFeature {
  id: string;
  label: string;
  title: string;
  description: string;
  note: string;
  href: string;
  cta: string;
  screen: AppScreen;
  tone: ArtTone;
  shape: number;
}

/**
 * Only features the shipped app has. Current affairs is web-only today (no
 * route for it in testkart-app/src/app), so it is left out until the app
 * carries it.
 */
export const APP_FEATURES: AppFeature[] = [
  {
    id: "courses",
    label: "learn",
    title: "Courses from Expert Educators",
    description:
      "Learn from recorded online courses built by teachers who prepare students for competitive exams. Every course shows its level, educator, lessons and price before you enrol, so you know exactly what you are getting.",
    note: "See the level and price before you enrol.",
    href: "/course",
    cta: "Browse online courses",
    screen: SCREENS.coursePage,
    tone: "lavender",
    shape: 1,
  },
  {
    id: "mock-tests",
    label: "practise",
    title: "Mock Tests & Previous-Year Questions",
    description:
      "Practise with full-length mock tests, test series and previous-year questions in a real exam interface, with a running timer, a question palette and subject-wise sections. Each test series lists its questions, time limit and reviews up front.",
    note: "Questions, time limit and reviews, all up front.",
    href: "/mock-test",
    cta: "Explore mock tests",
    screen: SCREENS.mockTestInProgress,
    tone: "mint",
    shape: 2,
  },
  {
    id: "study-notes",
    label: "revise",
    title: "Study Notes & PDFs",
    description:
      "Read study notes, PDFs and eBooks written by experienced teachers, right inside the app. Everything you buy stays in your library next to your test series progress, ready for quick revision.",
    note: "Free notes sit right next to the paid ones.",
    href: "/study-notes",
    cta: "Find study notes",
    screen: SCREENS.studentLibrary,
    tone: "butter",
    shape: 3,
  },
  {
    id: "live-competitions",
    label: "compete",
    title: "Live Competitions & Learning Challenges",
    description:
      "Join live tests scheduled by educators, attempt them alongside other students and see where you stand on the leaderboard. Some competitions are free to enter, and some offer prizes for the top ranks.",
    note: "Your rank, score and time on one leaderboard.",
    href: "/live-test",
    cta: "See live competitions",
    screen: SCREENS.liveLeaderboard,
    tone: "peach",
    shape: 4,
  },
];

export interface AppStep {
  title: string;
  text: string;
  tone: ArtTone;
}

export const APP_STEPS: AppStep[] = [
  {
    title: "Download the App",
    text: "Get Testkart free from Google Play, then create a student account or sign in with the one you use on testkart.in.",
    tone: "peach",
  },
  {
    title: "Explore Learning Resources",
    text: "Search for your exam to discover mock tests, expert-led courses and study notes made for it.",
    tone: "mint",
  },
  {
    title: "Start Preparing",
    text: "Practise with timed tests, learn lesson by lesson and join live competitions to see how you rank.",
    tone: "lavender",
  },
];

/**
 * Visible FAQ copy, also emitted as FAQPage structured data, so the two never
 * drift. `link.text` must appear verbatim in `answer`; it is rendered as a
 * link in place. Facts as of 2026-11-17: 1,715 exams across 27 categories;
 * free study notes, courses and live tests exist alongside paid ones.
 */
export interface AppFaq {
  question: string;
  answer: string;
  link?: { text: string; href: string };
}

export const APP_FAQS: AppFaq[] = [
  {
    question: "What is the Testkart app?",
    answer:
      "Testkart: Student App is the official Android app of Testkart, an online marketplace where educators publish mock tests, courses and study notes for competitive exams. The app brings all of it to your phone, along with live competitions and a library of everything you have bought.",
  },
  {
    question: "Is it free to download?",
    answer:
      "Yes. The app is free to download from Google Play. Some study notes, courses and live competitions are free, while paid test series, courses and notes show their price before you buy.",
  },
  {
    question: "Is it available on iPhone?",
    answer:
      "Not yet. The app is available for Android phones only. On an iPhone or iPad you can use the full Testkart website in your browser with the same account.",
  },
  {
    question: "Which exams can I prepare for?",
    answer:
      "Testkart lists over 1,700 exams across SSC, banking, railway, teaching, defence, state government recruitment, engineering, medical and more. Mock tests, courses and notes are created by educators, so what is available differs from exam to exam. Browse the full list on the Exams page.",
    link: { text: "Exams page", href: "/exams" },
  },
  {
    question: "How do live competitions work?",
    answer:
      "A live competition is a test an educator schedules for a fixed date and time. You enrol in advance, free or paid depending on the test, attempt it while it is live and then see your score and rank on the leaderboard. When a competition offers prizes, the prize for each top rank is shown on its page before you enrol.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email hello@testkart.in, call +91 96545 48384, or send us a message from the Contact page.",
    link: { text: "Contact page", href: "/contact" },
  },
];
