import React from "react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { AiUsageLogRow } from "../endpoints/admin/ai-usage/logs_GET.schema";
import styles from "./AIUsageLogsTable.module.css";

const FEATURE_LABELS: Record<string, string> = {
  question_generation: "Question Generation",
  rewrite: "AI Rewrite",
  generate_all: "Generate All",
};

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'destructive' | 'default' => {
  if (status === "done") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "destructive";
  return "default";
};

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-IN", { timeStyle: "short" });

const formatDuration = (durationMs: number | null) =>
  durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "-";

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colDuration} />
    <col className={styles.colDate} />
  </colgroup>
);

const RowSkeleton: React.FC = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "50%" }} />
        <Skeleton style={{ height: "0.75rem", width: "35%" }} />
      </div>
    </td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} /></td>
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
      <Skeleton style={{ height: "0.75rem", width: "7rem", maxWidth: "100%" }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

type AIUsageLogsTableProps = {
  logs?: AiUsageLogRow[];
  isFetching: boolean;
  error?: Error | null;
  statusFilter?: string;
  onStatusFilterChange: (value: string | undefined) => void;
  featureFilter?: string;
  onFeatureFilterChange: (value: string | undefined) => void;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
};

export const AIUsageLogsTable: React.FC<AIUsageLogsTableProps> = ({
  logs,
  isFetching,
  error,
  statusFilter,
  onStatusFilterChange,
  featureFilter,
  onFeatureFilterChange,
  pagination,
  currentPage,
  onPageChange,
}) => {
  const renderStatusFlag = (log: AiUsageLogRow) => (
    <Badge variant={statusBadgeVariant(log.status)} className={styles.flag}>
      {sentenceCase(log.status)}
    </Badge>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <RowSkeleton key={i} />)}
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
      return <div className={styles.emptyState} role="alert">Error loading logs: {error.message}</div>;
    }

    if (!logs || logs.length === 0) {
      return <div className={styles.emptyState}>No AI generation attempts found for the selected filters.</div>;
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Status</th>
                <th className={styles.num}>Duration</th>
                <th>Started at</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const feature = FEATURE_LABELS[log.feature] ?? log.feature;
                return (
                  <tr key={log.id}>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.primaryLine} title={log.teacherName}>{log.teacherName}</span>
                        <span className={styles.secondaryLine} title={feature}>{feature}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        {renderStatusFlag(log)}
                        {log.errorMessage && (
                          <span className={styles.errorLine} title={log.errorMessage}>{log.errorMessage}</span>
                        )}
                      </div>
                    </td>
                    <td className={`${styles.num} ${log.durationMs == null ? styles.zero : ""}`}>
                      {formatDuration(log.durationMs)}
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{formatDate(log.createdAt)}</span>
                        <span className={styles.secondaryLine}>{formatTime(log.createdAt)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {logs.map((log) => {
            const feature = FEATURE_LABELS[log.feature] ?? log.feature;
            return (
              <article key={log.id} className={styles.card}>
                <div className={styles.stack}>
                  <span className={styles.cardTitleLine}>
                    <span className={styles.truncate} title={log.teacherName}>{log.teacherName}</span>
                    {renderStatusFlag(log)}
                  </span>
                  <span className={styles.secondaryLine} title={feature}>{feature}</span>
                </div>
                {log.errorMessage && <p className={styles.cardError}>{log.errorMessage}</p>}
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}>
                    <dt>Duration</dt>
                    <dd className={log.durationMs == null ? styles.zero : undefined}>{formatDuration(log.durationMs)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Started at</dt>
                    <dd>{formatDate(log.createdAt)}, {formatTime(log.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <h2>Recent AI Generation Attempts</h2>
        <div className={styles.filters}>
          <Select value={statusFilter ?? 'all'} onValueChange={(v) => onStatusFilterChange(v === 'all' ? undefined : v)}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={featureFilter ?? 'all'} onValueChange={(v) => onFeatureFilterChange(v === 'all' ? undefined : v)}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="All Features" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Features</SelectItem>
              <SelectItem value="question_generation">Question Generation</SelectItem>
              <SelectItem value="rewrite">AI Rewrite</SelectItem>
              <SelectItem value="generate_all">Generate All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={styles.results}>{renderContent()}</div>

      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <span>
            Showing {((currentPage - 1) * pagination.pageSize) + 1}-
            {Math.min(currentPage * pagination.pageSize, pagination.total)} of {pagination.total} attempts
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
