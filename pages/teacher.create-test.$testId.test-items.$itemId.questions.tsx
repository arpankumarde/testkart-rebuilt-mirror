import React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "../components/Button";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { ChevronLeft, Download, LoaderCircle, Eye } from "lucide-react";
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
  const selectedSubject = subjects?.find((s) => s.id === selectedSubjectIdFromUrl) ?? null;
  const downloadPdf = useDownloadTestPdf();
  const itemsHref = `/teacher/create-test/${packageId}/test-items`;

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
            <Link to={itemsHref}>
              <ChevronLeft size={16} /> Back to Test Items
            </Link>
          </Button>
        </div>

        <header className={styles.header}>
          <div>
            <h1>
              {selectedSubject ? selectedSubject.subjectName : "Manage Questions"}
            </h1>
            <p>{currentItem ? currentItem.title : " "}</p>
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

        <div className={styles.contentWrapper}>
          <TestItemQuestionsEditor packageId={packageId} itemId={currentItemId} itemsHref={itemsHref} />
        </div>
      </div>
    </>
  );
};

export default Page;