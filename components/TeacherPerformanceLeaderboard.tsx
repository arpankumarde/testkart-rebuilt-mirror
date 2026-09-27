import React, { useMemo, useState } from "react";
import { Download, Trophy } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { ConsoleListToolbar } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./Select";
import {
  perfStyles as styles,
  StudentName,
  ScoreBar,
  RankBadge,
  PerformanceFacts,
  openRow,
  OpenCell,
  OpenHead,
} from "./TeacherPerformanceKit";
import type { PerformanceToolbarTabs } from "./TeacherPerformanceStudents";
import { useTeacherPerformanceLeaderboard } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import { dateText, downloadCsv, durationText, marksText, scoreText } from "../helpers/teacherPerformanceFormat";
import type { AttemptRow, SeriesRow } from "../endpoints/teacher/performance/leaderboard_GET.schema";

export type LeaderboardSelection = { seriesId?: number; itemId?: number; liveTestId?: number };

type Props = {
  toolbar: PerformanceToolbarTabs;
  selection: LeaderboardSelection;
  onSelect: (selection: LeaderboardSelection) => void;
  onOpenStudent: (studentId: number, paper?: { itemId: number; attemptId?: number }) => void;
  enabled: boolean;
};

type RankBy = "average" | "total";
const RANK_OPTIONS = [
  { value: "average" as const, label: "Average score" },
  { value: "total" as const, label: "Total score" },
];

const LIVE_STATUS: Record<string, string> = { upcoming: "Not started", live: "Live now", ended: "Ended" };

const mean = (values: number[]) => (values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length);

