import React, { useState } from "react";
import { Users } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList } from "./TeacherAnalyticsBarList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import type { AnalyticsRange } from "../helpers/teacherAnalyticsTime";
import type { AnalyticsSeriesFinish } from "../endpoints/teacher/analytics/students_GET.schema";
import { useTeacherAnalyticsStudents } from "../helpers/useTeacherAnalytics";
import { adminFormat } from "../helpers/adminFormat";
import {
  ANALYTICS_RANGE_LABELS,
  analyticsEditHref,
  bucketLabel,
  percent,
} from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsStudents.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

type LinePoint = { label: string; longLabel: string; enrolments: number; activeLearners: number };

type LineTipProps = { active?: boolean; payload?: Array<{ payload: LinePoint }> };

const LineTip = ({ active, payload }: LineTipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.longLabel}</span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatchLine} ${styles.slot1}`} />
        New enrolments <strong>{adminFormat.count(point.enrolments)}</strong>
      </span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatchLine} ${styles.slot2}`} />
        Active learners <strong>{adminFormat.count(point.activeLearners)}</strong>
      </span>
    </div>
  );
};

type ScorePoint = { tick: string; label: string; count: number };
type ScoreTipProps = { active?: boolean; payload?: Array<{ payload: ScorePoint }> };

const ScoreTip = ({ active, payload }: ScoreTipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.label}</span>
      <span className={styles.tipRow}>
        {adminFormat.count(point.count)} {point.count === 1 ? "paper" : "papers"}
      </span>
    </div>
  );
};

const SCORE_LABELS = ["0-9%", "10-19%", "20-29%", "30-39%", "40-49%", "50-59%", "60-69%", "70-79%", "80-89%", "90-100%"];
// Short ticks keep all eleven readable at phone width; the tooltip names the full band.
const SCORE_TICKS = ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90"];

type ColumnShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string };

