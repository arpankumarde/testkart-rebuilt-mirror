import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { QuestionsManager } from "./QuestionsManager";
import { SubjectManagementDialog } from "./SubjectManagementDialog";
import { SortableSubjectTabs } from "./SortableSubjectTabs";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestQueries";
import { useTestItemSubjectsQuery, useTestItemSubjectsMutations } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery } from "../helpers/useSubjectSections";
import { Selectable } from "kysely";
import { TestItemSubjects } from "../helpers/schema";
import styles from "./LiveTestQuestionsEditor.module.css";

type SubjectWithCount = Selectable<TestItemSubjects> & {
  actualQuestionCount: number;
};

/* Subjects and questions of one live test. Shared by the teacher questions page and the admin editor. */
export const LiveTestQuestionsEditor = ({ liveTestId }: { liveTestId: number }) => {
  const { data: liveTestDetails, isFetching: isDetailsFetching, error } = useLiveTestDetailsQuery(liveTestId);

  const testItemId = liveTestDetails?.mockTestItem?.id ?? null;
  const packageId = liveTestDetails?.mockTest?.id ?? null;

  const {
    data: subjects,
    isFetching: isSubjectsFetching,
    refetch: refetchSubjects,
  } = useTestItemSubjectsQuery(testItemId);
  const { useDeleteSubjectMutation } = useTestItemSubjectsMutations(testItemId!);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [localSubjects, setLocalSubjects] = useState<SubjectWithCount[] | null>(null);

  const { data: sectionsData } = useSubjectSectionsQuery(selectedSubjectId);

  const displaySubjects = localSubjects ?? subjects ?? [];

  useEffect(() => {
    if (subjects && subjects.length > 0 && selectedSubjectId === null) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (subjects) {
      setLocalSubjects(subjects);
    }
  }, [subjects]);

  const handleSubjectsRefetch = () => {
    setLocalSubjects(null);
    refetchSubjects();
  };

  const deleteSubject = useDeleteSubjectMutation();

  const handleDeleteSubject = (subjectId: number, subjectName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the subject "${subjectName}"? This will also delete all questions in this subject.`
      )
    ) {
      deleteSubject.mutate(
        { id: subjectId },
        {
          onSuccess: () => {
            toast.success("Subject deleted successfully.");
            handleSubjectsRefetch();
            if (selectedSubjectId === subjectId) {
              const remainingSubjects = displaySubjects.filter((s) => s.id !== subjectId);
              setSelectedSubjectId(remainingSubjects.length > 0 ? remainingSubjects[0].id : null);
            }
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete subject."),
        }
      );
    }
  };

  // Skeleton only before the first load. Background refetches after adding or
  // deleting a question keep the manager mounted, with its scroll and state.
  if ((!liveTestDetails && isDetailsFetching) || (testItemId && !subjects && isSubjectsFetching)) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  if (error && !liveTestDetails) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
        <h3>Could not load this live test</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!liveTestDetails || !testItemId || !packageId) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
        <h3>Could not open this live test</h3>
        <p>The requested live test could not be found.</p>
      </div>
    );
  }

  if (!subjects || subjects.length === 0) {
    return (
      <div className={styles.mainContent}>
        <div className={styles.emptyState}>
          <h3>No Subjects Yet</h3>
          <p>Add subjects to organize questions for this live test.</p>
          <SubjectManagementDialog
            packageId={packageId}
            testItemId={testItemId}
            onSuccess={handleSubjectsRefetch}
            subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
          />
        </div>
      </div>
    );
  }

  const selectedSubject = displaySubjects.find((s) => s.id === selectedSubjectId);

  return (
    <div className={styles.mainContent}>
      <div className={styles.tabsWrapper}>
        <SortableSubjectTabs
          subjects={displaySubjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={setSelectedSubjectId}
          testItemId={testItemId}
          onReorderSuccess={setLocalSubjects}
          className={styles.sortableTabsContainer}
        />
        {selectedSubject && (
          <div className={styles.subjectActionsLeft}>
            <SubjectManagementDialog
              packageId={packageId}
              testItemId={testItemId}
              subjectToEdit={selectedSubject}
              onSuccess={handleSubjectsRefetch}
              subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDeleteSubject(selectedSubject.id, selectedSubject.subjectName)}
              disabled={deleteSubject.isPending}
            >
              <Trash2 size={16} />
              <span className={styles.srOnly}>Delete</span>
            </Button>
          </div>
        )}
        <div className={styles.subjectActionsRight}>
          <SubjectManagementDialog
            packageId={packageId}
            testItemId={testItemId}
            onSuccess={handleSubjectsRefetch}
            subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
          />
        </div>
      </div>

      {selectedSubject && (
        <div className={styles.subjectContent}>
          {liveTestDetails.mockTestItem?.subjectWiseTiming && selectedSubject.durationMinutes != null && (
            <p className={styles.subjectMeta}>{selectedSubject.durationMinutes} min</p>
          )}
          {selectedSubject.description && (
            <p className={styles.subjectDescription}>{selectedSubject.description}</p>
          )}
          <QuestionsManager
            testId={packageId}
            subjectId={selectedSubject.id}
            examName={liveTestDetails.mockTest?.examName || "Live Test"}
            subjectName={selectedSubject.subjectName}
            refetchSubjects={handleSubjectsRefetch}
            sections={sectionsData ?? []}
            questionWiseTiming={liveTestDetails.mockTestItem?.questionWiseTiming}
          />
        </div>
      )}
    </div>
  );
};