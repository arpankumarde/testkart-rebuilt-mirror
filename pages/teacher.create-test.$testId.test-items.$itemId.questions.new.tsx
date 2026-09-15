import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { QuestionForm, QuestionTypeValue } from "../components/QuestionForm";
import { QuestionPillNav } from "../components/QuestionPillNav";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery, getSubjectSectionsQueryKey } from "../helpers/useSubjectSections";
import {
  useTeacherQuestionsBySubjectQuery,
  TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX,
} from "../helpers/useTeacherQuestionsBySubject";
import { getTestItemSubjectsQueryKey } from "../helpers/useTestItemSubjectsQuery";
import styles from "./teacher.create-test.$testId.test-items.$itemId.questions.new.module.css";

const FORM_ID = "question-full-page-new-form";
const LEAVE_MESSAGE = "You have unsaved changes to this question. Leave without saving?";

type CarryOver = {
  sectionId: number | null;
  questionType: QuestionTypeValue;
  positiveMarks?: number;
  negativeMarks?: number;
  durationSeconds: number | null;
};

const toMarks = (value: unknown) => {
  const parsed = parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const Page = () => {
  const { testId, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const packageId = Number(testId);
  const currentItemId = Number(itemId);
  const subjectId = Number(searchParams.get("subjectId"));
  const sectionIdParam = searchParams.get("sectionId");
  const urlSectionId = sectionIdParam ? Number(sectionIdParam) : null;

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Bumped after every "Save & Add Another" to mount a fresh, blank form.
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  // Section, type, marks and timing of the question just saved, so a run of
  // similar questions does not need them re-entered every time.
  const [carryOver, setCarryOver] = useState<CarryOver | null>(null);
  // Set in each submit button's onClick, which runs before the form's submit
  // handler, so handleSuccess knows which action the teacher chose.
  const pendingActionRef = useRef<"addAnother" | "finish">("addAnother");
  const addAnotherButtonRef = useRef<HTMLButtonElement>(null);

  const testItemsQuery = useTeacherTestItemsQuery(packageId);
  const currentItem = testItemsQuery.data?.find((item) => item.id === currentItemId);

  const { data: subjects } = useTestItemSubjectsQuery(currentItemId);
  const currentSubject = subjects?.find((s) => s.id === subjectId);

  const sectionsQuery = useSubjectSectionsQuery(subjectId || null);
  const questionsQuery = useTeacherQuestionsBySubjectQuery(subjectId || null);
  const sections = sectionsQuery.data;
  const questions = questionsQuery.data;

  const lastQuestion = questions && questions.length > 0 ? questions[questions.length - 1] : null;

  const questionsListUrl = `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions?subjectId=${subjectId}`;
  const newQuestionUrl = (sid?: number | null) =>
    `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions/new?subjectId=${subjectId}${sid != null ? `&sectionId=${sid}` : ""}`;
  const getEditUrl = (questionId: number) =>
    `/teacher/create-test/${packageId}/test-items/${currentItemId}/questions/${questionId}/edit?subjectId=${subjectId}`;

  // Defaults are read once when the form mounts, so it waits for the data
  // they come from. Background refetches after that never remount it.
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

  // The create mutation invalidates by test item; the list and this page's
  // pill nav read the by-subject cache, so sync those explicitly.
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

  const handleSuccess = (saved: {
    sectionId: number | null;
    questionType: string | null;
    positiveMarks: unknown;
    negativeMarks: unknown;
    durationSeconds: number | null;
  }) => {
    setIsDirty(false);
    syncListCaches();
    if (pendingActionRef.current === "finish") {
      navigate(questionsListUrl);
      return;
    }
    setCarryOver({
      sectionId: saved.sectionId ?? null,
      questionType: (saved.questionType ?? "single_correct_mcq") as QuestionTypeValue,
      positiveMarks: toMarks(saved.positiveMarks),
      negativeMarks: toMarks(saved.negativeMarks),
      durationSeconds: saved.durationSeconds ?? null,
    });
    setFormInstanceKey((k) => k + 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
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

    if (!subjectId) {
      return (
        <div className={styles.emptyState}>
          <p>This link is missing its subject. Go back and try again from the questions list.</p>
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
        // A new key mounts a blank form: after Save & Add Another, or when the
        // link changes subject or section while this page stays mounted.
        key={`${subjectId}-${urlSectionId ?? "none"}-${formInstanceKey}`}
        variant="page"
        formId={FORM_ID}
        subjectId={subjectId}
        sections={sections}
        defaultSectionId={carryOver ? carryOver.sectionId : urlSectionId}
        defaultQuestionType={carryOver?.questionType}
        questionWiseTiming={currentItem?.questionWiseTiming}
        defaultPositiveMarks={carryOver?.positiveMarks ?? toMarks(lastQuestion?.positiveMarks)}
        defaultNegativeMarks={carryOver?.negativeMarks ?? toMarks(lastQuestion?.negativeMarks)}
        defaultDurationSeconds={carryOver?.durationSeconds}
        onSuccess={handleSuccess}
        onPendingChange={setIsSaving}
        onDirtyChange={setIsDirty}
        onSaveShortcut={() => {
          pendingActionRef.current = "addAnother";
          addAnotherButtonRef.current?.click();
        }}
      />
    );
  };

  return (
    <>
      <Helmet>
        <title>Add Question | Testkart</title>
        <meta name="description" content="Add a new mock test question in the full-page editor." />
      </Helmet>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.breadcrumb}>
              <Link to={questionsListUrl} className={styles.breadcrumbLink} onClick={confirmLeave}>
                <ChevronLeft size={14} /> Back to {currentSubject?.subjectName ?? "questions"}
              </Link>
              <span className={styles.breadcrumbCurrent}>
                <span className={styles.breadcrumbSeparator}>/</span>
                New Question
                {isDirty && <span className={styles.unsavedHint}>Unsaved changes</span>}
              </span>
            </div>
            <div className={styles.headerActions}>
              <Button variant="outline" asChild>
                <Link to={questionsListUrl} onClick={confirmLeave}>Cancel</Link>
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                variant="outline"
                disabled={isSaving || !subjectId}
                onClick={() => {
                  pendingActionRef.current = "finish";
                }}
              >
                Save & Finish
              </Button>
              <Button
                ref={addAnotherButtonRef}
                type="submit"
                form={FORM_ID}
                disabled={isSaving || !subjectId}
                title="Save & Add Another (Ctrl+Enter)"
                onClick={() => {
                  pendingActionRef.current = "addAnother";
                }}
              >
                {isSaving ? "Saving..." : "Save & Add Another"}
              </Button>
            </div>
          </div>
          {subjectId > 0 && (
            <QuestionPillNav
              questions={questions ?? []}
              getEditUrl={getEditUrl}
              newQuestionUrl={newQuestionUrl()}
              isNewActive
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
