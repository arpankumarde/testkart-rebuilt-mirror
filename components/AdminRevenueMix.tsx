import React from "react";
import { Skeleton } from "./Skeleton";
import type { MixSlice, MixKind } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminRevenueMix.module.css";

type Props = {
  mix: MixSlice[];
  isLoading: boolean;
  className?: string;
};

export const MIX_LABELS: Record<MixKind, string> = {
  mock_test: "Mock tests",
  digital_product: "Study notes",
  course: "Courses",
  bundle: "Bundles",
  live_test: "Live tests",
  mentorship: "Mentorship",
  subscription: "Subscriptions",
  other: "Other",
};

const MIX_COLORS: Record<MixKind, string> = {
  mock_test: "var(--chart-color-1)",
  digital_product: "var(--chart-color-2)",
  course: "var(--chart-color-5)",
  bundle: "var(--chart-color-3)",
  live_test: "var(--chart-color-4)",
  mentorship: "var(--info)",
  subscription: "var(--foreground)",
  other: "var(--muted-foreground)",
};

export const AdminRevenueMix = ({ mix, isLoading, className }: Props) => {
  const showSkeleton = isLoading && mix.length === 0;
  const total = mix.reduce((sum, slice) => sum + slice.revenue, 0);
  const units = mix.reduce((sum, slice) => sum + slice.units, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Revenue mix">
      <div className={styles.head}>
        <h2 className={styles.title}>Revenue mix</h2>
        <span className={styles.meta}>
          {adminFormat.count(units)} {units === 1 ? "sale" : "sales"}
        </span>
      </div>

      {showSkeleton ? (
        <>
          <Skeleton style={{ height: "0.75rem", width: "100%" }} />
          <Skeleton style={{ height: "1rem", width: "70%" }} />
          <Skeleton style={{ height: "1rem", width: "55%" }} />
        </>
      ) : mix.length === 0 ? (
        <p className={styles.empty}>No completed sales in this period.</p>
      ) : (
        <>
          <div className={styles.strip} aria-hidden="true">
            {mix
              .filter((slice) => slice.revenue > 0)
              .map((slice) => (
                <span
                  key={slice.kind}
                  className={styles.segment}
                  style={{ flexGrow: slice.revenue, backgroundColor: MIX_COLORS[slice.kind] }}
                />
              ))}
          </div>
          <ul className={styles.rows}>
            {mix.map((slice) => (
              <li key={slice.kind} className={styles.row}>
                <span className={styles.swatch} style={{ backgroundColor: MIX_COLORS[slice.kind] }} />
                <span className={styles.name}>{MIX_LABELS[slice.kind]}</span>
                <span className={styles.units}>{adminFormat.count(slice.units)}</span>
                <span className={styles.revenue}>{adminFormat.inr(slice.revenue)}</span>
                <span className={styles.share}>{adminFormat.share(slice.revenue, total)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
