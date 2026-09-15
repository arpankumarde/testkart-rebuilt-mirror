import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { LiveTestCreationForm } from "../components/LiveTestCreationForm";
import { TeacherFormHeader } from "../components/TeacherFormHeader";
import { AIContentPrompt } from "../components/AIContentPrompt";
import { useAuth } from "../helpers/useAuth";
import styles from "./teacher.create-live-test.module.css";

const CreateLiveTestPage: React.FC = () => {
  const { authState } = useAuth();
  const teacherName =
    authState.type === "authenticated" ? authState.user.displayName : undefined;

  const [showAIPrompt, setShowAIPrompt] = useState(true);
  const [aiInitialValues, setAiInitialValues] = useState<any>(null);

  const handleGenerated = (data: any) => {
    setAiInitialValues(data);
    setShowAIPrompt(false);
  };

  return (
    <>
      <Helmet>
        <title>Create Live Test | Teacher Dashboard | Testkart</title>
        <meta
          name="description"
          content="Schedule and create a new live test event for your students on Testkart."
        />
      </Helmet>

      {showAIPrompt ? (
        <AIContentPrompt
          contentType="liveTest"
          teacherName={teacherName}
          onGenerated={handleGenerated}
          onSkip={() => setShowAIPrompt(false)}
        />
      ) : (
        <div className={styles.page}>
          <TeacherFormHeader
            backTo="/teacher/live-tests"
            backLabel="Live tests"
            title="Create a live test"
            subtitle="Set the schedule, pricing and prize pool. You will add the questions in the next step."
          />
          <div className={styles.form}>
            <LiveTestCreationForm
              initialValues={
                aiInitialValues
                  ? {
                      title: aiInitialValues.title,
                      description: aiInitialValues.description,
                      examName: aiInitialValues.examName,
                      language: aiInitialValues.language,
                      price: aiInitialValues.suggestedPrice,
                      durationMinutes: aiInitialValues.durationMinutes,
                    }
                  : null
              }
            />
          </div>
        </div>
      )}
    </>
  );
};

export default CreateLiveTestPage;
