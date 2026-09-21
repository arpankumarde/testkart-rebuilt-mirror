import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Tag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList } from "./TeacherAnalyticsBarList";
import type { AnalyticsRange, AnalyticsBucket } from "../helpers/teacherAnalyticsTime";
import type { AnalyticsSalesPoint } from "../endpoints/teacher/analytics/sales_GET.schema";
import { useTeacherAnalyticsSales } from "../helpers/useTeacherAnalytics";
import { adminFormat } from "../helpers/adminFormat";
import {
  ANALYTICS_KIND_PLURALS,
  ANALYTICS_RANGE_LABELS,
  bucketLabel,
  percent,
} from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsSales.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

type ChartPoint = AnalyticsSalesPoint & { label: string; longLabel: string };

const RADIUS = 4;
const GAP = 2;

/** A bar segment with a 4px rounded top and a square base. */
const roundedTopPath = (x: number, y: number, width: number, height: number) => {
  const r = Math.min(RADIUS, height, width / 2);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${
    x + width
  },${y + r} L${x + width},${y + height} Z`;
};

type ShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: ChartPoint };

// Earnings sit at the baseline; the fee is stacked on top with a 2px surface
// gap between them. Whichever segment ends the stack carries the rounded end.
const NetShape = ({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) => {
  if (height <= 0 || width <= 0) return <g />;
  const isTop = !payload || payload.fee <= 0;
  const d = isTop
    ? roundedTopPath(x, y, width, height)
    : `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
  return <path d={d} fill={fill} />;
};

const FeeShape = ({ x = 0, y = 0, width = 0, height = 0, fill }: ShapeProps) => {
  const visible = height - GAP;
  if (visible <= 0 || width <= 0) return <g />;
  return <path d={roundedTopPath(x, y, width, visible)} fill={fill} />;
};

type TipProps = { active?: boolean; payload?: Array<{ payload: ChartPoint }> };

const RevenueTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.longLabel}</span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatch} ${styles.slot1}`} />
        Your earnings <strong>{adminFormat.inr(point.net)}</strong>
      </span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatch} ${styles.slot2}`} />
        Platform fee <strong>{adminFormat.inr(point.fee)}</strong>
      </span>
      <span className={styles.tipRow}>
        Gross <strong>{adminFormat.inr(point.gross)}</strong>
      </span>
      <span className={styles.tipRow}>
        {adminFormat.count(point.orders)} paid {point.orders === 1 ? "order" : "orders"}
      </span>
    </div>
  );
};

