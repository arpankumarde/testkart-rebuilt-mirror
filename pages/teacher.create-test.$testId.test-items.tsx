import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from '../components/Button';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { TeacherRejectionBanner } from '../components/TeacherRejectionBanner';
import { AddTestItemsButton, TestSeriesItemsList } from '../components/TestSeriesItemsEditor';
import { useTeacherTestItemsQuery, useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import styles from "./teacher.create-test.$testId.test-items.module.css";

const Page = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const packageId = Number(testId);

  const { data: testItems } = useTeacherTestItemsQuery(packageId);
  const { data: tests } = useTeacherTestsQuery();
  const series = tests?.find((t) => t.id === packageId);

  return (
    <>
      <Helmet>
        <title>Manage Test Items | Testkart</title>
        <meta name="description" content="Add, edit, or remove individual tests within your mock test package." />
      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/test-series"
          backLabel="Test series"
          title="Manage test items"
          subtitle={series?.title ?? "Add or edit the tests in this series. Drag a card to reorder."}
        >
          <Button asChild variant="outline">
            <Link to={`/teacher/create-test/basic-info?testId=${packageId}`}>
              <Pencil size={16} /> Edit details
            </Link>
          </Button>
          <AddTestItemsButton packageId={packageId} />
        </TeacherFormHeader>

        <TeacherRejectionBanner contentType="mock_test" contentId={packageId} />

        <TestSeriesItemsList packageId={packageId} />

        <div className={styles.navigation}>
          <Button onClick={() => navigate(`/teacher/create-test/${packageId}/review`)} disabled={!testItems?.length}>
            Next: Review <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
};

export default Page;