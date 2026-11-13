import { defineScreens, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Details } from "../endpoints/mentorship/classroom/details_GET.schema";
import type { OutputType as Join } from "../endpoints/mentorship/classroom/join_POST.schema";
import type { OutputType as ChatList, ChatMessageOut } from "../endpoints/mentorship/classroom/chat/list_GET.schema";
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
    trialFollowUp: null,
  };
};

/* The development mock provider: Join opens the in-call screen with no media connection. */
const mockJoin: Join = {
  roomId: "mock-room",
  token: "mock-token",
  url: "mock://classroom",
  expiresAt: new Date(Date.now() + 60 * MIN),
  provider: "mock",
  role: "learner",
  attendanceId: "8a1d2c4e-0b7f-4f9a-9c1e-2d3b4a5c6d7e",
  title: "Trial 1:1 session (25 min)",
};

const chatMessage = (id: string, minutesAgo: number, fromTeacher: boolean, body: string): ChatMessageOut => ({
  id,
  senderId: fromTeacher ? 3 : exampleStudentSession.user.id,
  senderName: fromTeacher ? "MockVerse" : exampleStudentSession.user.displayName,
  senderAvatarUrl: null,
  body,
  createdAt: new Date(Date.now() - minutesAgo * MIN),
});

const chatHistory: ChatList = {
  messages: [
    chatMessage("00000000-0000-4000-8000-000000000001", 6, true, "Hi! I'll join in a minute. Keep your notebook ready."),
    chatMessage("00000000-0000-4000-8000-000000000002", 5, false, "Sure, I have last week's questions here."),
    chatMessage("00000000-0000-4000-8000-000000000003", 5, false, "Can we start with question 4?"),
  ],
};

let sentCount = 0;
const inCallBackend = {
  "mentorship/classroom/details_GET": detailsStartingIn(-2),
  "mentorship/classroom/join_POST": mockJoin,
  "mentorship/classroom/leave_POST": { ok: true },
  "mentorship/classroom/chat/list_GET": chatHistory,
  "mentorship/classroom/chat/send_POST": async (req: Request) => {
    const body = (await req.json()) as { json?: { body?: string } };
    sentCount += 1;
    return { message: chatMessage(`00000000-0000-4000-8000-1000000000${String(sentCount).padStart(2, "0")}`, 0, false, body.json?.body ?? "") };
  },
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
      title: "In call, waiting for teacher",
      description: "Development mock provider: press Join to open the in-call screen with no media connection",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: inCallBackend,
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
      title: "After the class: chat and whiteboard",
      description: "Join window closed: the saved chat and whiteboard, view only",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: {
        "mentorship/classroom/details_GET": detailsStartingIn(-120),
        "mentorship/classroom/chat/list_GET": chatHistory,
        "mentorship/classroom/whiteboard/get_GET": {
          ops: [
            { id: "b1", by: "user-3", kind: "rect", color: "#1f2937", size: 4, x1: 120, y1: 120, x2: 700, y2: 460 },
            { id: "b2", by: "user-3", kind: "text", color: "#c2410c", size: 4, x: 160, y: 180, text: "Speed = Distance / Time" },
            { id: "b3", by: "user-3", kind: "pen", color: "#1d4ed8", size: 4, pts: [200, 600, 320, 640, 460, 610, 600, 660, 760, 620] },
          ],
          updatedAt: new Date(),
        },
      },
    },
    {
      title: "Trial over: choose a plan",
      description: "Student after a held trial with no package yet: rating, then Choose a plan and Try another tutor",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: {
        "mentorship/classroom/details_GET": {
          ...detailsStartingIn(-30),
          status: "completed",
          trialFollowUp: { teacherSlug: "mockverse" },
        },
      },
    },
    {
      title: "Loading",
      route: `/mentorship/classroom/booking/${BOOKING_ID}`,
      backend: { "mentorship/classroom/details_GET": pending },
    },
  ],
});
