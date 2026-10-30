import { defineScreens, pending, httpError, delayed } from "@floot/examples";
import type { OutputType as Reviews } from "../endpoints/reviews/external_GET.schema";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Cart } from "../endpoints/cart/items_GET.schema";
import { exampleCampaignView, exampleGuestWon, exampleStudentClaimed, exampleStudentSession, wonTenPercent } from "../helpers/spinWinExampleData";

const source = {
  name: "AmbitionBox",
  url: "https://www.ambitionbox.com/overview/testkart-overview?utm_source=employer-dashboard&utm_campaign=testkart&utm_medium=badges",
} as const;

const empty: Reviews = { source, summary: null, categories: [], asOf: null, reviews: [] };

/* What ships today: the four category scores from the employer badge, no
   overall rating, count or review text. */
const today: Reviews = {
  source,
  summary: null,
  categories: [
    { label: "Work Satisfaction", value: 4.3 },
    { label: "Company Culture", value: 4.3 },
    { label: "Work-Life Balance", value: 4.2 },
    { label: "Skill Development", value: 4.2 },
  ],
  asOf: "2026-10-16",
  reviews: [],
};

/* Layout fixtures only. The text is deliberately generic and the figures are
   not Testkart's: no real review has been approved for reuse, so this shows
   the section's layout and never ships. */
const sample: Reviews = {
  source,
  summary: { rating: 4.3, reviewCount: 120 },
  categories: [
    { label: "Layout fixture A", value: 4.2 },
    { label: "Layout fixture B", value: 3.8 },
    { label: "Layout fixture C", value: 4.5 },
    { label: "Layout fixture D", value: 3.1 },
  ],
  asOf: "2026-10-16",
  reviews: [
    {
      id: "1",
      title: "Layout fixture - short title",
      excerpt: "Layout fixture. This text only shows how an excerpt wraps inside a card. It is not a review.",
      rating: 4,
      reviewerLabel: "Designation shown when public",
      postedOn: new Date("2026-08-01"),
      url: null,
      tags: ["Tag one", "Tag two"],
    },
    {
      id: "2",
      title: null,
      excerpt: "Layout fixture without a title or tags. A longer excerpt wraps over several lines and is clamped after five, so one long review never makes the others look empty. ".repeat(2),
      rating: null,
      reviewerLabel: null,
      postedOn: null,
      url: null,
      tags: [],
    },
    {
      id: "3",
      title: "Layout fixture - a longer title that wraps onto a second line",
      excerpt: "Layout fixture. Not a review.",
      rating: 5,
      reviewerLabel: "Experience shown when public",
      postedOn: new Date("2026-07-01"),
      url: null,
      tags: ["Tag one", "Tag two", "Tag three"],
    },
    {
      id: "4",
      title: "Layout fixture - fourth card, not shown",
      excerpt: "Layout fixture. Only the first three reviews render.",
      rating: 3.5,
      reviewerLabel: null,
      postedOn: new Date("2026-06-01"),
      url: null,
      tags: [],
    },
  ],
};

export default defineScreens({
  backend: {
    "auth/session_GET": { error: "Not authenticated" } as Session,
    "cart/items_GET": { items: [], autoCoupon: null } as Cart,
    "spin-win/active_GET": { active: null },
  },
  screens: [
    {
      title: "Category ratings only",
      description: "What ships today: the four badge categories and a link to AmbitionBox",
      route: "/about",
      backend: { "reviews/external_GET": today },
    },
    {
      title: "No ratings at all",
      description: "Nothing verified: the section links to AmbitionBox",
      route: "/about",
      backend: { "reviews/external_GET": empty },
    },
    {
      title: "Loading",
      route: "/about",
      backend: { "reviews/external_GET": pending },
    },
    {
      title: "Load failed",
      route: "/about",
      backend: { "reviews/external_GET": httpError(500) },
    },
    {
      title: "Layout fixtures with a rating",
      description: "Not real reviews - shows rating, bars and cards once a feed is approved",
      route: "/about",
      backend: { "reviews/external_GET": sample },
    },
    {
      title: "Spin & Win popup - ready to spin",
      description: "The Diwali popup opened over a public page, before the spin",
      route: "/about?spin=open",
      backend: {
        "reviews/external_GET": today,
        "spin-win/active_GET": { active: exampleCampaignView },
        "spin-win/spin_POST": delayed(400, { spin: wonTenPercent, alreadySpun: false, message: null }),
      },
    },
    {
      title: "Spin & Win popup - guest won",
      description: "A guest's saved reward, waiting for login to claim",
      route: "/about?spin=open",
      backend: { "reviews/external_GET": today, "spin-win/active_GET": { active: exampleGuestWon } },
    },
    {
      title: "Spin & Win popup - coupon claimed",
      description: "A signed-in student's coupon with Copy Code and Shop Now",
      route: "/about?spin=open",
      backend: {
        "reviews/external_GET": today,
        "auth/session_GET": exampleStudentSession as Session,
        "spin-win/active_GET": { active: exampleStudentClaimed },
      },
    },
  ],
});
