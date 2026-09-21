import React from "react";
import { Info } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import type { OutputType as Summary } from "../endpoints/teacher/analytics/summary_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { percent } from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsKpis.module.css";

type Props = {
  summary: Summary | undefined;
  isLoading: boolean;
  /** "30 days", used in "vs previous 30 days". */
  rangeLabel: string;
};

type Tone = "good" | "bad" | "flat" | "new";
type Tile = {
  label: string;
  hint?: string;
  value: string;
  delta?: { text: string; tone: Tone };
  note?: string;
  spark?: number[];
};

const WIDTH = 100;
const HEIGHT = 32;
const PAD = 3;

/** Same quiet line as the Overview strip, with a coral dot on the latest bucket. */
const Sparkline = ({ values }: { values: number[] }) => {
  if (values.length === 0) return <div className={styles.spark} />;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = PAD + index * step;
    const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  return (
    <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} className={styles.sparkLine} vectorEffect="non-scaling-stroke" />
      <path d={`M${lastX} ${lastY} h0.01`} className={styles.sparkDot} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Up is good for money and orders. */
const growth = (current: number, previous: number): { text: string; tone: Tone } => {
  const d = adminFormat.delta(current, previous);
  return { text: d.text, tone: d.tone === "up" ? "good" : d.tone === "down" ? "bad" : d.tone };
};

/** A change in percentage points or stars, where `upIsGood` sets the colour. */
const pointsDelta = (current: number, previous: number, unit: string, upIsGood: boolean) => {
  const change = Math.round((current - previous) * 10) / 10;
  if (change === 0) return { text: "no change", tone: "flat" as Tone };
  const good = change > 0 === upIsGood;
  return { text: `${change > 0 ? "+" : "-"}${Math.abs(change).toFixed(1)}${unit}`, tone: (good ? "good" : "bad") as Tone };
};

export const TeacherAnalyticsKpis = ({ summary, isLoading, rangeLabel }: Props) => {
  if (!summary) {
    return (
      <section className={styles.strip} aria-label="Key figures" aria-busy={isLoading}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.tile} aria-hidden="true">
            <Skeleton style={{ height: "0.875rem", width: "6rem" }} />
            <Skeleton style={{ height: "2rem", width: "7rem", marginTop: "var(--spacing-2)" }} />
            <Skeleton style={{ height: "2rem", width: "100%", marginTop: "var(--spacing-3)" }} />
          </div>
        ))}
      </section>
    );
  }

  const { kpis, series } = summary;
  const refunds = kpis.refunds.current;
  const reviews = kpis.reviews.current;

  const tiles: Tile[] = [
    {
      label: "Visitors",
      hint: "People who opened your profile or any of your item pages, counted once per browser. Your own visits are not counted.",
      value: summary.trackingSince === null ? "Starting soon" : adminFormat.count(kpis.visitors.current),
      delta: kpis.visitors.previous > 0 ? growth(kpis.visitors.current, kpis.visitors.previous) : undefined,
      note:
        summary.trackingSince === null
          ? "counted from when this update goes live"
          : `${adminFormat.count(kpis.views.current)} page ${kpis.views.current === 1 ? "view" : "views"}`,
    },
    {
      label: "Net earnings",
      hint: "What reaches your wallet after the platform fee. Live test sales count once the test ends.",
      value: adminFormat.inr(kpis.net.current),
      delta: growth(kpis.net.current, kpis.net.previous),
      spark: series.map((point) => point.net),
    },
    {
      label: "Gross sales",
      hint: "What students paid for your content, after promo discounts and before the platform fee.",
      value: adminFormat.inr(kpis.gross.current),
      delta: growth(kpis.gross.current, kpis.gross.previous),
      spark: series.map((point) => point.gross),
    },
    {
      label: "Paid orders",
      value: adminFormat.count(kpis.orders.current),
      delta: growth(kpis.orders.current, kpis.orders.previous),
      note:
        kpis.freeOrders.current > 0
          ? `plus ${adminFormat.count(kpis.freeOrders.current)} free ${kpis.freeOrders.current === 1 ? "claim" : "claims"}`
          : undefined,
      spark: series.map((point) => point.orders),
    },
    {
      label: "Average order",
      hint: "Average order value: gross sales divided by paid orders.",
      value: kpis.orders.current > 0 ? adminFormat.inr(kpis.averageOrderValue.current) : "-",
      delta:
        kpis.orders.current > 0
          ? growth(kpis.averageOrderValue.current, kpis.averageOrderValue.previous)
          : undefined,
      spark: series.map((point) => point.averageOrderValue),
    },
    {
      label: "Payment success",
      hint: "Payment attempts on your content that were paid. Most of the rest are students closing or leaving the payment page; see Academy for the reasons.",
      value: kpis.paymentAttempts.current > 0 ? percent((kpis.paymentsPaid.current / kpis.paymentAttempts.current) * 100) : "-",
      delta:
        kpis.paymentAttempts.current > 0 && kpis.paymentAttempts.previous > 0
          ? pointsDelta(
              (kpis.paymentsPaid.current / kpis.paymentAttempts.current) * 100,
              (kpis.paymentsPaid.previous / kpis.paymentAttempts.previous) * 100,
              " pts",
              true
            )
          : undefined,
      note:
        kpis.paymentAttempts.current > 0
          ? `${adminFormat.count(kpis.paymentsPaid.current)} of ${adminFormat.count(kpis.paymentAttempts.current)} attempts paid`
          : "no payment attempts",
    },
    {
      label: "Refund rate",
      hint: "Orders placed in this period that were later refunded, out of paid and refunded orders.",
      value: refunds === 0 ? "No refunds" : percent(kpis.refundRate.current),
      delta:
        refunds === 0 && kpis.refunds.previous === 0
          ? undefined
          : pointsDelta(kpis.refundRate.current, kpis.refundRate.previous, " pts", false),
      note:
        refunds === 0
          ? undefined
          : `${adminFormat.count(refunds)} refunded ${refunds === 1 ? "order" : "orders"}`,
    },
    {
      label: "Average rating",
      hint: "Average stars from reviews written in this period.",
      value: reviews === 0 ? "No reviews" : `${kpis.averageRating.current.toFixed(1)} / 5`,
      delta:
        reviews > 0 && kpis.reviews.previous > 0
          ? pointsDelta(kpis.averageRating.current, kpis.averageRating.previous, "", true)
          : undefined,
      note: reviews === 0 ? undefined : `from ${adminFormat.count(reviews)} ${reviews === 1 ? "review" : "reviews"}`,
    },
  ];

  return (
    <section className={styles.strip} aria-label="Key figures">
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <span className={styles.labelRow}>
            <span className={styles.label}>{tile.label}</span>
            {tile.hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className={styles.hint} aria-label={`About ${tile.label.toLowerCase()}`}>
                    <Info size={14} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className={styles.hintContent}>{tile.hint}</TooltipContent>
              </Tooltip>
            )}
          </span>
          <span className={styles.value}>{tile.value}</span>
          <span className={styles.meta}>
            {tile.delta ? (
              <>
                <span className={`${styles.delta} ${styles[tile.delta.tone]}`}>{tile.delta.text}</span>
                <span className={styles.versus}>vs previous {rangeLabel}</span>
              </>
            ) : (
              <span className={styles.versus}>&nbsp;</span>
            )}
          </span>
          {tile.spark ? <Sparkline values={tile.spark} /> : <span className={styles.note}>{tile.note ?? ""}</span>}
          {tile.spark && tile.note && <span className={styles.noteBelow}>{tile.note}</span>}
        </div>
      ))}
    </section>
  );
};