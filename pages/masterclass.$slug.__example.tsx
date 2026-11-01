import { defineScreens, httpError, pending } from "@floot/examples";
import type { MasterclassDetail, OutputType } from "../endpoints/masterclasses/get_GET.schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const route = "/masterclass/grow-your-teaching-business-online-ai-special";

const base: MasterclassDetail = {
  id: 2,
  slug: "grow-your-teaching-business-online-ai-special",
  title: "How to Grow Your Teaching Business Online (AI Special)",
  subtitle: "A free live masterclass for teachers",
  description:
    "Join Hamraj Kumar, Founder of Testkart, for a live session on growing your teaching business online, with a special focus on using AI tools effectively.\n\n## What you'll learn\n- Turn your notes into sellable study material\n- Price mock tests and bundles for your exam\n- Use AI to draft questions and check them faster\n- Grow followers on your Testkart profile\n\n## About the host\nHamraj founded Testkart to help teachers earn from what they teach.\n\n## Before you join\nKeep a notebook ready. The session ends with a Q&A.",
  coverImageUrl: "https://cdn.testkart.in/platform/masterclass/ec91d84b-809e-4db7-85fe-5c17ef251507.png",
  hostName: "Hamraj Kumar",
  hostTitle: "Founder, Testkart",
  hostImageUrl: null,
  coHosts: [],
  platformLabel: "Google Meet",
  startTime: new Date(now + 7 * DAY),
  durationMinutes: 120,
  capacity: null,
  status: "published",
  registrantCount: 27,
  isPast: false,
  isFull: false,
  isRegistered: false,
  joinUrl: null,
  prefill: null,
};

const detail = (overrides: Partial<MasterclassDetail>): OutputType => ({ masterclass: { ...base, ...overrides } });
const world = {
  "analytics/track_POST": { success: true },
  "spin-win/active_GET": { active: null },
  "masterclasses/register_POST": { success: true, alreadyRegistered: false, joinUrl: null },
};

export default defineScreens({
  screens: [
    { title: "Open for registration", route, backend: { ...world, "masterclasses/get_GET": detail({}) } },
    {
      title: "With co-hosts",
      route,
      backend: {
        ...world,
        "masterclasses/get_GET": detail({
          coHosts: [
            {
              type: "admin",
              name: "Ritika Sharma",
              title: "Faculty, Reasoning",
              profileImage: null,
              organization: null,
              website: null,
            },
            {
              type: "guest",
              name: "Aman Verma",
              title: "Content Lead",
              profileImage: null,
              organization: "Learnwise Media",
              website: "https://example.com/aman",
            },
          ],
        }),
      },
    },
    { title: "Few spots left", route, backend: { ...world, "masterclasses/get_GET": detail({ capacity: 40, registrantCount: 31 }) } },
    { title: "Plain description only", route, backend: { ...world, "masterclasses/get_GET": detail({ description: "Join Hamraj Kumar, Founder of Testkart, for a live session on growing your teaching business online, with a special focus on using AI tools effectively.", coverImageUrl: null }) } },
    { title: "Already registered", route, backend: { ...world, "masterclasses/get_GET": detail({ isRegistered: true }) } },
    { title: "Registered - starting soon", route, backend: { ...world, "masterclasses/get_GET": detail({ isRegistered: true, startTime: new Date(now + 10 * 60 * 1000), joinUrl: "https://meet.google.com/abc-defg-hij" }) } },
    { title: "Live - registration closed", route, backend: { ...world, "masterclasses/get_GET": detail({ startTime: new Date(now - HOUR) }) } },
    { title: "Fully booked", route, backend: { ...world, "masterclasses/get_GET": detail({ capacity: 27, isFull: true }) } },
    { title: "Completed", route, backend: { ...world, "masterclasses/get_GET": detail({ startTime: new Date(now - 5 * DAY), isPast: true }) } },
    { title: "Cancelled", route, backend: { ...world, "masterclasses/get_GET": detail({ status: "cancelled" }) } },
    { title: "Loading", route, backend: { ...world, "masterclasses/get_GET": pending } },
    { title: "Not found", route, backend: { ...world, "masterclasses/get_GET": httpError(404) } },
  ],
});