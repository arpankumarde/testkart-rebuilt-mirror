import { z } from "zod";
import superjson from "superjson";

const id = z.coerce.number().int().positive().optional();

/** seriesId (optionally with itemId for one paper) or liveTestId. Neither picks the latest active one. */
export const schema = z.object({ seriesId: id, itemId: id, liveTestId: id });

export type InputType = z.infer<typeof schema>;

export type LeaderboardPaperOption = { id: number; title: string; finished: number };

export type LeaderboardSeriesOption = {
  id: number;
  title: string;
  inTrash: boolean;
  participants: number;
  lastActivityAt: Date | null;
  papers: LeaderboardPaperOption[];
};

export type LeaderboardLiveOption = {
  id: number;
  title: string;
  startTime: Date | null;
  endTime: Date;
  enrolled: number;
};

/** One paper or one live test: each student's counted attempt, best first. marks is that attempt's net marks. */
export type AttemptRow = {
  rank: number;
  studentId: number;
  name: string;
  avatarUrl: string | null;
  score: number;
  marks: number | null;
  itemId: number;
  attemptId: number;
  timeTakenMinutes: number | null;
  attempts: number | null;
  completedAt: Date | null;
};

/** A whole series: each student's best score on every paper they finished. */
export type SeriesRow = {
  studentId: number;
  name: string;
  avatarUrl: string | null;
  papersDone: number;
  averageScore: number;
  totalScore: number;
  bestScore: number;
  lastAt: Date | null;
};

export type LeaderboardBoard =
  | { kind: "paper"; seriesId: number; itemId: number; title: string; maxMarks: number | null; rows: AttemptRow[] }
  | { kind: "series"; seriesId: number; title: string; paperCount: number; rows: SeriesRow[] }
  | {
      kind: "live";
      liveTestId: number;
      title: string;
      status: "upcoming" | "live" | "ended";
      maxMarks: number | null;
      rows: AttemptRow[];
    };

export type OutputType = {
  series: LeaderboardSeriesOption[];
  liveTests: LeaderboardLiveOption[];
  board: LeaderboardBoard | null;
};

export const getTeacherPerformanceLeaderboard = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (query.seriesId) params.set("seriesId", String(query.seriesId));
  if (query.itemId) params.set("itemId", String(query.itemId));
  if (query.liveTestId) params.set("liveTestId", String(query.liveTestId));
  const result = await fetch(`/_api/teacher/performance/leaderboard?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
