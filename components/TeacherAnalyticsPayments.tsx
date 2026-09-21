import React, { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList } from "./TeacherAnalyticsBarList";
import type { AnalyticsRange, AnalyticsBucket } from "../helpers/teacherAnalyticsTime";
import type { AnalyticsPaymentPoint } from "../endpoints/teacher/analytics/payments_GET.schema";
import { useTeacherAnalyticsPayments } from "../helpers/useTeacherAnalytics";
import { adminFormat } from "../helpers/adminFormat";
import { ANALYTICS_RANGE_LABELS, bucketLabel, percent, shortDate } from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsPayments.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

type ChartPoint = AnalyticsPaymentPoint & { label: string; longLabel: string };
type ShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: ChartPoint };

const roundedTopPath = (x: number, y: number, width: number, height: number) => {
  const r = Math.min(4, height, width / 2);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${
    x + width
  },${y + r} L${x + width},${y + height} Z`;
};

// Paid sits on the baseline, not paid on top with a 2px surface gap; the
// segment that ends the stack carries the rounded end.
const PaidShape = ({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) => {
  if (height <= 0 || width <= 0) return <g />;
  const isTop = !payload || payload.unpaid <= 0;
  const d = isTop
    ? roundedTopPath(x, y, width, height)
    : `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
  return <path d={d} fill={fill} />;
};

const UnpaidShape = ({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) => {
  const gap = payload && payload.paid > 0 ? 2 : 0;
  const visible = height - gap;
  if (visible <= 0 || width <= 0) return <g />;
  return <path d={roundedTopPath(x, y, width, visible)} fill={fill} />;
};

type TipProps = { active?: boolean; payload?: Array<{ payload: ChartPoint }> };

const AttemptsTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.longLabel}</span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatch} ${styles.slot1}`} />
        Paid <strong>{adminFormat.count(point.paid)}</strong>
      </span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatch} ${styles.slot2}`} />
        Not paid <strong>{adminFormat.count(point.unpaid)}</strong>
      </span>
    </div>
  );
};

const AttemptsChart = ({ series, bucket }: { series: AnalyticsPaymentPoint[]; bucket: AnalyticsBucket }) => {
  const data: ChartPoint[] = series.map((point) => ({
    ...point,
    label: bucketLabel(point.bucket, bucket),
    longLabel: bucketLabel(point.bucket, bucket, true),
  }));
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={data.length <= 12 ? 0 : "preserveStartEnd"}
            minTickGap={18}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={30}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<AttemptsTip />} />
          <Bar dataKey="paid" stackId="attempts" fill="var(--an-series-1)" maxBarSize={24} shape={PaidShape} isAnimationActive={false} />
          <Bar dataKey="unpaid" stackId="attempts" fill="var(--an-series-2)" maxBarSize={24} shape={UnpaidShape} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

