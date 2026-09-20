import React, { useState } from "react";
import { useAdminActiveTrials, useAdminEndTrial } from "../helpers/adminSubscriptionsHooks";
import { ActiveTrialView } from "../endpoints/admin/subscriptions/active-trials_GET.schema";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { SortableTh } from "./SortableTh";
import { useTableSort, type SortAccessors } from "../helpers/useTableSort";
import { TimerOff } from "lucide-react";
import styles from "./AdminActiveTrials.module.css";

type TrialSortKey = "teacher" | "fee" | "daysLeft" | "started";

const SORT_ACCESSORS: SortAccessors<ActiveTrialView, TrialSortKey> = {
  teacher: (t) => t.teacherName,
  fee: (t) => t.platformFeePercentage,
  daysLeft: (t) => t.daysRemaining,
  started: (t) => (t.startDate ? new Date(t.startDate) : null),
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colFee} />
    <col className={styles.colDays} />
    <col className={styles.colPeriod} />
    <col className={styles.colNote} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const TrialRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="55%" bottom="75%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.5rem" }} /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "80%" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "2rem", marginLeft: "auto" }} /></td>
  </tr>
);

const TrialCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "2rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

export const AdminActiveTrials: React.FC = () => {
  const { data, isFetching, isError } = useAdminActiveTrials();
  const endTrial = useAdminEndTrial();
  /* Declared before the early returns below - hooks cannot sit behind them. */
  const [trialTarget, setTrialTarget] = useState<{ id: number; name: string } | null>(null);
  const { sorted: sortedTrials, ...sort } = useTableSort(data?.trials, SORT_ACCESSORS);

  const confirmEndTrial = () => {
    if (!trialTarget) return;
    endTrial.mutate(
      { subscriptionId: trialTarget.id },
      { onSuccess: () => setTrialTarget(null) }
    );
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 7) return "destructive";
    if (days <= 30) return "warning";
    return "success";
  };

  const renderIdentity = (trial: ActiveTrialView, showDaysLeft = false) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={trial.teacherName}>{trial.teacherName}</span>
        {showDaysLeft && (
          <Badge variant={getDaysRemainingColor(trial.daysRemaining)} className={styles.flag}>
            {trial.daysRemaining} days left
          </Badge>
        )}
      </span>
      <span className={styles.secondaryLine} title={trial.teacherEmail ?? undefined}>
        {trial.teacherEmail ?? "Not given"}
      </span>
    </div>
  );

  const renderActions = (trial: ActiveTrialView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`End trial for ${trial.teacherName}`}
            onClick={() => setTrialTarget({ id: trial.subscriptionId, name: trial.teacherName })}
            disabled={endTrial.isPending}
          >
            <TimerOff />
          </Button>
        </TooltipTrigger>
        <TooltipContent>End trial</TooltipContent>
      </Tooltip>
    </div>
  );

  if (isFetching && !data) {
    return (
      <div className={styles.section}>
        <div className={styles.header}>
          <Skeleton style={{ width: "200px", height: "1.5rem" }} />
        </div>
        <div className={styles.results}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => <TrialRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 2 }).map((_, i) => <TrialCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data || data.trials.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Active custom trials</h2>
        <Badge variant="default">{data.trials.length}</Badge>
      </div>

      <div className={styles.results}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="teacher" sort={sort}>Teacher</SortableTh>
                <SortableTh column="fee" sort={sort} className={styles.num}>Fee</SortableTh>
                <SortableTh column="daysLeft" sort={sort}>Days left</SortableTh>
                <SortableTh column="started" sort={sort}>Started</SortableTh>
                <th>Internal note</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedTrials.map((trial) => (
                <tr key={trial.subscriptionId}>
                  <td>{renderIdentity(trial)}</td>
                  <td className={styles.num}>{trial.platformFeePercentage}%</td>
                  <td>
                    <Badge variant={getDaysRemainingColor(trial.daysRemaining)} className={styles.flag}>
                      {trial.daysRemaining} days
                    </Badge>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatDate(trial.startDate)}</span>
                      <span className={styles.secondaryLine}>Ends {formatDate(trial.endDate)}</span>
                    </div>
                  </td>
                  <td className={trial.adminNote ? undefined : styles.zero} title={trial.adminNote ?? undefined}>
                    {trial.adminNote ?? "None"}
                  </td>
                  <td>{renderActions(trial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {sortedTrials.map((trial) => (
            <article key={trial.subscriptionId} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(trial, true)}
                {renderActions(trial)}
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

      <ConsoleConfirmDialog
        open={!!trialTarget}
        onOpenChange={(open) => !open && setTrialTarget(null)}
        tone="destructive"
        title="End this trial now?"
        description={`${trialTarget?.name} goes back to their normal plan and fee straight away.`}
        confirmLabel="End trial"
        pendingLabel="Ending..."
        cancelLabel="Keep it running"
        isPending={endTrial.isPending}
        onConfirm={confirmEndTrial}
      />
    </div>
  );
};
