import React from "react";
import { Link } from "react-router-dom";
import styles from "./TestCreationProgress.module.css";

interface TestCreationProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  testId: number | null;
  className?: string;
  isLiveTest?: boolean;
}

const steps = [
  {
    number: 1,
    title: "Basic Info",
    getPath: (testId: number | null) =>
      testId ? `/teacher/create-test/basic-info?testId=${testId}` : `/teacher/create-test`,
  },
  {
    number: 2,
    title: "Test Items",
    getPath: (testId: number | null) =>
      testId ? `/teacher/create-test/${testId}/test-items` : null,
  },
  {
    number: 3,
    title: "Questions",
    getPath: (_testId: number | null) => null, // Path is dynamic, cannot link directly
  },
  {
    number: 4,
    title: "Review & Publish",
    getPath: (testId: number | null) =>
      testId ? `/teacher/create-test/${testId}/review` : null,
  },
];

export const TestCreationProgress: React.FC<TestCreationProgressProps> = ({
  currentStep,
  testId,
  className,
  isLiveTest = false,
}) => {
  // Filter out "Basic Info" step for live tests
  const filteredSteps = isLiveTest
    ? steps.filter((step) => step.title !== "Basic Info")
    : steps;

  // Renumber steps for display
  const displaySteps = filteredSteps.map((step, index) => ({
    ...step,
    displayNumber: index + 1,
  }));

  return (
    <div className={`${styles.progressContainer} ${className || ""}`}>
      <div className={styles.steps}>
        {displaySteps.map((step, index) => {
          const isCompleted = step.displayNumber < currentStep;
          const isCurrent = step.displayNumber === currentStep;
          const path = step.getPath(testId);
          const isClickable = path !== null && (isCompleted || isCurrent || testId !== null);

          const StepContent = (
            <>
              <div
                className={`${styles.stepIndicator} ${
                  isCompleted ? styles.completed : ""
                } ${isCurrent ? styles.current : ""}`}
              >
                {isCompleted ? "✔" : step.displayNumber}
              </div>
              <span className={styles.stepTitle}>{step.title}</span>
            </>
          );

          return (
            <React.Fragment key={step.number}>
              {isClickable ? (
                <Link to={path} className={styles.step}>
                  {StepContent}
                </Link>
              ) : (
                <div className={`${styles.step} ${styles.disabled}`}>
                  {StepContent}
                </div>
              )}
              {index < displaySteps.length - 1 && <div className={styles.connector} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};