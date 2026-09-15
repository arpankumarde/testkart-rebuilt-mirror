import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { ExamPageTypeRow } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { humanisePageType } from "../helpers/adminContentSurfaces";
import styles from "./AdminContentExamPages.module.css";

type Props = {
  examPageTypes: ExamPageTypeRow[];
  examsWithPages: number;
  exams: number;
  isLoading: boolean;
  className?: string;
};

export const AdminContentExamPages = ({
  examPageTypes,
  examsWithPages,
  exams,
  isLoading,
  className,
}: Props) => {
  const showSkeleton = isLoading && examPageTypes.length === 0;
  const max = examPageTypes.reduce((peak, row) => Math.max(peak, row.total), 0);
  const aiTotal = examPageTypes.reduce((sum, row) => sum + row.aiGenerated, 0);
  const total = examPageTypes.reduce((sum, row) => sum + row.total, 0);
  const examsWithoutPages = Math.max(exams - examsWithPages, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Exam page coverage">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Exam pages</h2>
          <span className={styles.subtitle}>SEO landing pages by type</span>
        </div>
        {total > 0 && (
          <span className={styles.headFigure}>
            <Sparkles size={13} aria-hidden="true" />
            {adminFormat.share(aiTotal, total)}% AI drafted
          </span>
        )}
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
          ))}
        </div>
      ) : examPageTypes.length === 0 ? (
        <p className={styles.empty}>No exam pages have been written yet.</p>
      ) : (
        <>
          <ul className={styles.rows}>
            {examPageTypes.map((row) => (
              <li key={row.pageType} className={styles.row}>
                <span className={styles.name}>{humanisePageType(row.pageType)}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${max > 0 ? Math.max(2, (row.total / max) * 100) : 0}%` }}
                  />
                </span>
                <span className={styles.count}>{adminFormat.count(row.total)}</span>
                <span className={styles.meta}>
                  {row.published === row.total
                    ? "all live"
                    : `${adminFormat.count(row.published)} live`}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.coverage}>
            <div className={styles.coverageHead}>
              <span className={styles.coverageLabel}>Exams with any page</span>
              <span className={styles.coverageFigure}>
                {adminFormat.count(examsWithPages)} of {adminFormat.count(exams)}
              </span>
            </div>
            <span className={styles.coverageBar} aria-hidden="true">
              <span
                className={styles.coverageFill}
                style={{ width: `${Math.max(adminFormat.share(examsWithPages, exams), examsWithPages > 0 ? 1 : 0)}%` }}
              />
            </span>
            <div className={styles.coverageFoot}>
              <span className={styles.coverageNote}>
                {adminFormat.count(examsWithoutPages)}{" "}
                {examsWithoutPages === 1 ? "exam has" : "exams have"} no landing page
              </span>
              {examsWithoutPages > 0 ? (
                <Link to="/admin/exam-content?content=not-started" className={styles.coverageLink}>
                  Show these exams
                </Link>
              ) : (
                <Link to="/admin/exam-content" className={styles.coverageLink}>
                  Manage exam pages
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
