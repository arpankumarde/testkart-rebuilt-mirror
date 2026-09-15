import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ListChecks } from "lucide-react";
import { LiveTestEditForm } from "../components/LiveTestEditForm";
import { TeacherFormHeader } from "../components/TeacherFormHeader";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestQueries";
import styles from "./teacher.create-live-test.module.css";

const EditLiveTestContent: React.FC<{ liveTestIdParam: string | undefined }> = ({ liveTestIdParam }) => {
  const liveTestId = liveTestIdParam ? parseInt(liveTestIdParam, 10) : null;
  const hasValidId = liveTestId !== null && !isNaN(liveTestId);
  const { data, error, isFetching, dataUpdatedAt } = useLiveTestDetailsQuery(hasValidId ? liveTestId : null);

  // The form seeds itself once, so it must never start from cached details that
  // predate a save made on another screen: wait for a response fetched after
  // this page opened.
  const [openedAt] = React.useState(() => Date.now());
  const isFresh = !!data && dataUpdatedAt >= openedAt;
  const isLoading = hasValidId && !isFresh && isFetching;
  const loadFailed = !hasValidId || (!isFresh && !isFetching);

  return (
    <div className={styles.page}>
      <TeacherFormHeader
        backTo="/teacher/live-tests"
        backLabel="Live tests"
        title="Edit live test"
        subtitle={data?.title}
      >
        {hasValidId && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/teacher/live-test/${liveTestId}/questions`}>
              <ListChecks size={16} />
              Manage questions
            </Link>
          </Button>
        )}
      </TeacherFormHeader>

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
              <Link to="/teacher/live-tests">Go to Live tests</Link>
            </Button>
          </div>
        )}

        {isFresh && data && <LiveTestEditForm liveTest={data} />}
      </div>
    </div>
  );
};

const EditLiveTestPage: React.FC = () => {
  const { liveTestId } = useParams<{ liveTestId: string }>();

  return (
    <>
      <Helmet>
        <title>Edit Live Test | Teacher Dashboard | Testkart</title>
      </Helmet>
      <EditLiveTestContent key={liveTestId ?? ""} liveTestIdParam={liveTestId} />
    </>
  );
};

export default EditLiveTestPage;