/** A column with a 4px rounded top and a square base. */
const RoundedColumn = ({ x = 0, y = 0, width = 0, height = 0, fill }: ColumnShapeProps) => {
  if (height <= 0 || width <= 0) return <g />;
  const r = Math.min(4, height, width / 2);
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${
    x + width
  },${y + r} L${x + width},${y + height} Z`;
  return <path d={d} fill={fill} />;
};

const ScoreHistogram = ({ series }: { series: AnalyticsSeriesFinish }) => {
  const data: ScorePoint[] = [
    ...(series.belowZero > 0 ? [{ tick: "<0", label: "Below 0%", count: series.belowZero }] : []),
    ...series.scores.map((count, index) => ({ tick: SCORE_TICKS[index], label: SCORE_LABELS[index], count })),
  ];
  return (
    <div className={styles.histogram}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="16%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={30}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ScoreTip />} />
          <Bar dataKey="count" fill="var(--an-series-1)" maxBarSize={24} shape={RoundedColumn} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TeacherAnalyticsStudents = ({ range, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherAnalyticsStudents(range, enabled);
  const [chosenSeries, setChosenSeries] = useState<string | null>(null);

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<Users size={22} />}
        title="Student figures could not be loaded"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <div className={styles.split}>
          <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        </div>
      </div>
    );
  }

  const { totals, series, courses, testSeries, bucket } = data;
  const rangeLabel = ANALYTICS_RANGE_LABELS[data.range];
  const points: LinePoint[] = series.map((point) => ({
    label: bucketLabel(point.bucket, bucket),
    longLabel: bucketLabel(point.bucket, bucket, true),
    enrolments: point.enrolments,
    activeLearners: point.activeLearners,
  }));
  const hasActivity = series.some((point) => point.enrolments > 0 || point.activeLearners > 0);
  const finishedSeries = testSeries.filter((entry) => entry.finished > 0);
  const byMostFinished = [...finishedSeries].sort((a, b) => b.finished - a.finished);
  const seriesKey = (entry: AnalyticsSeriesFinish) => `${entry.kind}:${entry.id}`;
  const selected =
    finishedSeries.find((entry) => seriesKey(entry) === chosenSeries) ?? byMostFinished[0] ?? null;

  return (
    <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>New enrolments</dt>
          <dd>{adminFormat.count(totals.enrolments)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Active learners</dt>
          <dd>{adminFormat.count(totals.activeLearners)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Paying students</dt>
          <dd>{adminFormat.count(totals.buyers)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Repeat buyers</dt>
          <dd>
            {totals.buyers > 0 ? percent((totals.repeatBuyers / totals.buyers) * 100) : "-"}
            <span className={styles.factNote}>
              {totals.buyers > 0
                ? `${adminFormat.count(totals.repeatBuyers)} of ${adminFormat.count(totals.buyers)} have bought from you more than once`
                : "no paid orders in this period"}
            </span>
          </dd>
        </div>
      </dl>

      <TeacherAnalyticsPanel
        title="Enrolments and active learners"
        subtitle={`last ${rangeLabel}`}
        legend={[
          { label: "New enrolments", slot: 1, shape: "line" },
          { label: "Active learners", slot: 2, shape: "line" },
        ]}
        table={{
          caption: `Enrolments and active learners by ${bucket === "month" ? "month" : "day"}`,
          columns: [bucket === "month" ? "Month" : "Day", "New enrolments", "Active learners"],
          rows: points
            .filter((point) => point.enrolments > 0 || point.activeLearners > 0)
            .map((point) => [point.longLabel, point.enrolments, point.activeLearners]),
        }}
      >
        {hasActivity ? (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={points.length <= 12 ? 0 : "preserveStartEnd"}
                  minTickGap={18}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<LineTip />} />
                <Line
                  type="monotone"
                  dataKey="enrolments"
                  stroke="var(--an-series-1)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--an-series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="activeLearners"
                  stroke="var(--an-series-2)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--an-series-2)", stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.empty}>No new enrolments or learner activity in the last {rangeLabel}.</p>
        )}
        <p className={styles.footnote}>
          Active learners started a test paper or finished a course lesson in that {bucket === "month" ? "month" : "day"}.
        </p>
      </TeacherAnalyticsPanel>

      <div className={styles.split}>
        <TeacherAnalyticsPanel
          title="Test finish rate"
          subtitle={`papers started in the last ${rangeLabel}`}
          table={{
            caption: "Test finish rate by test series",
            columns: ["Test series", "Started", "Finished", "Finish rate"],
            rows: testSeries.map((entry) => [
              entry.title,
              entry.started,
              entry.finished,
              percent(entry.started > 0 ? (entry.finished / entry.started) * 100 : 0),
            ]),
          }}
        >
          {testSeries.length === 0 ? (
            <p className={styles.empty}>No test papers were started in this period.</p>
          ) : (
            <TeacherAnalyticsBarList
              max={100}
              rows={testSeries.slice(0, 8).map((entry) => {
                const rate = entry.started > 0 ? (entry.finished / entry.started) * 100 : 0;
                return {
                  key: seriesKey(entry),
                  label: entry.title,
                  meta: `${adminFormat.count(entry.finished)} of ${adminFormat.count(entry.started)} finished`,
                  value: rate,
                  display: percent(rate),
                  href: analyticsEditHref(entry.kind, entry.id),
                };
              })}
            />
          )}
        </TeacherAnalyticsPanel>

        <TeacherAnalyticsPanel
          title="Course completion"
          subtitle="average progress, all time"
          table={{
            caption: "Course completion",
            columns: ["Course", "Enrolled", "Completed", "Average progress"],
            rows: courses.map((course) => [course.title, course.enrolments, course.completed, percent(course.averageProgress)]),
          }}
        >
          {courses.length === 0 ? (
            <p className={styles.empty}>No course enrolments yet.</p>
          ) : (
            <TeacherAnalyticsBarList
              max={100}
              rows={courses.map((course) => ({
                key: String(course.id),
                label: course.title,
                meta: `${adminFormat.count(course.enrolments)} enrolled · ${adminFormat.count(course.completed)} completed`,
                value: course.averageProgress,
                display: percent(course.averageProgress),
                href: analyticsEditHref("course", course.id),
              }))}
            />
          )}
        </TeacherAnalyticsPanel>
      </div>

      <TeacherAnalyticsPanel
        title="Score distribution"
        subtitle={selected ? `${adminFormat.count(selected.finished)} finished papers, last ${rangeLabel}` : `last ${rangeLabel}`}
        actions={
          finishedSeries.length > 1 && selected ? (
            <Select value={seriesKey(selected)} onValueChange={setChosenSeries}>
              <SelectTrigger className={styles.seriesSelect} aria-label="Test series">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {byMostFinished.map((entry) => (
                  <SelectItem key={seriesKey(entry)} value={seriesKey(entry)}>
                    {entry.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
        table={
          selected
            ? {
                caption: `Score distribution for ${selected.title}`,
                columns: ["Score", "Papers"],
                rows: [
                  ...(selected.belowZero > 0 ? [["Below 0%", selected.belowZero]] : []),
                  ...selected.scores.map((count, index) => [SCORE_LABELS[index], count]),
                ],
              }
            : undefined
        }
      >
        {selected ? (
          <>
            {finishedSeries.length === 1 && <p className={styles.seriesName}>{selected.title}</p>}
            <ScoreHistogram series={selected} />
            <p className={styles.footnote}>
              Score in percent, from each student's first finished attempt at each paper. Negative marking can take a
              score below zero.
            </p>
          </>
        ) : (
          <p className={styles.empty}>No finished test papers in this period.</p>
        )}
      </TeacherAnalyticsPanel>
    </div>
  );
};