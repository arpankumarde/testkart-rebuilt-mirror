import { Example } from "@floot/examples";
import type { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";
import { HomepageLiveSpotlightCard } from "./HomepageLiveSpotlightCard";

const HOUR = 60 * 60 * 1000;
const now = Date.now();

const base: HomepageLiveTestSpotlight = {
  id: 1,
  slug: "neet-2026-class-11-biology-test-series",
  title: "NEET 2026 Class 11 Biology Test Series",
  examName: null,
  price: 250,
  enrolledCount: 0,
  maxSeats: 50,
  hasPrizes: false,
  totalPrizePool: 0,
  startTime: new Date(now + 100 * HOUR),
  endTime: new Date(now + 103 * HOUR),
  isLive: false,
  teacherName: "Tejas Pandey",
  teacherSlug: null,
  teacherAvatarUrl: null,
  teacherTagline: null,
  teacherYearsOfExperience: null,
  teacherIsVerified: false,
};

const upcoming = base;

const liveWithPrize: HomepageLiveTestSpotlight = {
  ...base,
  id: 2,
  title: "SSC CGL Tier 1 All-India Live Mock",
  price: 0,
  enrolledCount: 1840,
  maxSeats: 2500,
  hasPrizes: true,
  totalPrizePool: 25000,
  startTime: new Date(now - HOUR),
  endTime: new Date(now + HOUR),
  teacherName: "Testkart Originals",
  teacherIsVerified: true,
};

const startingSoonNoSeatCap: HomepageLiveTestSpotlight = {
  ...base,
  id: 3,
  title: "UGC NET Paper 1 Grand Mock - Teaching Aptitude, Research and Reasoning",
  price: 99,
  maxSeats: 0,
  hasPrizes: true,
  totalPrizePool: 150000,
  startTime: new Date(now + 5 * HOUR),
  endTime: new Date(now + 8 * HOUR),
  teacherName: "Dr. Mukesh Goyal",
  teacherIsVerified: true,
};

export default function Showcase() {
  return (
    <>
      <h1>HomepageLiveSpotlightCard</h1>
      <p>
        A live competitive mock test on the homepage. A small status chip (peach while upcoming,
        sage once live) and the countdown on top, the test and its organiser in the middle, and
        seats plus entry price grouped in a panel at the bottom.
      </p>

      <h2>States</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <Example title="Upcoming, paid" description="Seat cap, no prizes">
          <HomepageLiveSpotlightCard spotlight={upcoming} />
        </Example>
        <Example title="Live, free with prize pool" description="Verified organiser, seats filling">
          <HomepageLiveSpotlightCard spotlight={liveWithPrize} />
        </Example>
        <Example title="No seat cap, long title" description="Starts within a day, so the countdown ticks">
          <HomepageLiveSpotlightCard spotlight={startingSoonNoSeatCap} />
        </Example>
      </div>
    </>
  );
}
