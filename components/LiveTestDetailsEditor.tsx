import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { LiveTestEditForm } from "./LiveTestEditForm";
import { LiveTestGuidedForm, LiveTestSteps } from "./LiveTestGuidedForm";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestQueries";
import styles from "./LiveTestDetailsEditor.module.css";

interface LiveTestDetailsEditorProps {
  liveTestId: number | null;
  /** Where the load-failure state sends the user. */
  exitTo: string;
  exitLabel: string;
  /** Teacher page: the one-page guided form with the step track. The admin editor keeps the stepped form. */
  guided?: boolean;
  /** Guided only: shown under the step track, e.g. the rejection note. */
  intro?: React.ReactNode;
}

/* Loads a live test's saved details into its edit form. Shared by the teacher and admin edit pages. */
export const LiveTestDetailsEditor = ({ liveTestId, exitTo, exitLabel, guided = false, intro }: LiveTestDetailsEditorProps) => {
  const hasValidId = liveTestId !== null && !isNaN(liveTestId);
  const { data, error, isFetching, dataUpdatedAt } = useLiveTestDetailsQuery(hasValidId ? liveTestId : null);

  // The form seeds itself once, so it must never start from cached details that
  // predate a save made on another screen: wait for a response fetched after
  // this editor opened.
  const [openedAt] = React.useState(() => Date.now());
  const isFresh = !!data && dataUpdatedAt >= openedAt;
  const isLoading = hasValidId && !isFresh && isFetching;
  const loadFailed = !hasValidId || (!isFresh && !isFetching);

  if (guided && isFresh && data) {
    return <LiveTestGuidedForm liveTest={data} intro={intro} exitTo={exitTo} />;
  }

  return (
    <div className={styles.form}>
      {guided && <LiveTestSteps current="details" liveTestId={hasValidId ? liveTestId : null} back={exitTo} />}

      {isLoading && (
        <div className={styles.loading}>
          <Skeleton style={{ height: "48px", width: "100%" }} />
          <Skeleton style={{ height: "200px", width: "100%" }} />
          <Skeleton style={{ height: "120px", width: "100%" }} />
        </div>
      )}

      {loadFailed && (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            <AlertTriangle size={26} />
          </span>
          <h2 className={styles.errorTitle}>Could not open this live test</h2>
          <p className={styles.errorText}>
            {error?.message || "It may have been deleted, or it belongs to another account."}
          </p>
          <Button asChild variant="outline">
            <Link to={exitTo}>Go to {exitLabel}</Link>
          </Button>
        </div>
      )}

      {!guided && isFresh && data && <LiveTestEditForm liveTest={data} />}
    </div>
  );
};