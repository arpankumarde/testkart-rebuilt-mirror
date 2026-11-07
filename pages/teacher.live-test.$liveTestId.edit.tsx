import React from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { LiveTestDetailsEditor } from "../components/LiveTestDetailsEditor";
import { TeacherRejectionBanner } from "../components/TeacherRejectionBanner";
import { TeacherFoldedPanel } from "../components/TeacherFoldedPanel";
import { ContentExpiryPanel } from "../components/ContentExpiryPanel";
import styles from "./teacher.create-live-test.module.css";

const EditLiveTestContent: React.FC<{ liveTestIdParam: string | undefined }> = ({ liveTestIdParam }) => {
  const liveTestId = liveTestIdParam ? parseInt(liveTestIdParam, 10) : null;
  const hasValidId = liveTestId !== null && !isNaN(liveTestId);

  return (
    <div className={`${styles.page} tk-flow`}>
      <LiveTestDetailsEditor
        guided
        liveTestId={liveTestId}
        exitTo="/teacher/live-tests"
        exitLabel="Live tests"
        intro={<TeacherRejectionBanner contentType="live_test" contentId={hasValidId ? liveTestId : null} />}
      />

      {hasValidId && (
        <TeacherFoldedPanel title="More settings" hint="When the live test stops selling.">
          <ContentExpiryPanel contentType="live_test" contentId={liveTestId} variant="inline" />
        </TeacherFoldedPanel>
      )}
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