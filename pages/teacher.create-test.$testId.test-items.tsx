import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Check, ChevronRight, Circle } from "lucide-react";
import { Button } from '../components/Button';
import { TeacherRejectionBanner } from '../components/TeacherRejectionBanner';
import { TestSeriesSteps } from '../components/TestSeriesSteps';
import { AddTestItemsButton, TestSeriesItemsList } from '../components/TestSeriesItemsEditor';
import { useTeacherTestItemsQuery } from '../helpers/useTeacherTestsQuery';
import { MIN_SERIES_QUESTIONS } from '../helpers/testSeriesMinimum';
import { isScheduledAhead } from '../helpers/testSchedule';
import styles from "./teacher.create-test.$testId.test-items.module.css";

const Page = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const packageId = Number(testId);

  const { data: testItems } = useTeacherTestItemsQuery(packageId);

  // The two series-wide rules the review page enforces, shown while building.
  const totalQuestions = (testItems ?? []).reduce((sum, item) => sum + item.questionsCount, 0);
  const openNow = (testItems ?? []).some((item) => item.questionsCount > 0 && !isScheduledAhead(item.scheduledDate));
  const progress = [
    {
      key: "questions",
      done: totalQuestions >= MIN_SERIES_QUESTIONS,
      label: `${Math.min(totalQuestions, MIN_SERIES_QUESTIONS)} of ${MIN_SERIES_QUESTIONS} questions to publish`,
    },
    { key: "open", done: openNow, label: "At least one test open now with questions" },
  ];

  return (
    <>
      <Helmet>
        <title>Tests in this series | Testkart</title>
        <meta name="description" content="Add, edit, or remove individual tests within your mock test package." />
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <TestSeriesSteps current="tests" packageId={packageId} back="/teacher/test-series" />

        <TeacherRejectionBanner contentType="mock_test" contentId={packageId} />

        <div className={styles.toolbar}>
          {testItems && testItems.length > 0 ? (
            <ul className={styles.progress} aria-label="Before you can publish">
              {progress.map((rule) => (
                <li key={rule.key} className={rule.done ? styles.progressDone : styles.progressTodo}>
                  {rule.done ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                  {rule.label}
                  <span className={styles.visuallyHidden}>{rule.done ? ", done" : ", not done yet"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <AddTestItemsButton packageId={packageId} />
        </div>

        <TestSeriesItemsList packageId={packageId} guided />

        <div className={styles.navigation}>
          <Button onClick={() => navigate(`/teacher/create-test/${packageId}/review`)} disabled={!testItems?.length}>
            Next: Review and publish <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
};

export default Page;