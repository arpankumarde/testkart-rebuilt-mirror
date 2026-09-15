import React from "react";
import { Link } from "react-router-dom";
import { BookCopy, BookOpen, FileText, Package, Radio, type LucideIcon } from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { TeacherOverviewTotals } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewCatalogue.module.css";

type Props = {
  totals: TeacherOverviewTotals | undefined;
  className?: string;
};

type Column = {
  label: string;
  icon: LucideIcon;
  live: number;
  liveHref: string;
  suffix?: string;
} & ({ drafts: number; draftsHref: string } | { note: string });

const draftsLabel = (drafts: number) =>
  drafts > 0 ? `${adminFormat.count(drafts)} ${drafts === 1 ? "draft" : "drafts"}` : "no drafts";

/**
 * What the teacher actually has, one column per asset type: how many are live,
 * how many are still drafts, and each figure links to the list filtered to
 * exactly the rows it counts. The old dashboard's stat cards carried these
 * numbers and they are the ones teachers check most, so they get their own
 * band rather than being folded into a single "listings live" total.
 */
export const TeacherOverviewCatalogue = ({ totals, className }: Props) => {
  const columns: Column[] = totals
    ? [
        {
          label: "Test series",
          icon: BookCopy,
          live: totals.publishedTests,
          liveHref: "/teacher/test-series?status=published",
          drafts: totals.draftTests,
          draftsHref: "/teacher/test-series?status=draft",
        },
        {
          label: "Courses",
          icon: BookOpen,
          live: totals.publishedCourses,
          liveHref: "/teacher/courses?status=published",
          drafts: totals.draftCourses,
          draftsHref: "/teacher/courses?status=draft",
        },
        {
          label: "Study notes",
          icon: FileText,
          live: totals.publishedProducts,
          liveHref: "/teacher/products?status=published",
          drafts: totals.draftProducts,
          draftsHref: "/teacher/products?status=draft",
        },
        {
          label: "Bundles",
          icon: Package,
          live: totals.publishedBundles,
          liveHref: "/teacher/bundles?status=published",
          drafts: totals.draftBundles,
          draftsHref: "/teacher/bundles?status=draft",
        },
        {
          label: "Live tests",
          icon: Radio,
          live: totals.activeLiveTests,
          liveHref: "/teacher/live-tests?filter=active",
          suffix: "active",
          note: "upcoming or running",
        },
      ]
    : [];

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Your catalogue">
      <div className={styles.head}>
        <h2 className={styles.title}>Your catalogue</h2>
      </div>

      <div className={styles.columns}>
        {columns.length === 0
          ? [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.column} aria-hidden="true">
                <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
                <Skeleton style={{ height: "1.75rem", width: "3rem", marginTop: "var(--spacing-2)" }} />
                <Skeleton style={{ height: "0.75rem", width: "4rem", marginTop: "var(--spacing-2)" }} />
              </div>
            ))
          : columns.map((column) => {
              const suffix = column.suffix ?? "live";
              return (
                <div key={column.label} className={styles.column}>
                  <span className={styles.label}>
                    <column.icon size={14} className={styles.icon} aria-hidden="true" />
                    {column.label}
                  </span>
                  <Link
                    to={column.liveHref}
                    className={styles.valueLink}
                    aria-label={`${column.label}: ${adminFormat.count(column.live)} ${suffix}`}
                  >
                    {adminFormat.count(column.live)}
                    <span className={styles.suffix}>{suffix}</span>
                  </Link>
                  {"draftsHref" in column ? (
                    <Link
                      to={column.draftsHref}
                      className={styles.noteLink}
                      aria-label={`${column.label}: ${draftsLabel(column.drafts)}`}
                    >
                      {draftsLabel(column.drafts)}
                    </Link>
                  ) : (
                    <span className={styles.note}>{column.note}</span>
                  )}
                </div>
              );
            })}
      </div>
    </section>
  );
};
