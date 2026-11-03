import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./Button";
import { TeacherFlowSteps, type TeacherFlowStepTone } from "./TeacherFlowSteps";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import styles from "./TestSeriesSteps.module.css";

export type TestSeriesStep = "details" | "tests" | "questions" | "publish";

const STEPS: { key: TestSeriesStep; label: string; hint: string; tone: TeacherFlowStepTone }[] = [
  { key: "details", label: "Details", hint: "Name, exam and price", tone: "lavender" },
  { key: "tests", label: "Tests", hint: "Papers in the series", tone: "mint" },
  { key: "questions", label: "Questions", hint: "Fill each test", tone: "butter" },
  { key: "publish", label: "Publish", hint: "Check and go live", tone: "peach" },
];

/*
 * The top of every test series step page: a Go back button and the track, the
 * same on each step so moving between steps does not shift the page. Each step
 * has its own /app palette tone. Pages that render this also put the global
 * tk-flow class on their root, which restyles their Buttons (Button.module.css). Before
 * the series exists (the create page) no step links anywhere; after that every
 * step is a link, and Questions opens the first test that still has none.
 * `back` is a path, or a handler for a form that must confirm before leaving.
 */
export const TestSeriesSteps = ({
  current,
  packageId,
  back,
}: {
  current: TestSeriesStep;
  packageId?: number;
  back: string | (() => void);
}) => {
  const { data: items } = useTeacherTestItemsQuery(packageId ?? null, { refetchOnMount: false });
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  const firstToFill = items?.find((item) => item.questionsCount === 0) ?? items?.[0];
  const hrefFor = (key: TestSeriesStep): string | null => {
    if (!packageId) return null;
    const base = `/teacher/create-test/${packageId}`;
    if (key === "details") return `/teacher/create-test/basic-info?testId=${packageId}`;
    if (key === "tests") return `${base}/test-items`;
    if (key === "questions") return firstToFill ? `${base}/test-items/${firstToFill.id}/questions` : null;
    return `${base}/review`;
  };

  const backContent = (
    <>
      <ArrowLeft size={16} aria-hidden="true" /> Go back
    </>
  );

  return (
    <div className={styles.top}>
      {typeof back === "string" ? (
        <Button asChild variant="ghost" size="sm" className={styles.back}>
          <Link to={back}>{backContent}</Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" className={styles.back} onClick={back}>
          {backContent}
        </Button>
      )}
      <TeacherFlowSteps
        label="Test series steps"
        steps={STEPS.map((step, index) => ({
          ...step,
          state: index < currentIndex ? "done" : index === currentIndex ? "current" : "todo",
          href: hrefFor(step.key),
        }))}
      />
    </div>
  );
};
