import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { QuestionForm } from "../components/QuestionForm";
import { QuestionPillNav } from "../components/QuestionPillNav";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery, getSubjectSectionsQueryKey } from "../helpers/useSubjectSections";
import {
  useTeacherQuestionsBySubjectQuery,
  TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX,
} from "../helpers/useTeacherQuestionsBySubject";
import { getTestItemSubjectsQueryKey } from "../helpers/useTestItemSubjectsQuery";
import styles from "./teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.module.css";

const FORM_ID = "question-full-page-edit-form";
const LEAVE_MESSAGE = "You have unsaved changes to this question. Leave without saving?";

const Page = () => {
  const { testId, itemId, questionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const packageId = Number(testId);
  const currentItemId = Number(itemId);
  const currentQuestionId = Number(questionId);
  const subjectId = Number(searchParams.get("subjectId"));

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const testItemsQuery = useTeacherTestItemsQuery(packageId);
  const currentItem = testItemsQuery.data?.find((item) => item.id === currentItemId);

  const { data: subjects } = useTestItemSubjectsQuery(currentItemId);
  const currentSubject = subjects?.find((s) => s.id === subjectId);

  const sectionsQuery = useSubjectSectionsQuery(subjectId || null);
  const questionsQuery = useTeacherQuestionsBySubjectQuery(subjectId || null);
  const sections = sectionsQuery.data;
  const questions = questionsQuery.data;

  const question = questions?.find((q) => q.id === currentQuestionId);
  const questionIndex = questions?.findIndex((q) => q.id === currentQuestionId) ?? -1;
  const nextQuestion =
    questions && questionIndex > -1 && questionIndex < questions.length - 1
      ? questions[questionIndex + 1]
      : null;

  const questionsListUrl = `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions?subjectId=${subjectId}`;

  // The form reads its starting values once, so it waits for everything those
  // values depend on. Background refetches after that never touch it.
  const settled = (query: { data?: unknown; isError: boolean }) => query.data !== undefined || query.isError;
  const isReady = settled(testItemsQuery) && settled(sectionsQuery) && settled(questionsQuery);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const confirmLeave = (event: React.MouseEvent) => {
    if (isDirty && !window.confirm(LEAVE_MESSAGE)) {
      event.preventDefault();
    }
  };

  // The question mutations invalidate by test item; this page and the list
  // read the by-subject cache, so sync those explicitly.
  const syncListCaches = () => {
    queryClient.invalidateQueries({
      queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX, subjectId],
    });
    queryClient.invalidateQueries({
      queryKey: getTestItemSubjectsQueryKey(currentItemId),
    });
    queryClient.invalidateQueries({
      queryKey: getSubjectSectionsQueryKey(subjectId),
    });
  };

  const handleSuccess = () => {
    setIsDirty(false);
    syncListCaches();
    if (nextQuestion) {
      navigate(
        `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions/${nextQuestion.id}/edit?subjectId=${subjectId}`
      );
    } else {
      navigate(questionsListUrl);
    }
  };

  const renderBody = () => {
    if (subjectId && !isReady) {
      return (
        <div className={styles.loadingState}>
          <Skeleton style={{ height: "2.5rem", width: "100%" }} />
          <Skeleton style={{ height: "10rem", width: "100%" }} />
          <Skeleton style={{ height: "8rem", width: "100%" }} />
        </div>
      );
    }

    if (!question || !subjectId) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
          <h3>Question not found</h3>
          <p>This question may have been deleted, or the link is missing its subject.</p>
          <Button asChild variant="outline">
            <Link to={questionsListUrl}>
              <ChevronLeft size={16} /> Back to questions
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <QuestionForm
        // react-router reuses this page when only :questionId changes, and the
        // form seeds its values at mount, so the question id is the key.
        key={question.id}
        variant="page"
        formId={FORM_ID}
        subjectId={subjectId}
        questionToEdit={question}
        sections={sections}
        questionWiseTiming={currentItem?.questionWiseTiming}
        onSuccess={handleSuccess}
        onPendingChange={setIsSaving}
        onDirtyChange={setIsDirty}
        onSaveShortcut={() => saveButtonRef.current?.click()}
      />
    );
  };

  return (
    <>
      <Helmet>
        <title>Edit Question | Testkart</title>
        <meta name="description" content="Edit a mock test question in the full-page editor." />
      </Helmet>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.breadcrumb}>
              <Link to={questionsListUrl} className={styles.breadcrumbLink} onClick={confirmLeave}>
                <ChevronLeft size={14} /> Back to {currentSubject?.subjectName ?? "questions"}
              </Link>
              {questionIndex > -1 && (
                <span className={styles.breadcrumbCurrent}>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  Editing Q{questionIndex + 1}
                  {isDirty && <span className={styles.unsavedHint}>Unsaved changes</span>}
                </span>
              )}
            </div>
            <div className={styles.headerActions}>
              <Button variant="outline" asChild>
                <Link to={questionsListUrl} onClick={confirmLeave}>Cancel</Link>
              </Button>
              <Button
                ref={saveButtonRef}
                type="submit"
                form={FORM_ID}
                disabled={isSaving || !question}
                title="Save (Ctrl+Enter)"
              >
                {isSaving ? "Saving..." : nextQuestion ? "Save & next" : "Save & back to questions"}
              </Button>
            </div>
          </div>
          {subjectId > 0 && (
            <QuestionPillNav
              questions={questions ?? []}
              currentQuestionId={currentQuestionId}
              getEditUrl={(qId) =>
                `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions/${qId}/edit?subjectId=${subjectId}`
              }
              newQuestionUrl={`/teacher/create-test/${packageId}/test-items/${currentItemId}/questions/new?subjectId=${subjectId}`}
              onNavigate={confirmLeave}
            />
          )}
        </header>

        <div className={styles.content}>{renderBody()}</div>
      </div>
    </>
  );
};

export default Page;
