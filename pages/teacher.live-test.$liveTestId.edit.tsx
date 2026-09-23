import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { LiveTestDetailsEditor } from "../components/LiveTestDetailsEditor";
import { TeacherFormHeader } from "../components/TeacherFormHeader";
import { Button } from "../components/Button";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestQueries";
import styles from "./teacher.create-live-test.module.css";

const EditLiveTestContent: React.FC<{ liveTestIdParam: string | undefined }> = ({ liveTestIdParam }) => {
  const liveTestId = liveTestIdParam ? parseInt(liveTestIdParam, 10) : null;
  const hasValidId = liveTestId !== null && !isNaN(liveTestId);
  const { data } = useLiveTestDetailsQuery(hasValidId ? liveTestId : null);

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

      <LiveTestDetailsEditor liveTestId={liveTestId} exitTo="/teacher/live-tests" exitLabel="Live tests" />
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