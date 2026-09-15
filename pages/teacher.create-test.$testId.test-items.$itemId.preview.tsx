import React, { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { ChevronLeft, ChevronRight, Eraser, Eye, X, AlertTriangle } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { MathMLContent } from "../components/MathMLContent";
import { QuestionRenderer } from "../components/QuestionRenderer";
import { QuestionData, QuestionAnswer } from "../helpers/questionAnswerTypes";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX } from "../helpers/useTeacherQuestionsBySubject";
import { getTeacherQuestionsBySubject } from "../endpoints/teacher/questions/by-subject_GET.schema";
import styles from "./teacher.create-test.$testId.test-items.$itemId.preview.module.css";

// A read-only walkthrough of every question in a test item, laid out the way
// a student would see it on the real test portal. Deliberately does NOT
// create a real attempt, run a timer, or submit anything anywhere - it's
// built entirely from the teacher's own already-authorized read endpoints
// (the same ones the question manager and question bank already use), and
// reuses QuestionRenderer (the exact presentational component students see).
// Options are selectable so the walkthrough feels like the real thing, but
// the selections live in local state keyed by question id and are thrown
// away when the tab closes - nothing is ever posted. No new backend surface,
// no risk to real attempt/analytics data, no interaction with max-attempt
// quotas.
const Page = () => {
  const { testId, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const packageId = Number(testId);
  const currentItemId = Number(itemId);
  const subjectIdParam = searchParams.get("subjectId");
  const filterSubjectId = subjectIdParam ? Number(subjectIdParam) : null;

  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers have to be tracked per question id, exactly like the real portal
  // does. Handing QuestionRenderer a permanently undefined answer left the
  // underlying Radix RadioGroup with no `value`, so it fell back to its own
  // internal uncontrolled state - and because the question subtree was never
  // remounted between questions, that one internal selection showed up as
  // the chosen option on every single question.
  const [answers, setAnswers] = useState<Map<number, QuestionAnswer>>(new Map());

  const handleAnswerChange = (questionId: number, answer: QuestionAnswer | undefined) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (answer === undefined) {
        next.delete(questionId);
      } else {
        next.set(questionId, answer);
      }
      return next;
    });
  };

  const { data: testItems, isFetching: isItemsFetching } = useTeacherTestItemsQuery(packageId);
  const currentItem = testItems?.find((item) => item.id === currentItemId);

  const { data: allSubjects, isFetching: isSubjectsFetching } = useTestItemSubjectsQuery(currentItemId);
  const activeSubject =
    filterSubjectId != null ? allSubjects?.find((s) => s.id === filterSubjectId) : undefined;
  const subjects = useMemo(() => {
    if (!allSubjects) return allSubjects;
    return filterSubjectId != null ? allSubjects.filter((s) => s.id === filterSubjectId) : allSubjects;
  }, [allSubjects, filterSubjectId]);

  // useQueries needs a stable `queries` array reference — reconstructing it
  // inline on every render (via a fresh .map()) makes it tear down and
  // recreate every query observer on every render, which pegs the main
  // thread. Memoize on subject ids only.
  const subjectIds = useMemo(() => (subjects ?? []).map((s) => s.id), [subjects]);
  const questionQueries = useQueries({
    queries: useMemo(
      () =>
        subjectIds.map((subjectId) => ({
          queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX, subjectId],
          queryFn: () => getTeacherQuestionsBySubject({ subjectId }),
        })),
      [subjectIds]
    ),
  });

  const isQuestionsFetching = questionQueries.some((q) => q.isFetching);
  const isLoading = isItemsFetching || isSubjectsFetching || isQuestionsFetching;

  // Flatten every subject's questions, in the same order the question
  // manager already shows them, into one sequential walkthrough.
  const allQuestions: (QuestionData & { subjectName: string })[] = useMemo(() => {
    if (!subjects) return [];
    const result: (QuestionData & { subjectName: string })[] = [];
    subjects.forEach((subject, subjectIndex) => {
      const questions = questionQueries[subjectIndex]?.data ?? [];
      questions.forEach((q) => {
        result.push({
          id: q.id,
          questionText: q.questionText,
          questionType: (q.questionType ?? "single_correct_mcq") as QuestionData["questionType"],
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          optionE: q.optionE,
          subjectName: subject.subjectName,
          subjectOrderIndex: subjectIndex,
          paragraphText: q.paragraphText,
          matchData: q.matchData as QuestionData["matchData"],
          numericalAnswer: q.numericalAnswer != null ? parseFloat(q.numericalAnswer.toString()) : null,
          numericalTolerance: q.numericalTolerance != null ? parseFloat(q.numericalTolerance.toString()) : null,
          correctOptions: q.correctOptions as string[] | null,
          partialMarking: q.partialMarking,
          positiveMarks: q.positiveMarks != null ? parseFloat(q.positiveMarks.toString()) : null,
          negativeMarks: q.negativeMarks != null ? parseFloat(q.negativeMarks.toString()) : null,
        });
      });
    });
    return result;
  }, [subjects, questionQueries]);

  const total = allQuestions.length;
  const currentQuestion = allQuestions[currentIndex];
  const questionsListUrl =
    filterSubjectId != null
      ? `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions?subjectId=${filterSubjectId}`
      : `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions`;

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  const handleClose = () => {
    // Works when the tab was opened via window.open/target="_blank" from
    // our own app; falls back to sending the tab back to the questions list
    // if the browser won't allow a script-closed tab (e.g. user bookmarked it).
    window.close();
  };

  return (
    <>
      <Helmet>
        <title>
          {currentItem
            ? `Preview: ${currentItem.title}${activeSubject ? ` — ${activeSubject.subjectName}` : ""}`
            : "Preview Test"}{" "}
          | Testkart
        </title>
        <meta name="description" content="Read-only preview of this subject's questions as students will see them." />
      </Helmet>

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.previewBadge}>
              <Eye size={13} /> Preview
            </span>
            <span className={styles.testTitle}>
              {currentItem?.title ?? "Test Preview"}
              {activeSubject ? ` — ${activeSubject.subjectName}` : ""}
            </span>
          </div>
          <div className={styles.headerRight}>
            <Button variant="outline" asChild>
              <Link to={questionsListUrl}>Back to editing</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} title="Close preview tab">
              <X size={18} />
            </Button>
          </div>
        </header>

        <div className={styles.content}>
          {isLoading && (
            <div className={styles.loadingState}>
              <Skeleton style={{ height: "1.5rem", width: "40%", marginBottom: "1.5rem" }} />
              <Skeleton style={{ height: "8rem", width: "100%", marginBottom: "1rem" }} />
              <Skeleton style={{ height: "3rem", width: "100%" }} />
            </div>
          )}

          {!isLoading && total === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
              <h3>No questions yet</h3>
              <p>Add questions to this test item to preview them here.</p>
              <Button asChild variant="outline">
                <Link to={questionsListUrl}>
                  <ChevronLeft size={16} /> Back to editing
                </Link>
              </Button>
            </div>
          )}

          {!isLoading && currentQuestion && (
            <div className={styles.questionCard}>
              <div className={styles.questionMeta}>
                <span className={styles.subjectPill}>{currentQuestion.subjectName}</span>
                <div className={styles.questionMetaRight}>
                  {answers.has(currentQuestion.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAnswerChange(currentQuestion.id, undefined)}
                    >
                      <Eraser size={14} /> Clear response
                    </Button>
                  )}
                  <span className={styles.questionCounter}>
                    Question {currentIndex + 1} of {total}
                  </span>
                </div>
              </div>

              <div className={styles.questionText}>
                <MathMLContent html={currentQuestion.questionText} />
              </div>

              <QuestionRenderer
                key={currentQuestion.id}
                question={currentQuestion}
                answer={answers.get(currentQuestion.id)}
                onAnswerChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
              />
            </div>
          )}
        </div>

        {!isLoading && total > 0 && (
          <footer className={styles.footer}>
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
              <ChevronLeft size={16} /> Previous
            </Button>
            <span className={styles.footerCounter}>
              {currentIndex + 1} / {total}
            </span>
            <Button onClick={handleNext} disabled={currentIndex >= total - 1}>
              Next <ChevronRight size={16} />
            </Button>
          </footer>
        )}
      </div>
    </>
  );
};

export default Page;
