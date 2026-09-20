import React, { useState } from "react";
import { useAdminTrialHistory } from "../helpers/adminSubscriptionsHooks";
import { TrialHistoryView } from "../endpoints/admin/subscriptions/trial-history_GET.schema";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { SortableTh } from "./SortableTh";
import { useTableSort, type SortAccessors } from "../helpers/useTableSort";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import styles from "./AdminTrialHistory.module.css";

type TrialSortKey = "teacher" | "fee" | "status" | "started";

const SORT_ACCESSORS: SortAccessors<TrialHistoryView, TrialSortKey> = {
  teacher: (t) => t.teacherName,
  fee: (t) => t.platformFeePercentage,
  status: (t) => (t.isActive ? "Active" : "Expired"),
  started: (t) => (t.startDate ? new Date(t.startDate) : null),
};

/* Every custom-fee trial ever granted, running or not. Active custom trials
   lists only the ones still running, and nothing flips a trial's status when
   its end date passes, so this is the only place a past trial and its fee show. */
export const AdminTrialHistory: React.FC = () => {
  const { data, isFetching, isError } = useAdminTrialHistory();
  const [isExpanded, setIsExpanded] = useState(false);
  const { sorted: sortedTrials, ...sort } = useTableSort(data?.trials, SORT_ACCESSORS);

  const formatDate = (date: Date | null): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const renderStatus = (trial: TrialHistoryView) => (
    <Badge variant={trial.isActive ? "success" : "secondary"} className={styles.flag}>
      {trial.isActive ? "Active" : "Expired"}
    </Badge>
  );

  if (isFetching && !data) {
    return (
      <div className={styles.section}>
        <div className={styles.header}>
          <Skeleton style={{ width: "200px", height: "1.5rem" }} />
        </div>
        <Skeleton style={{ width: "100%", height: "80px" }} />
      </div>
    );
  }

  if (isError || !data || data.trials.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <History size={18} className={styles.headerIcon} />
        <h2 className={styles.title}>Trial history</h2>
        <Badge variant="outline">{data.trials.length}</Badge>
        <span className={styles.spacer} />
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div className={styles.results}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <colgroup>
                <col />
                <col className={styles.colFee} />
                <col className={styles.colStatus} />
                <col className={styles.colPeriod} />
                <col className={styles.colNote} />
              </colgroup>
              <thead>
                <tr>
                  <SortableTh column="teacher" sort={sort}>Teacher</SortableTh>
                  <SortableTh column="fee" sort={sort} className={styles.num}>Fee</SortableTh>
                  <SortableTh column="status" sort={sort}>Status</SortableTh>
                  <SortableTh column="started" sort={sort}>Started</SortableTh>
                  <th>Admin note</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrials.map((trial) => (
                  <tr key={trial.subscriptionId}>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.primaryLine} title={trial.teacherName}>{trial.teacherName}</span>
                        <span className={styles.secondaryLine} title={trial.teacherEmail ?? undefined}>
                          {trial.teacherEmail ?? "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className={styles.num}>{trial.platformFeePercentage}%</td>
                    <td>{renderStatus(trial)}</td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{formatDate(trial.startDate)}</span>
                        <span className={styles.secondaryLine}>Ends {formatDate(trial.endDate)}</span>
                      </div>
                    </td>
                    <td className={trial.adminNote ? undefined : styles.zero} title={trial.adminNote ?? undefined}>
                      {trial.adminNote ?? "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardsContainer}>
            {sortedTrials.map((trial) => (
              <article key={trial.subscriptionId} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    <span className={styles.cardTitleLine}>
                      <span className={styles.truncate} title={trial.teacherName}>{trial.teacherName}</span>
                      {renderStatus(trial)}
                    </span>
                    <span className={styles.secondaryLine} title={trial.teacherEmail ?? undefined}>
                      {trial.teacherEmail ?? "N/A"}
                    </span>
                  </div>
                </div>
                {trial.adminNote && (
                  <p className={styles.cardNote}>Note: {trial.adminNote}</p>
                )}
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}>
                    <dt>Fee</dt>
                    <dd>{trial.platformFeePercentage}%</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Started</dt>
                    <dd>{formatDate(trial.startDate)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Ends</dt>
                    <dd>{formatDate(trial.endDate)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
