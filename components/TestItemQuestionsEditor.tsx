import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { QuestionsManager } from "./QuestionsManager";
import { useTeacherTestsQuery, useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery } from "../helpers/useSubjectSections";
import styles from "./TestItemQuestionsEditor.module.css";

interface TestItemQuestionsEditorProps {
  packageId: number;
  itemId: number;
  /** Where "Go to Test Items" leads when the test has no subjects. */
  itemsHref: string;
}

/*
 * Questions of one subject in a test series item. The subject comes from
 * ?subjectId=, defaulting to the first. Shared by the teacher questions page
 * and the admin editor.
 */
export const TestItemQuestionsEditor = ({ packageId, itemId, itemsHref }: TestItemQuestionsEditorProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectIdParam = searchParams.get("subjectId");
  const selectedSubjectIdFromUrl = subjectIdParam ? Number(subjectIdParam) : null;

  const { data: tests } = useTeacherTestsQuery();
  const { data: testItems, isLoading: isItemsLoading } = useTeacherTestItemsQuery(packageId);
  const { data: subjects, isFetching: isSubjectsFetching, isLoading: isSubjectsLoading } =
    useTestItemSubjectsQuery(itemId);

  const testPackage = tests?.find((t) => t.id === packageId);
  const examName = testPackage?.examName || "Exam";
  const currentItem = testItems?.find((item) => item.id === itemId);
  const selectedSubject = subjects?.find((s) => s.id === selectedSubjectIdFromUrl) ?? null;

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

  if (!subjects || subjects.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
        <h3>No subjects yet</h3>
        <p>Add a subject from the test item's Subjects panel before adding questions.</p>
        <Button asChild>
          <Link to={itemsHref}>Go to Test Items</Link>
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