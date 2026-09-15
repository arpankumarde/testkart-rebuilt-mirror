import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import type { CoverageRow } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminCatalogueCoverage.module.css";

type Props = {
  coverage: CoverageRow[];
  isLoading: boolean;
  className?: string;
};

type View = "gaps" | "covered";

const LIMIT = 8;

export const AdminCatalogueCoverage = ({ coverage, isLoading, className }: Props) => {
  const [view, setView] = useState<View>("gaps");
  const showSkeleton = isLoading && coverage.length === 0;

  const exams = coverage.reduce((sum, row) => sum + row.exams, 0);
  const covered = coverage.reduce((sum, row) => sum + row.covered, 0);

  const rows = [...coverage]
    .sort((a, b) =>
      view === "gaps"
        ? b.exams - b.covered - (a.exams - a.covered) || b.exams - a.exams
        : adminFormat.share(b.covered, b.exams) - adminFormat.share(a.covered, a.exams) || b.exams - a.exams
    )
    .slice(0, LIMIT);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Exam coverage">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Exam coverage</h2>
          <span className={styles.subtitle}>exams with published content</span>
        </div>
        <div className={styles.switch} role="tablist" aria-label="Sort categories by">
          <button
            type="button"
            role="tab"
            aria-selected={view === "gaps"}
            className={`${styles.switchButton} ${view === "gaps" ? styles.switchActive : ""}`}
            onClick={() => setView("gaps")}
          >
            Biggest gaps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "covered"}
            className={`${styles.switchButton} ${view === "covered" ? styles.switchActive : ""}`}
            onClick={() => setView("covered")}
          >
            Best covered
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2.25rem", width: "100%" }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>No exam categories yet.</p>
      ) : (
        <>
          <ul className={styles.rows}>
            {rows.map((row) => {
              const share = adminFormat.share(row.covered, row.exams);
              return (
                <li key={row.categoryId} className={styles.row}>
                  <span className={styles.name} title={row.categoryName}>
                    {row.categoryName}
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.barFill} style={{ width: `${Math.max(share, share > 0 ? 2 : 0)}%` }} />
                  </span>
                  <span className={styles.ratio}>
                    {adminFormat.count(row.covered)}/{adminFormat.count(row.exams)}
                  </span>
                  <span className={styles.items}>{adminFormat.count(row.publishedItems)} items</span>
                </li>
              );
            })}
          </ul>

          <div className={styles.footer}>
            <span className={styles.footerFigure}>
              {adminFormat.count(covered)} of {adminFormat.count(exams)} exams covered platform-wide (
              {adminFormat.share(covered, exams)}%)
            </span>
            <Link to="/admin/exam-content" className={styles.footerLink}>
              Exam categories
            </Link>
          </div>
        </>
      )}
    </section>
  );
};
