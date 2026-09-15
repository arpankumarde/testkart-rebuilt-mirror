import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { getTeacherLiveTestsAnalytics } from "../endpoints/teacher/live-tests/analytics_GET.schema";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { Input } from "./Input";
import styles from "./LiveTestAnalyticsDialog.module.css";

interface LiveTestAnalyticsDialogProps {
  liveTestId: number | null;
  liveTestTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* testAttempts.score is written as a 0-100 percentage by
   student/test-item/submit-attempt, so both the per-student score and the
   average carry a percent sign. */
const formatScore = (value: number) => `${value.toFixed(2)}%`;

/* The endpoint hands over fractional minutes. Two decimals of a minute is not
   a unit anyone reads, so it is shown as minutes and seconds. */
const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "-";
  const totalSeconds = Math.round(minutes * 60);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
};

/* Below this a filter field is more clutter than help. */
const SEARCH_THRESHOLD = 8;

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className={styles.statTile}>
    <span className={styles.statIcon} aria-hidden="true">
      {icon}
    </span>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
  </div>
);

const rankBadgeClass = (rank: number) => {
  if (rank === 1) return styles.rankGold;
  if (rank === 2) return styles.rankSilver;
  if (rank === 3) return styles.rankBronze;
  return "";
};

export const LiveTestAnalyticsDialog: React.FC<LiveTestAnalyticsDialogProps> = ({
  liveTestId,
  liveTestTitle,
  open,
  onOpenChange,
}) => {
  const [query, setQuery] = React.useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["liveTestAnalytics", liveTestId],
    queryFn: () => getTeacherLiveTestsAnalytics({ liveTestId: liveTestId! }),
    enabled: !!liveTestId && open,
  });

  React.useEffect(() => {
    setQuery("");
  }, [liveTestId, open]);

  /* Rank is fixed to the server's ordering, not to the filtered position, so
     searching a name never renumbers the leaderboard. */
  const ranked = React.useMemo(
    () =>
      (data?.topScorers ?? []).map((scorer, index) => ({
        ...scorer,
        rank: index + 1,
      })),
    [data]
  );

  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ranked;
    return ranked.filter((scorer) => scorer.studentName.toLowerCase().includes(term));
  }, [ranked, query]);

  const renderRankings = () => {
    if (ranked.length === 0) {
      return (
        <div className={styles.stateBlock}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Trophy size={22} />
          </span>
          <h4 className={styles.stateTitle}>No completed attempts yet</h4>
          <p className={styles.stateText}>
            Nobody finished this test inside its scheduled window, so there is nothing to
            rank.
          </p>
        </div>
      );
    }

    if (visible.length === 0) {
      return (
        <div className={`${styles.stateBlock} ${styles.stateBlockCompact}`}>
          <h4 className={styles.stateTitle}>No students match that search</h4>
          <p className={styles.stateText}>
            Nothing in this leaderboard matches "{query.trim()}".
          </p>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rankCol}>
                Rank
              </th>
              <th scope="col">Student</th>
              <th scope="col" className={styles.numericCol}>
                Score
              </th>
              <th scope="col" className={styles.numericCol}>
                Time taken
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((scorer) => (
              <tr key={`${scorer.rank}-${scorer.studentName}`}>
                <td className={styles.rankCol}>
                  <span className={`${styles.rankBadge} ${rankBadgeClass(scorer.rank)}`}>
                    {scorer.rank}
                  </span>
                </td>
                <td>
                  <span className={styles.studentName} title={scorer.studentName}>
                    {scorer.studentName}
                  </span>
                </td>
                <td className={styles.numericCol}>
                  <span className={styles.scoreCell}>
                    <span className={styles.scoreValue}>{formatScore(scorer.score)}</span>
                    <span className={styles.scoreTrack} aria-hidden="true">
                      <span
                        className={styles.scoreFill}
                        style={{ width: `${Math.max(0, Math.min(100, scorer.score))}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td className={styles.numericCol}>
                  <span className={styles.timeValue}>{formatDuration(scorer.timeTaken)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className={styles.body}>
          <div className={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                style={{ height: "6.5rem", borderRadius: "var(--radius-md)" }}
              />
            ))}
          </div>
          <div className={styles.rankings}>
            <Skeleton style={{ height: "1.25rem", width: "12rem" }} />
            <div className={styles.loadingRows}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  style={{ height: "3rem", borderRadius: "var(--radius)" }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className={styles.body}>
          <div className={styles.stateBlock}>
            <span className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true">
              <AlertTriangle size={22} />
            </span>
            <h4 className={styles.stateTitle}>Analytics could not be loaded</h4>
            <p className={styles.stateText}>
              The figures for this test did not come back from the server. Check your
              connection and try again.
            </p>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Retrying..." : "Try again"}
            </Button>
          </div>
        </div>
      );
    }

    const completionRate =
      data.enrolledCount > 0 ? (data.completedCount / data.enrolledCount) * 100 : null;

    return (
      <div className={styles.body}>
        <div className={styles.statsGrid}>
          <StatTile
            icon={<Users size={16} />}
            label="Enrolled"
            value={data.enrolledCount.toLocaleString()}
          />
          <StatTile
            icon={<CheckCircle2 size={16} />}
            label="Completed"
            value={data.completedCount.toLocaleString()}
          />
          <StatTile
            icon={<BarChart3 size={16} />}
            label="Completion rate"
            value={completionRate === null ? "-" : `${completionRate.toFixed(1)}%`}
          />
          <StatTile
            icon={<Award size={16} />}
            label="Average score"
            /* The endpoint averages to 0 when nothing was completed. Printing
               that reads as "everyone scored zero" rather than "no data". */
            value={data.completedCount === 0 ? "-" : formatScore(data.averageScore)}
          />
        </div>

        <section className={styles.rankings}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>
              <Trophy size={16} aria-hidden="true" />
              Student rankings
              <span className={styles.countPill}>{ranked.length}</span>
            </h3>
            {ranked.length > SEARCH_THRESHOLD && (
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search students"
                  aria-label="Search students by name"
                  className={styles.searchInput}
                />
              </div>
            )}
          </div>
          {renderRankings()}
        </section>
      </div>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.dialogContent}>
          <div className={styles.dialogHeader}>
            <div className={styles.headings}>
              <span className={styles.eyebrow}>Live test analytics</span>
              <Dialog.Title className={styles.dialogTitle}>
                {liveTestTitle || "Live test"}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close analytics"
                className={styles.closeButton}
              >
                <X size={16} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.srOnly}>
            Enrolment, completion and average score for this live test, followed by the
            full student ranking.
          </Dialog.Description>
          {renderBody()}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