const RevenueChart = ({ series, bucket, range }: { series: AnalyticsSalesPoint[]; bucket: AnalyticsBucket; range: AnalyticsRange }) => {
  const data: ChartPoint[] = series.map((point) => ({
    ...point,
    label: bucketLabel(point.bucket, bucket),
    longLabel: bucketLabel(point.bucket, bucket, true),
  }));
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={range === "7d" ? "40%" : "20%"}>
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
            tickFormatter={adminFormat.inrCompact}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<RevenueTip />} />
          <Bar dataKey="net" stackId="money" fill="var(--an-series-1)" maxBarSize={24} shape={NetShape} isAnimationActive={false} />
          <Bar dataKey="fee" stackId="money" fill="var(--an-series-2)" maxBarSize={24} shape={FeeShape} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TeacherAnalyticsSales = ({ range, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherAnalyticsSales(range, enabled);

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<BarChart3 size={22} />}
        title="Sales could not be loaded"
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

  const { totals, series, byKind, coupons, bucket } = data;
  const rangeLabel = ANALYTICS_RANGE_LABELS[data.range];
  const feeShare = totals.gross > 0 ? (totals.fee / totals.gross) * 100 : 0;
  const kinds = byKind.filter((kind) => kind.gross > 0 || kind.paidUnits > 0 || kind.freeUnits > 0);
  const kindNetTotal = kinds.reduce((total, kind) => total + kind.net, 0);
  const paidOrders = coupons.paidWithCode.orders + coupons.paidWithoutCode.orders;

  return (
    <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
      <TeacherAnalyticsPanel
        title="Earnings over time"
        subtitle={
          totals.gross > 0
            ? `${adminFormat.inr(totals.gross)} gross, ${adminFormat.inr(totals.net)} to you, ${percent(feeShare)} platform fee`
            : `last ${rangeLabel}`
        }
        legend={[
          { label: "Your earnings", slot: 1 },
          { label: "Platform fee", slot: 2 },
        ]}
        actions={
          <Link to="/teacher/reports" className={styles.link}>
            Balance and payouts <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
        table={{
          caption: `Earnings by ${bucket === "month" ? "month" : "day"}`,
          columns: [bucket === "month" ? "Month" : "Day", "Gross", "Your earnings", "Platform fee", "Paid orders"],
          rows: series
            .filter((point) => point.gross > 0 || point.orders > 0)
            .map((point) => [
              bucketLabel(point.bucket, bucket, true),
              adminFormat.inr(point.gross),
              adminFormat.inr(point.net),
              adminFormat.inr(point.fee),
              point.orders,
            ]),
        }}
      >
        {totals.gross > 0 ? (
          <RevenueChart series={series} bucket={bucket} range={data.range} />
        ) : (
          <p className={styles.empty}>No paid sales in the last {rangeLabel}. Free claims show under Products.</p>
        )}
      </TeacherAnalyticsPanel>

      <div className={styles.split}>
        <TeacherAnalyticsPanel
          title="Earnings by content type"
          subtitle={`last ${rangeLabel}`}
          table={{
            caption: "Earnings by content type",
            columns: ["Type", "Your earnings", "Gross", "Sold", "Free claims"],
            rows: kinds.map((kind) => [
              ANALYTICS_KIND_PLURALS[kind.kind],
              adminFormat.inr(kind.net),
              adminFormat.inr(kind.gross),
              kind.paidUnits,
              kind.freeUnits,
            ]),
          }}
        >
          {kinds.length === 0 ? (
            <p className={styles.empty}>Nothing sold or claimed in this period.</p>
          ) : (
            <TeacherAnalyticsBarList
              rows={kinds.map((kind) => ({
                key: kind.kind,
                label: ANALYTICS_KIND_PLURALS[kind.kind],
                meta: [
                  `${adminFormat.count(kind.paidUnits)} sold`,
                  kind.freeUnits > 0 ? `${adminFormat.count(kind.freeUnits)} free` : null,
                  kindNetTotal > 0 ? `${percent((kind.net / kindNetTotal) * 100)} of earnings` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                value: kind.net,
                display: adminFormat.inr(kind.net),
              }))}
            />
          )}
        </TeacherAnalyticsPanel>

        <TeacherAnalyticsPanel
          title="Promo codes"
          subtitle={`last ${rangeLabel}`}
          actions={
            <Link to="/teacher/promo-codes" className={styles.link}>
              Manage codes <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          {coupons.redemptions === 0 ? (
            <div className={styles.couponEmpty}>
              <Tag size={18} aria-hidden="true" className={styles.couponEmptyIcon} />
              <p className={styles.empty}>
                No orders used a promo code in this period. A code shared with a batch or a channel is a quick way to
                bring buyers back.
              </p>
            </div>
          ) : (
            <>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>Orders with a code</dt>
                  <dd>
                    {adminFormat.count(coupons.redemptions)}
                    {paidOrders > 0 && (
                      <span className={styles.factNote}>
                        {percent((coupons.paidWithCode.orders / paidOrders) * 100)} of paid orders
                      </span>
                    )}
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>Discount given</dt>
                  <dd>{adminFormat.inr(coupons.discount)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Average paid order</dt>
                  <dd>
                    {coupons.paidWithCode.orders > 0
                      ? adminFormat.inr(coupons.paidWithCode.gross / coupons.paidWithCode.orders)
                      : "-"}
                    <span className={styles.factNote}>
                      with a code, vs{" "}
                      {coupons.paidWithoutCode.orders > 0
                        ? adminFormat.inr(coupons.paidWithoutCode.gross / coupons.paidWithoutCode.orders)
                        : "-"}{" "}
                      without
                    </span>
                  </dd>
                </div>
              </dl>
              <table className={styles.codes}>
                <caption className={styles.codesCaption}>Most used codes</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col" className={styles.num}>
                      Orders
                    </th>
                    <th scope="col" className={styles.num}>
                      Gross
                    </th>
                    <th scope="col" className={styles.num}>
                      Discount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.topCodes.map((code) => (
                    <tr key={code.code}>
                      <td>
                        <span className={styles.code}>{code.code}</span>
                        {!code.ownCode && <span className={styles.codeTag}>Testkart code</span>}
                      </td>
                      <td className={styles.num}>{adminFormat.count(code.redemptions)}</td>
                      <td className={styles.num}>{adminFormat.inr(code.gross)}</td>
                      <td className={styles.num}>{adminFormat.inr(code.discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </TeacherAnalyticsPanel>
      </div>
    </div>
  );
};