import React, { useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "../components/Button";
import {
  useTeacherTestsQuery,
  useTeacherTestItemsQuery,
} from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery } from "../helpers/useSubjectSections";
import { Skeleton } from "../components/Skeleton";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  LoaderCircle,
  Eye,
} from "lucide-react";
import { QuestionsManager } from "../components/QuestionsManager";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";
import styles from "./teacher.create-test.$testId.test-items.$itemId.questions.module.css";

const Page = () => {
  const { testId, itemId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const packageId = Number(testId);
  const currentItemId = Number(itemId);
  const subjectIdParam = searchParams.get("subjectId");
  const selectedSubjectIdFromUrl = subjectIdParam ? Number(subjectIdParam) : null;

  const { data: tests } = useTeacherTestsQuery();
  const { data: testItems, isLoading: isItemsLoading } =
    useTeacherTestItemsQuery(packageId);
  const { data: subjects, isFetching: isSubjectsFetching, isLoading: isSubjectsLoading } =
    useTestItemSubjectsQuery(currentItemId);

  const testPackage = tests?.find((t) => t.id === packageId);
  const examName = testPackage?.examName || "Exam";
  const currentItem = testItems?.find((item) => item.id === currentItemId);

  const selectedSubject =
    subjects?.find((s) => s.id === selectedSubjectIdFromUrl) ?? null;

  // Backward compatibility: if the URL has no subject (or an invalid one),
  // default to the first subject so old links / the bare item route still work.
  useEffect(() => {
    if (!isSubjectsFetching && subjects && subjects.length > 0) {
      const isValidSelection =
        selectedSubjectIdFromUrl !== null &&
        subjects.some((s) => s.id === selectedSubjectIdFromUrl);
      if (!isValidSelection) {
        setSearchParams(
          { subjectId: subjects[0].id.toString() },
          { replace: true }
        );
      }
    }
  }, [isSubjectsFetching, subjects, selectedSubjectIdFromUrl, setSearchParams]);

  const { data: sectionsData } = useSubjectSectionsQuery(
    selectedSubject?.id ?? null
  );
  const downloadPdf = useDownloadTestPdf();

  // Both queries refetch on mount so the counts stay honest; gate the page
  // skeleton on "no data yet" rather than "request in flight", or every visit
  // blanks a page we could already render.
  const isLoading = isItemsLoading || isSubjectsLoading;

  const renderContent = () => {
    if (isLoading) {
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
          <p>
            Add a subject from the test item's Subjects panel before adding
            questions.
          </p>
          <Button asChild>
            <Link to={`/teacher/create-test/${packageId}/test-items`}>
              Go to Test Items
            </Link>
          </Button>
        </div>
      );
    }

    if (!selectedSubject) {
      return <Skeleton style={{ height: "300px" }} />;
    }

    return (
      <div className={styles.mainContent}>
        {currentItem.subjectWiseTiming &&
          selectedSubject.durationMinutes != null && (
            <p className={styles.subjectMeta}>
              {selectedSubject.durationMinutes} min
            </p>
          )}
        {selectedSubject.description && (
          <p className={styles.subjectDescription}>
            {selectedSubject.description}
          </p>
        )}
        <QuestionsManager
          testId={packageId}
          itemId={currentItemId}
          subjectId={selectedSubject.id}
          examName={examName}
          subjectName={selectedSubject.subjectName}
          sections={sectionsData ?? []}
          questionWiseTiming={currentItem.questionWiseTiming}
        />
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>
          {selectedSubject
            ? `${selectedSubject.subjectName} Questions`
            : "Manage Questions"}{" "}
          | Testkart
        </title>
        <meta
          name="description"
          content="Add, edit, or remove questions for a specific subject."
        />
      </Helmet>

      <div className={styles.page}>
        <div className={styles.backRow}>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/teacher/create-test/${packageId}/test-items`}>
              <ChevronLeft size={16} /> Back to Test Items
            </Link>
          </Button>
        </div>

        <header className={styles.header}>
          <div>
            <h1>
              {selectedSubject ? selectedSubject.subjectName : "Manage Questions"}
            </h1>
            <p>{currentItem ? currentItem.title : " "}</p>
          </div>
          {selectedSubject && (
            <div className={styles.navButtons}>
              <Button asChild variant="outline">
                <Link
                  to={`/teacher/create-test/${packageId}/test-items/${currentItemId}/preview?subjectId=${selectedSubject.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye size={16} /> Preview
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadPdf.mutate({
                    testItemId: currentItemId,
                    subjectId: selectedSubject.id,
                    fileNameHint: selectedSubject.subjectName,
                  })
                }
                disabled={downloadPdf.isPending}
              >
                {downloadPdf.isPending ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : (
                  <Download size={16} />
                )}
                Download PDF
              </Button>
            </div>
          )}
        </header>

        <div className={styles.contentWrapper}>{renderContent()}</div>
      </div>
    </>
  );
};

export default Page;
