import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList } from "./TeacherAnalyticsBarList";
import type { AnalyticsRange } from "../helpers/teacherAnalyticsTime";
import type { AnalyticsRatingMonth } from "../endpoints/teacher/analytics/reviews_GET.schema";
import { useTeacherAnalyticsReviews } from "../helpers/useTeacherAnalytics";
import { adminFormat } from "../helpers/adminFormat";
import { ANALYTICS_KIND_LABELS, ANALYTICS_RANGE_LABELS, monthLabel, percent } from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsReviews.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

// A monthly line says little until there are a few reviews across months.
const TREND_MIN_REVIEWS = 5;

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

type TrendPoint = AnalyticsRatingMonth & { label: string; longLabel: string };
type TipProps = { active?: boolean; payload?: Array<{ payload: TrendPoint }> };

const TrendTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.longLabel}</span>
      <span>
        {point.average.toFixed(1)} average from {adminFormat.count(point.count)} {point.count === 1 ? "review" : "reviews"}
      </span>
    </div>
  );
};

export const TeacherAnalyticsReviews = ({ range, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherAnalyticsReviews(range, enabled);
  const rangeLabel = ANALYTICS_RANGE_LABELS[data?.range ?? range];

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<Star size={22} />}
        title="Reviews could not be loaded"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (data.count.current === 0) {
    return (
      <div className={isFetching ? styles.busy : undefined} aria-busy={isFetching}>
        <ConsoleListEmpty
          icon={<Star size={22} />}
          title={`No reviews in the last ${rangeLabel}`}
          description="Students can rate a test series, course or study notes once they have used it. Try a longer period to see older reviews."
        >
          <Button asChild variant="outline">
            <Link to="/teacher/reviews">Open reviews</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const { average, count, distribution, trend, latest } = data;
  const change = count.previous > 0 ? Math.round((average.current - average.previous) * 10) / 10 : null;
  const showTrend = count.current >= TREND_MIN_REVIEWS && trend.length >= 2;
  const trendPoints: TrendPoint[] = trend.map((point) => ({
    ...point,
    label: monthLabel(point.month),
    longLabel: monthLabel(point.month, true),
  }));

  return (
    <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
      <div className={styles.split}>
        <TeacherAnalyticsPanel
          title="Ratings"
          subtitle={`last ${rangeLabel}`}
          table={{
            caption: "Reviews by star rating",
            columns: ["Stars", "Reviews"],
            rows: [5, 4, 3, 2, 1].map((stars) => [stars, distribution[stars - 1]]),
          }}
        >
          <div className={styles.headline}>
            <span className={styles.average}>{average.current.toFixed(1)}</span>
            <span className={styles.outOf}>out of 5</span>
            <span className={styles.headlineMeta}>
              from {adminFormat.count(count.current)} {count.current === 1 ? "review" : "reviews"}
              {change !== null && (
                <>
                  {" · "}
                  <span className={change > 0 ? styles.good : change < 0 ? styles.bad : styles.flat}>
                    {change === 0 ? "no change" : `${change > 0 ? "+" : "-"}${Math.abs(change).toFixed(1)}`}
                  </span>{" "}
                  vs previous {rangeLabel}
                </>
              )}
            </span>
          </div>
          <TeacherAnalyticsBarList
            max={Math.max(...distribution, 1)}
            rows={[5, 4, 3, 2, 1].map((stars) => ({
              key: String(stars),
              label: `${stars} ${stars === 1 ? "star" : "stars"}`,
              value: distribution[stars - 1],
              display: `${adminFormat.count(distribution[stars - 1])} (${percent((distribution[stars - 1] / count.current) * 100)})`,
            }))}
          />
        </TeacherAnalyticsPanel>

        <TeacherAnalyticsPanel title="Average by month" subtitle={`last ${rangeLabel}`}>
          {showTrend ? (
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<TrendTip />} />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="var(--an-series-1)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ r: 4, fill: "var(--an-series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "var(--an-series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.empty}>
              A monthly trend shows once there are at least {TREND_MIN_REVIEWS} reviews across two or more months in
              the period. Try 90 days or 12 months.
            </p>
          )}
        </TeacherAnalyticsPanel>
      </div>

      <TeacherAnalyticsPanel
        title="Latest reviews"
        subtitle={`last ${rangeLabel}`}
        actions={
          <Link to="/teacher/reviews" className={styles.link}>
            All reviews <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        <ul className={styles.reviews}>
          {latest.map((review) => (
            <li key={review.id} className={styles.review}>
              <div className={styles.reviewHead}>
                <span className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={14}
                      aria-hidden="true"
                      className={n <= review.rating ? styles.starOn : styles.starOff}
                    />
                  ))}
                </span>
                <span className={styles.reviewer}>{review.reviewerName}</span>
                <span className={styles.reviewDate}>{dateFormatter.format(new Date(review.createdAt))}</span>
              </div>
              <span className={styles.reviewOn}>
                {ANALYTICS_KIND_LABELS[review.kind]} · {review.title}
              </span>
              {review.text ? (
                <p className={styles.reviewText}>{review.text}</p>
              ) : (
                <p className={styles.reviewNoText}>Rating only, no written review.</p>
              )}
            </li>
          ))}
        </ul>
      </TeacherAnalyticsPanel>
    </div>
  );
};