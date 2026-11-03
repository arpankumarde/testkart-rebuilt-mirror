import React, { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { QuestionsManager } from "./QuestionsManager";
import { useTeacherTestsQuery, useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery, useTestItemSubjectsMutations } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery } from "../helpers/useSubjectSections";
import styles from "./TestItemQuestionsEditor.module.css";

interface TestItemQuestionsEditorProps {
  packageId: number;
  itemId: number;
  /** Where "Go to tests" leads when no default subject could be created. */
  itemsHref: string;
}

/*
 * Questions of one subject in a test series item. The subject comes from
 * ?subjectId=, defaulting to the first. A test with no subjects gets a default
 * "Subject 1", as the Subjects panel does, so Add questions on a test card
 * lands straight on the editor. Shared by the teacher questions page and the
 * admin editor.
 */
export const TestItemQuestionsEditor = ({ packageId, itemId, itemsHref }: TestItemQuestionsEditorProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectIdParam = searchParams.get("subjectId");
  const selectedSubjectIdFromUrl = subjectIdParam ? Number(subjectIdParam) : null;

  const { data: tests } = useTeacherTestsQuery();
  const { data: testItems, isLoading: isItemsLoading } = useTeacherTestItemsQuery(packageId);
  const { data: subjects, isFetching: isSubjectsFetching, isLoading: isSubjectsLoading, refetch: refetchSubjects } =
    useTestItemSubjectsQuery(itemId);
  const { useCreateMultipleSubjectsMutation } = useTestItemSubjectsMutations(itemId);
  const createDefaultSubject = useCreateMultipleSubjectsMutation();
  const hasAutoCreatedRef = useRef(false);

  const testPackage = tests?.find((t) => t.id === packageId);
  const examName = testPackage?.examName || "Exam";
  const currentItem = testItems?.find((item) => item.id === itemId);
  const selectedSubject = subjects?.find((s) => s.id === selectedSubjectIdFromUrl) ?? null;

  useEffect(() => {
    if (!isSubjectsFetching && subjects && subjects.length === 0 && currentItem && !hasAutoCreatedRef.current) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubjectsFetching, subjects, itemId, currentItem]);

  // Backward compatibility: if the URL has no subject (or an invalid one),
  // default to the first subject so old links / the bare item route still work.
  useEffect(() => {
    if (!isSubjectsFetching && subjects && subjects.length > 0) {
      const isValidSelection =
        selectedSubjectIdFromUrl !== null && subjects.some((s) => s.id === selectedSubjectIdFromUrl);
      if (!isValidSelection) {
        const params = new URLSearchParams(searchParams);
        params.set("subjectId", subjects[0].id.toString());
        setSearchParams(params, { replace: true });
      }
    }
  }, [isSubjectsFetching, subjects, selectedSubjectIdFromUrl, searchParams, setSearchParams]);

  const { data: sectionsData } = useSubjectSectionsQuery(selectedSubject?.id ?? null);

  // Both queries refetch on mount so the counts stay honest; gate the skeleton
  // on "no data yet" rather than "request in flight", or every visit blanks a
  // page we could already render.
  if (isItemsLoading || isSubjectsLoading) {
    return <Skeleton style={{ height: "300px" }} />;
  }

  if (!currentItem) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
        <h3>Could not open this test</h3>
        <p>The selected test item could not be found in this package.</p>
      </div>
    );
  }

  if (subjects && subjects.length === 0 && (createDefaultSubject.isPending || !createDefaultSubject.isError)) {
    return <Skeleton style={{ height: "300px" }} />;
  }

  if (!subjects || subjects.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
        <h3>Could not set up this test</h3>
        <p>Add a subject from the test's Subjects panel, then come back to add questions.</p>
        <Button asChild>
          <Link to={itemsHref}>Go to tests</Link>
        </Button>
      </div>
    );
  }

  if (!selectedSubject) {
    return <Skeleton style={{ height: "300px" }} />;
  }

  return (
    <div className={styles.mainContent}>
      {currentItem.subjectWiseTiming && selectedSubject.durationMinutes != null && (
        <p className={styles.subjectMeta}>{selectedSubject.durationMinutes} min</p>
      )}
      {selectedSubject.description && (
        <p className={styles.subjectDescription}>{selectedSubject.description}</p>
      )}
      <QuestionsManager
        testId={packageId}
        itemId={itemId}
        subjectId={selectedSubject.id}
        examName={examName}
        subjectName={selectedSubject.subjectName}
        sections={sectionsData ?? []}
        questionWiseTiming={currentItem.questionWiseTiming}
      />
    </div>
  );
};