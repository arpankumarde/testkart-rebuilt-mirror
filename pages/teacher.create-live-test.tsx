import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { LiveTestCreationForm } from "../components/LiveTestCreationForm";
import { TeacherFormHeader } from "../components/TeacherFormHeader";
import { TeacherAIFillPanel, type TeacherAIFillValues } from "../components/TeacherAIFillPanel";
import styles from "./teacher.create-live-test.module.css";

const CreateLiveTestPage: React.FC = () => {
  // The form takes AI values when it mounts, so each fill remounts it.
  const [aiFill, setAiFill] = useState<{ key: number; values: TeacherAIFillValues } | null>(null);
  const aiInitialValues = aiFill?.values ?? null;

  return (
    <>
      <Helmet>
        <title>Create Live Test | Teacher Dashboard | Testkart</title>
        <meta
          name="description"
          content="Schedule and create a new live test event for your students on Testkart."
        />
      </Helmet>

      <div className={styles.page}>
          <TeacherFormHeader kind="live_test"
            backTo="/teacher/live-tests"
            backLabel="Live tests"
            title="Create a live test"
            subtitle="Set the schedule, pricing and prize pool. You will add the questions in the next step."
          />
          <TeacherAIFillPanel
            contentType="liveTest"
            fills="title, description, exam, price and duration"
            placeholder="e.g., SSC CGL Tier 1 live mock, 100 questions in 60 minutes, this Sunday evening"
            onGenerated={(values) => setAiFill((prev) => ({ key: (prev?.key ?? 0) + 1, values }))}
          />
          <div className={styles.form}>
            <LiveTestCreationForm
              key={aiFill?.key ?? 0}
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
    </>
  );
};

export default CreateLiveTestPage;
