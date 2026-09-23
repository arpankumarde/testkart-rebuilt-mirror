import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { LiveTestEditForm } from "./LiveTestEditForm";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestQueries";
import styles from "./LiveTestDetailsEditor.module.css";

interface LiveTestDetailsEditorProps {
  liveTestId: number | null;
  /** Where the load-failure state sends the user. */
  exitTo: string;
  exitLabel: string;
}

/* Loads a live test's saved details into LiveTestEditForm. Shared by the teacher and admin edit pages. */
export const LiveTestDetailsEditor = ({ liveTestId, exitTo, exitLabel }: LiveTestDetailsEditorProps) => {
  const hasValidId = liveTestId !== null && !isNaN(liveTestId);
  const { data, error, isFetching, dataUpdatedAt } = useLiveTestDetailsQuery(hasValidId ? liveTestId : null);

  // The form seeds itself once, so it must never start from cached details that
  // predate a save made on another screen: wait for a response fetched after
  // this editor opened.
  const [openedAt] = React.useState(() => Date.now());
  const isFresh = !!data && dataUpdatedAt >= openedAt;
  const isLoading = hasValidId && !isFresh && isFetching;
  const loadFailed = !hasValidId || (!isFresh && !isFetching);

  return (
    <div className={styles.form}>
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

      {isFresh && data && <LiveTestEditForm liveTest={data} />}
    </div>
  );
};