export const TeacherAnalyticsPayments = ({ range, enabled }: Props) => {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [range]);
  const { data, isFetching, isError, error } = useTeacherAnalyticsPayments(range, page, enabled);

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<CreditCard size={22} />}
        title="Payments could not be loaded"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        <Skeleton style={{ height: "8rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const { current, previous, series, reasons, failures, failuresTotal, bucket } = data;
  const rangeLabel = ANALYTICS_RANGE_LABELS[data.range];
  const settled = current.attempts - current.pending;
  const paidOrRefunded = current.paid + current.refunded;
  const successRate = settled > 0 ? (paidOrRefunded / settled) * 100 : 0;
  const previousSettled = previous.attempts - previous.pending;
  const previousRate = previousSettled > 0 ? ((previous.paid + previous.refunded) / previousSettled) * 100 : null;
  const unpaidTotal = current.failed + current.abandoned;
  const totalPages = Math.max(1, Math.ceil(failuresTotal / data.pageSize));

  if (current.attempts === 0) {
    return (
      <TeacherAnalyticsPanel title="Payments" subtitle={`last ${rangeLabel}`}>
        <p className={styles.empty}>
          Nobody tried to pay for your content in the last {rangeLabel}. Free claims do not go through payment and are
          not counted here.
        </p>
      </TeacherAnalyticsPanel>
    );
  }

  return (
    <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
      <TeacherAnalyticsPanel title="Payments" subtitle={`last ${rangeLabel}`}>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Payment attempts</dt>
            <dd>
              {adminFormat.count(current.attempts)}
              <span className={styles.factNote}>by {adminFormat.count(current.payers)} students</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Paid</dt>
            <dd>
              {percent(successRate)}
              <span className={styles.factNote}>
                {adminFormat.count(paidOrRefunded)} of {adminFormat.count(settled)}
                {previousRate !== null && ` · ${percent(previousRate)} before`}
              </span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Abandoned</dt>
            <dd>
              {adminFormat.count(current.abandoned)}
              <span className={styles.factNote}>closed, cancelled or not approved</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Failed</dt>
            <dd>
              {adminFormat.count(current.failed)}
              <span className={styles.factNote}>declined by the bank, card or UPI</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Not recovered</dt>
            <dd>
              {adminFormat.inr(current.lostAmount)}
              <span className={styles.factNote}>
                {adminFormat.count(current.lostStudents)} {current.lostStudents === 1 ? "student" : "students"} never
                paid later
              </span>
            </dd>
          </div>
        </dl>
        {(current.pending > 0 || current.refunded > 0) && (
          <p className={styles.footnote}>
            {current.pending > 0 && `${adminFormat.count(current.pending)} still waiting for the bank. `}
            {current.refunded > 0 && `${adminFormat.count(current.refunded)} paid and later refunded, counted as paid here.`}
          </p>
        )}
      </TeacherAnalyticsPanel>

      <div className={styles.split}>
        <TeacherAnalyticsPanel
          title="Attempts over time"
          subtitle={`last ${rangeLabel}`}
          legend={[
            { label: "Paid", slot: 1 },
            { label: "Not paid", slot: 2 },
          ]}
          table={{
            caption: `Payment attempts by ${bucket === "month" ? "month" : "day"}`,
            columns: [bucket === "month" ? "Month" : "Day", "Attempts", "Paid", "Not paid"],
            rows: series
              .filter((point) => point.attempts > 0)
              .map((point) => [bucketLabel(point.bucket, bucket, true), point.attempts, point.paid, point.unpaid]),
          }}
        >
          <AttemptsChart series={series} bucket={bucket} />
        </TeacherAnalyticsPanel>

        <TeacherAnalyticsPanel title="Why payments did not go through" subtitle={`${adminFormat.count(unpaidTotal)} unpaid`}>
          {reasons.length === 0 ? (
            <p className={styles.empty}>Every attempt in this period was paid.</p>
          ) : (
            <TeacherAnalyticsBarList
              slot={2}
              rows={reasons.map((reason) => ({
                key: reason.reason,
                label: reason.label,
                meta: reason.kind === "unknown" ? undefined : reason.kind,
                value: reason.attempts,
                display: `${adminFormat.count(reason.attempts)} (${percent((reason.attempts / Math.max(1, unpaidTotal)) * 100)})`,
              }))}
            />
          )}
        </TeacherAnalyticsPanel>
      </div>

      <TeacherAnalyticsPanel
        title="Students who did not finish paying"
        subtitle={`${adminFormat.count(failuresTotal)} attempts, newest first`}
      >
        {failures.length === 0 ? (
          <p className={styles.empty}>No failed or abandoned payments in this period.</p>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Student</th>
                    <th scope="col">Content</th>
                    <th scope="col" className={styles.num}>
                      Amount
                    </th>
                    <th scope="col">Reason</th>
                    <th scope="col">Since then</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((attempt) => {
                    const when = new Date(attempt.createdAt);
                    return (
                      <tr key={attempt.orderId}>
                        <td className={styles.when}>
                          {shortDate(when)}
                          <span className={styles.muted}>{timeFormatter.format(when)}</span>
                        </td>
                        <td className={styles.student}>{attempt.studentName}</td>
                        <td className={styles.content} title={attempt.summary}>
                          {attempt.summary}
                        </td>
                        <td className={styles.num}>{adminFormat.inr(attempt.amount)}</td>
                        <td>{attempt.reasonLabel}</td>
                        <td>
                          {attempt.paidLater ? (
                            <span className={styles.paidLater}>Paid later</span>
                          ) : (
                            <span className={styles.notPaid}>Not paid yet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.footnote}>
              Amounts are your share before the platform fee. A student who closed the page may simply need a reminder
              or another payment method.
            </p>
            {totalPages > 1 && <ConsoleListPagination page={data.page} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}
      </TeacherAnalyticsPanel>
    </div>
  );
};