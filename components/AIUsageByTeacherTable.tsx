import React from "react";
import { ShieldCheck } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { TeacherAiUsageRow } from "../endpoints/admin/ai-usage/by-teacher_GET.schema";
import styles from "./AIUsageByTeacherTable.module.css";

type AIUsageByTeacherTableProps = {
  teachers?: TeacherAiUsageRow[];
  isFetching: boolean;
  error?: Error | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
};

const COUNT_FIELDS = [
  { key: "totalAttempts", label: "Total" },
  { key: "doneCount", label: "Done" },
  { key: "pendingCount", label: "Pending" },
  { key: "failedCount", label: "Failed" },
] as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-IN", { timeStyle: "short" });

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colCount} />
    <col className={styles.colCount} />
    <col className={styles.colCountWide} />
    <col className={styles.colCount} />
    <col className={styles.colDate} />
  </colgroup>
);

const RowSkeleton: React.FC = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "55%" }} />
        <Skeleton style={{ height: "0.75rem", width: "75%" }} />
      </div>
    </td>
    {COUNT_FIELDS.map((field) => (
      <td key={field.key}>
        <Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} />
      </td>
    ))}
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
        <Skeleton style={{ height: "0.75rem", width: "3.5rem" }} />
      </div>
    </td>
  </tr>
);

const CardSkeleton: React.FC = () => (
  <div className={styles.card}>
    <div className={styles.stack}>
      <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
      <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

export const AIUsageByTeacherTable: React.FC<AIUsageByTeacherTableProps> = ({
  teachers,
  isFetching,
  error,
  searchQuery,
  onSearchChange,
  pagination,
  currentPage,
  onPageChange,
}) => {
  const countClass = (t: TeacherAiUsageRow, key: (typeof COUNT_FIELDS)[number]["key"]) => {
    if (t[key] === 0) return styles.zero;
    if (key === "failedCount") return styles.failed;
    return "";
  };

  const renderIdentity = (t: TeacherAiUsageRow) => {
    const meta = t.academyName || t.email;
    return (
      <div className={styles.stack}>
        <span className={styles.primaryLine}>
          <span className={styles.truncate} title={t.teacherName}>{t.teacherName}</span>
          {t.isVerified && (
            <ShieldCheck size={14} color="var(--secondary-text)" className={styles.verified} aria-label="Verified" />
          )}
        </span>
        <span className={styles.secondaryLine} title={meta}>{meta}</span>
      </div>
    );
  };

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (error) {
      return <div className={styles.emptyState} role="alert">Error loading data: {error.message}</div>;
    }

    if (!teachers || teachers.length === 0) {
      return <div className={styles.emptyState}>No AI usage found for the selected filters.</div>;
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th>Teacher</th>
                {COUNT_FIELDS.map((field) => (
                  <th key={field.key} className={styles.num}>{field.label}</th>
                ))}
                <th>Last used</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.teacherId}>
                  <td>{renderIdentity(t)}</td>
                  {COUNT_FIELDS.map((field) => (
                    <td key={field.key} className={`${styles.num} ${countClass(t, field.key)}`}>
                      {t[field.key]}
                    </td>
                  ))}
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatDate(t.lastUsedAt)}</span>
                      <span className={styles.secondaryLine}>{formatTime(t.lastUsedAt)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {teachers.map((t) => (
            <article key={t.teacherId} className={styles.card}>
              {renderIdentity(t)}
              <dl className={styles.cardStats}>
                {COUNT_FIELDS.map((field) => (
                  <div key={field.key} className={styles.cardStat}>
                    <dt>{field.label}</dt>
                    <dd className={countClass(t, field.key)}>{t[field.key]}</dd>
                  </div>
                ))}
                <div className={styles.cardStat}>
                  <dt>Last used</dt>
                  <dd>{formatDate(t.lastUsedAt)}, {formatTime(t.lastUsedAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <h2>AI Usage by Teacher</h2>
        <Input
          className={styles.searchInput}
          placeholder="Search by name, email, academy..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.results}>{renderContent()}</div>

      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <span>
            Showing {((currentPage - 1) * pagination.pageSize) + 1}-
            {Math.min(currentPage * pagination.pageSize, pagination.total)} of {pagination.total} teachers
          </span>
          <div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pagination.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
};