export const TeacherPerformanceLeaderboard = ({ toolbar, selection, onSelect, onOpenStudent, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceLeaderboard(selection, enabled);
  const [search, setSearch] = useState("");
  const [rankBy, setRankBy] = useState<RankBy>("average");

  const board = data?.board ?? null;

  const seriesOptions = useMemo(() => {
    const options = data?.series ?? [];
    if (board && board.kind !== "live" && !options.some((s) => s.id === board.seriesId)) {
      return [
        { id: board.seriesId, title: board.title, inTrash: false, participants: 0, lastActivityAt: null, papers: [] },
        ...options,
      ];
    }
    return options;
  }, [data, board]);

  const currentSeries = board && board.kind !== "live" ? seriesOptions.find((s) => s.id === board.seriesId) : undefined;
  const contentValue = board ? (board.kind === "live" ? `l:${board.liveTestId}` : `s:${board.seriesId}`) : undefined;

  const seriesRows = useMemo(() => {
    if (!board || board.kind !== "series") return [];
    const sorted = [...board.rows].sort((a, b) =>
      rankBy === "average"
        ? b.averageScore - a.averageScore || b.papersDone - a.papersDone
        : b.totalScore - a.totalScore || b.averageScore - a.averageScore
    );
    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [board, rankBy]);

  const term = search.trim().toLowerCase();
  const matches = (name: string) => !term || name.toLowerCase().includes(term);
  const visibleSeries = seriesRows.filter((row) => matches(row.name));
  const visibleAttempts: AttemptRow[] = board && board.kind !== "series" ? board.rows.filter((row) => matches(row.name)) : [];

  const exportCsv = () => {
    if (!board) return;
    const stem = `leaderboard-${board.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}`;
    if (board.kind === "series") {
      downloadCsv(
        stem,
        seriesRows.map((row) => ({
          Rank: row.rank,
          Student: row.name,
          "Average score (%)": row.averageScore,
          "Total score": row.totalScore,
          "Papers done": row.papersDone,
          "Best score (%)": row.bestScore,
          "Last attempt": dateText(row.lastAt),
        }))
      );
    } else {
      downloadCsv(
        stem,
        board.rows.map((row) => ({
          Rank: row.rank,
          Student: row.name,
          "Score (%)": row.score,
          "Time taken": durationText(row.timeTakenMinutes),
          ...(board.kind === "paper" && { Attempts: row.attempts ?? "" }),
          "Finished on": dateText(row.completedAt),
        }))
      );
    }
  };

  const toolbarBand = (
    <ConsoleListToolbar
      {...toolbar}
      search={
        board && board.rows.length > 0
          ? { value: search, onChange: setSearch, placeholder: "Find a student", label: "Find a student on this leaderboard" }
          : undefined
      }
    >
      <Button variant="outline" onClick={exportCsv} disabled={!board || board.rows.length === 0}>
        <Download size={16} />
        Export CSV
      </Button>
    </ConsoleListToolbar>
  );

  if (isError && !data) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          tone="error"
          icon={<Trophy size={22} />}
          title="The leaderboard could not be loaded"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        >
          {(selection.seriesId || selection.liveTestId) && (
            <Button variant="outline" onClick={() => onSelect({})}>
              Show the latest leaderboard
            </Button>
          )}
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        {toolbarBand}
        <Skeleton style={{ height: "5.5rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!board) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          icon={<Trophy size={22} />}
          title="No results yet"
          description="Leaderboards appear once students finish a paper in one of your test series or live tests."
        />
      </div>
    );
  }

  const scores = board.kind === "series" ? board.rows.map((r) => r.averageScore) : board.rows.map((r) => r.score);
  const top = scores.length > 0 ? Math.max(...scores) : null;

  const subtitle =
    board.kind === "live"
      ? `${LIVE_STATUS[board.status]}. First attempt in the live window, ranked as prizes are paid.`
      : board.kind === "paper"
        ? "Best attempt per student, ranked by score, then time."
        : rankBy === "average"
          ? "Average of each student's best score per paper."
          : "Sum of each student's best score per paper.";

  return (
    <div className={styles.stack}>
      {toolbarBand}

      <section className={`${styles.panel} ${isFetching ? styles.busy : ""}`} aria-busy={isFetching} aria-label="Leaderboard">
        <div className={styles.panelHeader}>
          <div className={styles.pickers}>
            <Select
              value={contentValue}
              onValueChange={(value) => {
                setSearch("");
                const [kind, raw] = value.split(":");
                onSelect(kind === "l" ? { liveTestId: Number(raw) } : { seriesId: Number(raw) });
              }}
            >
              <SelectTrigger className={styles.picker} aria-label="Test series or live test">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seriesOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Test series</SelectLabel>
                    {seriesOptions.map((s) => (
                      <SelectItem key={`s:${s.id}`} value={`s:${s.id}`}>
                        {s.title}
                        {s.inTrash ? " (in Trash)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {data.liveTests.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Live tests</SelectLabel>
                    {data.liveTests.map((l) => (
                      <SelectItem key={`l:${l.id}`} value={`l:${l.id}`}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {board.kind !== "live" && currentSeries && currentSeries.papers.length > 0 && (
              <Select
                value={board.kind === "paper" ? String(board.itemId) : "all"}
                onValueChange={(value) => {
                  setSearch("");
                  onSelect({ seriesId: board.seriesId, itemId: value === "all" ? undefined : Number(value) });
                }}
              >
                <SelectTrigger className={styles.picker} aria-label="Paper">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All papers</SelectItem>
                  {currentSeries.papers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title} ({p.finished} {p.finished === 1 ? "student" : "students"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {board.kind === "series" && board.rows.length > 1 && (
            <SegmentedControl value={rankBy} onValueChange={setRankBy} options={RANK_OPTIONS} aria-label="Rank by" />
          )}
        </div>

        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>
              {board.kind === "paper" && currentSeries ? `${currentSeries.title}: ${board.title}` : board.title}
            </h2>
            <p className={styles.panelSub}>{subtitle}</p>
          </div>
        </div>

        {board.rows.length > 0 && (
            <PerformanceFacts
              flat
              items={[
                { label: "Students ranked", value: adminFormat.count(board.rows.length) },
                { label: board.kind === "series" ? "Average of averages" : "Average score", value: scoreText(mean(scores)) },
                { label: "Top score", value: scoreText(top) },
                board.kind === "series"
                  ? { label: "Papers in series", value: adminFormat.count(board.paperCount) }
                  : {
                      label: "Average time",
                      value: durationText(
                        mean(board.rows.map((r) => r.timeTakenMinutes).filter((m): m is number => m !== null))
                      ),
                    },
              ]}
            />
        )}

        {board.rows.length === 0 ? (
          <p className={styles.empty}>
            {board.kind === "live" && board.status === "live"
              ? "No one has submitted yet. Ranks fill in as students finish."
              : "No finished attempts yet."}
          </p>
        ) : (board.kind === "series" ? visibleSeries.length : visibleAttempts.length) === 0 ? (
          <p className={styles.empty}>No student on this leaderboard matches "{search}".</p>
        ) : board.kind === "series" ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rankCol}>Rank</th>
                <th>Student</th>
                <th>{rankBy === "average" ? "Average score" : "Total score"}</th>
                <th className={styles.num}>{rankBy === "average" ? "Total score" : "Average score"}</th>
                <th className={styles.num}>Papers done</th>
                <th className={styles.num}>Best score</th>
                <th className={styles.num}>Last attempt</th>
                <OpenHead />
              </tr>
            </thead>
            <tbody>
              {visibleSeries.map((row: SeriesRow & { rank: number }) => (
                <tr key={row.studentId} {...openRow(() => onOpenStudent(row.studentId))}>
                  <td>
                    <RankBadge rank={row.rank} />
                  </td>
                  <td>
                    <StudentName name={row.name} avatarUrl={row.avatarUrl} />
                  </td>
                  <td className={styles.num}>
                    {rankBy === "average" ? <ScoreBar value={row.averageScore} /> : <strong>{row.totalScore.toFixed(1)}</strong>}
                  </td>
                  <td className={styles.num}>
                    {rankBy === "average" ? row.totalScore.toFixed(1) : scoreText(row.averageScore)}
                  </td>
                  <td className={styles.num}>
                    {row.papersDone}
                    <span className={styles.muted}> of {board.paperCount}</span>
                  </td>
                  <td className={styles.num}>{scoreText(row.bestScore)}</td>
                  <td className={styles.num}>{dateText(row.lastAt)}</td>
                  <OpenCell label={`Open ${row.name}'s results`} onOpen={() => onOpenStudent(row.studentId)} />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rankCol}>Rank</th>
                <th>Student</th>
                {board.maxMarks ? <th className={styles.num}>Marks</th> : null}
                <th>Score</th>
                <th className={styles.num}>Time taken</th>
                {board.kind === "paper" && <th className={styles.num}>Attempts</th>}
                <th className={styles.num}>Finished on</th>
                <OpenHead />
              </tr>
            </thead>
            <tbody>
              {visibleAttempts.map((row) => {
                const open = () =>
                  onOpenStudent(row.studentId, {
                    itemId: row.itemId,
                    attemptId: board.kind === "live" ? row.attemptId : undefined,
                  });
                return (
                <tr key={row.studentId} {...openRow(open)}>
                  <td>
                    <RankBadge rank={row.rank} />
                  </td>
                  <td>
                    <StudentName name={row.name} avatarUrl={row.avatarUrl} />
                  </td>
                  {board.maxMarks ? (
                    <td className={styles.num}>
                      <strong>{marksText(row.marks)}</strong>
                      <span className={styles.muted}> / {marksText(board.maxMarks)}</span>
                    </td>
                  ) : null}
                  <td>
                    <ScoreBar value={row.score} />
                  </td>
                  <td className={styles.num}>{durationText(row.timeTakenMinutes)}</td>
                  {board.kind === "paper" && <td className={styles.num}>{row.attempts ?? "-"}</td>}
                  <td className={styles.num}>{dateText(row.completedAt)}</td>
                  <OpenCell label={`Open ${row.name}'s answers`} onOpen={open} />
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
