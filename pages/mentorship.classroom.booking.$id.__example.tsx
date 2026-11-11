import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Details } from "../endpoints/mentorship/classroom/details_GET.schema";
import { exampleStudentSession } from "../helpers/spinWinExampleData";

const BOOKING_ID = "d7870999-fb5a-4200-8f87-f15f6f1be76b";
const MIN = 60000;

const detailsStartingIn = (minutes: number): Details => {
  const startTime = new Date(Date.now() + minutes * MIN);
  return {
    kind: "booking",
    id: BOOKING_ID,
    title: "Trial 1:1 session (25 min)",
    teacherId: 3,
    teacherName: "MockVerse",
    teacherAvatarUrl: null,
    startTime,
    durationMinutes: 25,
    status: "scheduled",
    viewerRole: "learner",
    roster: [
      { id: 3, name: "MockVerse", avatarUrl: null, role: "teacher" },
      { id: exampleStudentSession.user.id, name: exampleStudentSession.user.displayName, avatarUrl: null, role: "learner" },
    ],
    materialsCount: 0,
    joinWindow: {
      isOpen: minutes <= 10 && minutes >= -55,
      opensAt: new Date(startTime.getTime() - 10 * MIN),
      closesAt: new Date(startTime.getTime() + 55 * MIN),
    },
    videoProvider: "daily",
  };
};

export default defineScreens({
  backend: {
    "auth/session_GET": exampleStudentSession as Session,
    "mentorship/classroom/materials/list_GET": { materials: [] },
  },
  screens: [
    {
      title: "Ready to join",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: { "mentorship/classroom/details_GET": detailsStartingIn(-2) },
    },
    {
      title: "Many participants",
      description: "Five people: the stage shows three avatars and +2; the list scrolls",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: {
        "mentorship/classroom/details_GET": (() => {
          const d = detailsStartingIn(-2);
          return {
            ...d,
            roster: [
              ...d.roster,
              { id: 9101, name: "Ananya Rao", avatarUrl: null, role: "learner" as const },
              { id: 9102, name: "Kabir Sethi", avatarUrl: null, role: "learner" as const },
              { id: 9103, name: "Meera Iyer", avatarUrl: null, role: "learner" as const },
            ],
          };
        })(),
      },
    },
    {
      title: "Room not open yet",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: { "mentorship/classroom/details_GET": detailsStartingIn(40) },
    },
    {
      title: "Join window closed",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: { "mentorship/classroom/details_GET": detailsStartingIn(-120) },
    },
    {
      title: "Loading",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: { "mentorship/classroom/details_GET": pending },
    },
  ],
});
