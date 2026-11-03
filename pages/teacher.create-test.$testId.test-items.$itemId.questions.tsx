import React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "../components/Button";
import { TestSeriesSteps } from "../components/TestSeriesSteps";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { ChevronRight, Download, LoaderCircle, Eye } from "lucide-react";
import { TestItemQuestionsEditor } from "../components/TestItemQuestionsEditor";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";
import styles from "./teacher.create-test.$testId.test-items.$itemId.questions.module.css";

const Page = () => {
  const { testId, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const packageId = Number(testId);
  const currentItemId = Number(itemId);
  const subjectIdParam = searchParams.get("subjectId");
  const selectedSubjectIdFromUrl = subjectIdParam ? Number(subjectIdParam) : null;

  const { data: testItems } = useTeacherTestItemsQuery(packageId);
  const { data: subjects } = useTestItemSubjectsQuery(currentItemId);

  const currentItem = testItems?.find((item) => item.id === currentItemId);
  const currentIndex = testItems?.findIndex((item) => item.id === currentItemId) ?? -1;
  const nextItem = currentIndex >= 0 ? testItems?.[currentIndex + 1] : undefined;
  const selectedSubject = subjects?.find((s) => s.id === selectedSubjectIdFromUrl) ?? null;
  const hasManySubjects = (subjects?.length ?? 0) > 1;
  const downloadPdf = useDownloadTestPdf();
  const itemsHref = `/teacher/create-test/${packageId}/test-items`;
  const reviewHref = `/teacher/create-test/${packageId}/review`;
  const questionsHref = (itemId: number, subjectId?: number) =>
    `/teacher/create-test/${packageId}/test-items/${itemId}/questions${subjectId ? `?subjectId=${subjectId}` : ""}`;

  return (
    <>
      <Helmet>
        <title>{`${currentItem ? `${currentItem.title} questions` : "Questions"} | Testkart`}</title>
        <meta
          name="description"
          content="Add, edit, or remove questions for a specific subject."
        />
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
        <TestSeriesSteps current="questions" packageId={packageId} back={itemsHref} />

        <header className={styles.header}>
          <div>
            <h1>{currentItem ? currentItem.title : "Questions"}</h1>
            <p>
              {testItems && currentIndex >= 0
                ? `Test ${currentIndex + 1} of ${testItems.length}${selectedSubject && hasManySubjects ? ` - ${selectedSubject.subjectName}` : ""}`
                : " "}
            </p>
          </div>
          <div className={styles.navButtons}>
            {selectedSubject && (
              <>
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
              </>
            )}
            <Button asChild variant="outline">
              {nextItem ? (
                <Link to={questionsHref(nextItem.id)}>
                  Next test: {nextItem.title} <ChevronRight size={16} />
                </Link>
              ) : (
                <Link to={reviewHref}>
                  Review and publish <ChevronRight size={16} />
                </Link>
              )}
            </Button>
          </div>
        </header>

        {hasManySubjects && subjects && (
          <nav className={styles.subjectTabs} aria-label="Subjects in this test">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                to={questionsHref(currentItemId, subject.id)}
                replace
                className={styles.subjectTab}
                aria-current={subject.id === selectedSubject?.id ? "page" : undefined}
              >
                {subject.subjectName}
                <span className={styles.subjectTabCount}>{subject.actualQuestionCount}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className={styles.contentWrapper}>
          <TestItemQuestionsEditor packageId={packageId} itemId={currentItemId} itemsHref={itemsHref} />
        </div>
      </div>
    </>
  );
};

export default Page;