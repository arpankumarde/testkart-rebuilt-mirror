import { Example } from "@floot/examples";
import { LiveTestHero } from "./LiveTestHero";
import type { OutputType as LiveTestDetails } from "../endpoints/live-tests/details_GET.schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

const base = {
  id: 204,
  title: "Indian Geography Mock Test [250 MCQ (Hindi Medium)] for All competitive exam",
  description: null,
  thumbnailUrl: "https://cdn.testkart.in/thumbnails/live-tests/6e11f0bd-53a9-4954-99a2-b0dd3ded95ae.jpg",
  introVideoUrl: null,
  price: 499,
  discountPrice: 99,
  isFree: false,
  startTime: null,
  endTime: new Date(now + 76 * DAY),
  registrationDeadline: null,
  maxSeats: 10,
  enrolledCount: 0,
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
    bio: null,
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
    subject: "Indian Geography, Indian Geography 2, Indian Geography 3, Indian Geography 4, Indian Geography 5",
    firstTestItemId: 1,
  },
  disclaimer: "",
} as unknown as LiveTestDetails;

const upcoming: LiveTestDetails = {
  ...base,
  title: "NEET 2026 Class 11 Biology Test Series",
  startTime: new Date(now + 2 * DAY + 3 * HOUR),
  endTime: new Date(now + 2 * DAY + 5 * HOUR),
  registrationDeadline: new Date(now + 2 * DAY),
  mockTestDetails: { ...base.mockTestDetails, examName: "NEET", subject: "Biology", durationMinutes: 120, totalQuestions: 90 },
};

const liveEnrolled: LiveTestDetails = {
  ...base,
  startTime: new Date(now - 2 * HOUR),
  endTime: new Date(now + 5 * HOUR),
  isEnrolled: true,
  canEnroll: false,
  enrolledCount: 7,
};

const liveWithPrizes: LiveTestDetails = {
  ...base,
  title: "Nation Builders Quiz 2026",
  price: 49,
  discountPrice: null,
  startTime: new Date(now - HOUR),
  endTime: new Date(now + 3 * HOUR),
  hasPrizes: true,
  totalPrizePool: 5000,
  firstPrize: 2500,
  secondPrize: 1500,
  thirdPrize: 1000,
  maxSeats: 500,
  enrolledCount: 212,
  mockTestDetails: { ...base.mockTestDetails, examName: null, subject: "General Awareness", durationMinutes: 40, totalQuestions: 50 },
};

const registrationClosed: LiveTestDetails = {
  ...base,
  startTime: new Date(now + 4 * HOUR),
  endTime: new Date(now + 6 * HOUR),
  registrationDeadline: new Date(now - HOUR),
  isEnrolled: true,
  canEnroll: false,
};

const ended: LiveTestDetails = {
  ...base,
  price: 0,
  discountPrice: null,
  isFree: true,
  startTime: new Date(now - 3 * DAY),
  endTime: new Date(now - 2 * DAY),
  canEnroll: false,
  enrolledCount: 3,
};

export default function Showcase() {
  return (
    <>
      <h1>LiveTestHero</h1>
      <p>Hero of the live competition detail page. The status pill, countdown and action follow the schedule and the viewer's enrollment.</p>

      <Example title="Live - open for enrollment" fullBleed>
        <LiveTestHero liveTest={{ ...base, startTime: new Date(now - HOUR) }} />
      </Example>
      <Example title="Live - enrolled" fullBleed>
        <LiveTestHero liveTest={liveEnrolled} />
      </Example>
      <Example title="Live - prizes, single subject" fullBleed>
        <LiveTestHero liveTest={liveWithPrizes} />
      </Example>
      <Example title="Upcoming" fullBleed>
        <LiveTestHero liveTest={upcoming} />
      </Example>
      <Example title="Registration closed - enrolled" fullBleed>
        <LiveTestHero liveTest={registrationClosed} />
      </Example>
      <Example title="Ended" fullBleed>
        <LiveTestHero liveTest={ended} />
      </Example>
      <Example title="Dark theme - live with prizes" fullBleed>
        <div className="dark" style={{ backgroundColor: "var(--background)" }}>
          <LiveTestHero liveTest={liveWithPrizes} />
        </div>
      </Example>
      <Example title="Dark theme - upcoming" fullBleed>
        <div className="dark" style={{ backgroundColor: "var(--background)" }}>
          <LiveTestHero liveTest={upcoming} />
        </div>
      </Example>
      <Example title="Dark theme - ended" fullBleed>
        <div className="dark" style={{ backgroundColor: "var(--background)" }}>
          <LiveTestHero liveTest={ended} />
        </div>
      </Example>
    </>
  );
}
