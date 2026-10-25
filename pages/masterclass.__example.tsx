import { defineScreens, httpError, pending } from "@floot/examples";
import type { MasterclassListItem, OutputType } from "../endpoints/masterclasses/list_GET.schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const COVER = "https://cdn.testkart.in/masterclass-covers/ec91d84b-809e-4db7-85fe-5c17ef251507.png";

const item = (id: number, overrides: Partial<MasterclassListItem>): MasterclassListItem => ({
  id,
  slug: `masterclass-${id}`,
  title: "How to Grow Your Teaching Business Online (AI Special)",
  subtitle: "A free live masterclass for teachers",
  coverImageUrl: COVER,
  hostName: "Hamraj Kumar",
  hostTitle: "Founder, Testkart",
  hostImageUrl: null,
  platformLabel: "Google Meet",
  startTime: new Date(now + 7 * DAY),
  durationMinutes: 120,
  capacity: null,
  registrantCount: 27,
  isPast: false,
  ...overrides,
});

const upcoming = [
  item(1, { startTime: new Date(now - HOUR), registrantCount: 112, title: "Live now: Building Mock Tests That Students Finish" }),
  item(2, {}),
  item(3, { startTime: new Date(now + 14 * DAY), coverImageUrl: null, title: "Pricing Study Notes for Competitive Exams", subtitle: "How to set a price, run offers and grow repeat buyers on Testkart.", hostName: "Testkart Growth Team", hostTitle: null, registrantCount: 8 }),
  item(4, { startTime: new Date(now + 21 * DAY), title: "Short Videos for Teachers", subtitle: null, registrantCount: 0 }),
];

const past = [
  item(5, { startTime: new Date(now - 10 * DAY), isPast: true, registrantCount: 240, title: "Getting Started on Testkart" }),
  item(6, { startTime: new Date(now - 40 * DAY), isPast: true, coverImageUrl: null, registrantCount: 96, title: "Writing Better MCQs" }),
];

const list = (masterclasses: MasterclassListItem[]): OutputType => ({ masterclasses });
const world = { "analytics/track_POST": { success: true }, "spin-win/active_GET": { active: null } };

export default defineScreens({
  screens: [
    { title: "Grid - upcoming and past", route: "/masterclass", backend: { ...world, "masterclasses/list_GET": list([...upcoming, ...past]) } },
    { title: "Single upcoming - featured", route: "/masterclass", backend: { ...world, "masterclasses/list_GET": list([upcoming[1], ...past]) } },
    { title: "Nothing scheduled", route: "/masterclass", backend: { ...world, "masterclasses/list_GET": list([]) } },
    { title: "Loading", route: "/masterclass", backend: { ...world, "masterclasses/list_GET": pending } },
    { title: "Load failed", route: "/masterclass", backend: { ...world, "masterclasses/list_GET": httpError(500) } },
  ],
});