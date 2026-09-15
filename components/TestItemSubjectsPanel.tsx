import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, FileText, Clock } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { SubjectManagementDialog } from "./SubjectManagementDialog";
import {
  useTestItemSubjectsQuery,
  useTestItemSubjectsMutations,
} from "../helpers/useTestItemSubjectsQuery";
import styles from "./TestItemSubjectsPanel.module.css";

type TestItemSubjectsPanelProps = {
  packageId: number;
  itemId: number;
  subjectWiseTiming?: boolean;
};

export const TestItemSubjectsPanel = ({
  packageId,
  itemId,
  subjectWiseTiming,
}: TestItemSubjectsPanelProps) => {
  const {
    data: subjects,
    isFetching: isSubjectsFetching,
    // isLoading is "no data yet", isFetching is "a request is in flight".
    // The query refetches on every mount to keep actualQuestionCount honest, so
    // gating the list on isFetching would flash a skeleton over data we already
    // have on each visit. Revalidate quietly instead.
    isLoading: isSubjectsLoading,
    refetch: refetchSubjects,
  } = useTestItemSubjectsQuery(itemId);

  const { useCreateMultipleSubjectsMutation, useDeleteSubjectMutation } =
    useTestItemSubjectsMutations(itemId);
  const createDefaultSubject = useCreateMultipleSubjectsMutation();
  const deleteSubject = useDeleteSubjectMutation();

  // Auto-provision a default "Subject 1" so a test item is never shown empty.
  const hasAutoCreatedRef = useRef(false);
  useEffect(() => {
    if (
      !isSubjectsFetching &&
      subjects &&
      subjects.length === 0 &&
      !hasAutoCreatedRef.current &&
      !createDefaultSubject.isPending
    ) {
      hasAutoCreatedRef.current = true;
      createDefaultSubject.mutate(
        { testItemId: itemId, subjectNames: ["Subject 1"] },
        {
          onSuccess: () => refetchSubjects(),
          onError: () => {
            hasAutoCreatedRef.current = false;
          },
        }
      );
    }
  }, [isSubjectsFetching, subjects, itemId]);

  const handleDeleteSubject = (
    subjectId: number,
    subjectName: string,
    questionCount: number
  ) => {
    const message =
      questionCount > 0
        ? `Delete "${subjectName}"? This will also delete all ${questionCount} question(s) in it.`
        : `Delete "${subjectName}"?`;
    if (window.confirm(message)) {
      deleteSubject.mutate(
        { id: subjectId },
        {
          onSuccess: () => {
            toast.success("Subject deleted.");
            refetchSubjects();
          },
          onError: (e) =>
            toast.error(
              e instanceof Error ? e.message : "Failed to delete subject."
            ),
        }
      );
    }
  };

  const isProvisioningDefault =
    !isSubjectsFetching && subjects && subjects.length === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <SubjectManagementDialog
          packageId={packageId}
          testItemId={itemId}
          onSuccess={refetchSubjects}
          subjectWiseTiming={subjectWiseTiming}
          className={styles.addSubjectBtn}
        />
      </div>

      {isSubjectsLoading ? (
        <Skeleton style={{ height: "90px" }} />
      ) : isProvisioningDefault ? (
        <Skeleton style={{ height: "90px" }} />
      ) : (
        <div className={styles.list}>
          {(subjects ?? []).map((subject) => (
            <div key={subject.id} className={styles.subjectCard}>
              <div className={styles.subjectContent}>
                <Link
                  to={`/teacher/create-test/${packageId}/test-items/${itemId}/questions?subjectId=${subject.id}`}
                  className={styles.subjectTitle}
                >
                  {subject.subjectName}
                </Link>
                <div className={styles.subjectMeta}>
                  <span>
                    <FileText size={13} /> {subject.actualQuestionCount}{" "}
                    Question{subject.actualQuestionCount === 1 ? "" : "s"}
                  </span>
                  {subjectWiseTiming && (
                    <span>
                      <Clock size={13} /> {subject.durationMinutes ?? 20} min
                    </span>
                  )}
                  {subject.maxAttemptsAllowed != null && (
                    <span>Max {subject.maxAttemptsAllowed} to attempt</span>
                  )}
                </div>
              </div>
              <div className={styles.subjectActions}>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={`/teacher/create-test/${packageId}/test-items/${itemId}/questions?subjectId=${subject.id}`}
                  >
                    Manage Questions
                  </Link>
                </Button>
                <SubjectManagementDialog
                  packageId={packageId}
                  testItemId={itemId}
                  subjectToEdit={subject}
                  onSuccess={refetchSubjects}
                  subjectWiseTiming={subjectWiseTiming}
                />
                <Button
                  variant="ghost"
                  size="icon-md"
                  className={styles.deleteButton}
                  onClick={() =>
                    handleDeleteSubject(
                      subject.id,
                      subject.subjectName,
                      subject.actualQuestionCount
                    )
                  }
                  disabled={deleteSubject.isPending}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
