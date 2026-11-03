import { R2_PUBLIC_URL } from "./_publicConfigs";

/**
 * Content for the /app landing page.
 *
 * The app is Android-only: testkart-app's app.config has an empty `ios` block
 * and its ForceUpdate screen only links to Play. The hero shows a disabled
 * "Coming soon" App Store badge (AppStoreBadgeSoon) with no link.
 */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.testkart.mocktest.courses.studynotes";

export const PLAY_BADGE_IMAGE =
  "https://play.google.com/intl/en_us/badges/images/generic/en_badge_web_generic.png";

/**
 * One image per phone frame, kept in R2 as platform/app/screen1.png to
 * screen9.png and numbered in page order:
 *   1-2  hero, left (front) and right (back)
 *   3-6  feature sections, top to bottom
 *   7-9  closing section, left, centre and right
 * Each is 1080 x 2160 (9:18) and is shown whole on AppPhoneMockup's 9:18
 * screen. width and height let the browser reserve the box before the image
 * arrives.
 */
export interface AppScreen {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const screen = (n: number, alt: string): AppScreen => ({
  src: `https://${R2_PUBLIC_URL}/platform/app/screen${n}.png`,
  alt,
  width: 1080,
  height: 2160,
});

export const HERO_SCREENS = {
  front: screen(1, "Mock tests in the Testkart app"),
  back: screen(2, "Live competitions in the Testkart app"),
};

export const CLOSING_SCREENS = {
  left: screen(7, "Courses in the Testkart app"),
  center: screen(8, "The Testkart app home screen"),
  right: screen(9, "Study notes in the Testkart app"),
};

export type ArtTone = "peach" | "lavender" | "mint" | "butter" | "powder";

export interface AppFeature {
  id: string;
  label: string;
  title: string;
  description: string;
  note: string;
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
    title: "Learn from educators who know their craft.",
    description:
      "Discover expert-led courses, recorded classes and structured learning resources for your exam preparation.",
    note: "See the level, language and price before you enrol.",
    screen: screen(3, "Courses in the Testkart app"),
    tone: "lavender",
    shape: 1,
  },
  {
    id: "mock-tests",
    label: "practise",
    title: "Practice more. Improve every day.",
    description:
      "Access mock tests, previous-year questions and test series designed to help you prepare with confidence.",
    note: "Questions, time limit and reviews, all up front.",
    screen: screen(4, "Mock tests in the Testkart app"),
    tone: "mint",
    shape: 2,
  },
  {
    id: "study-notes",
    label: "revise",
    title: "Your study material, always within reach.",
    description:
      "Explore notes, PDFs and revision materials created by experienced teachers and educators.",
    note: "Free notes sit right next to the paid ones.",
    screen: screen(5, "Study notes in the Testkart app"),
    tone: "butter",
    shape: 3,
  },
  {
    id: "live-competitions",
    label: "compete",
    title: "Challenge yourself. Celebrate progress.",
    description:
      "Participate in live competitions, test your knowledge and see how you perform.",
    note: "Prize pools for the top three ranks.",
    screen: screen(6, "Live competitions in the Testkart app"),
    tone: "peach",
    shape: 4,
  },
];
