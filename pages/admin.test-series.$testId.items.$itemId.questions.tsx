import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { TestItemQuestionsEditor } from "../components/TestItemQuestionsEditor";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import styles from "./admin.test-series.$testId.items.$itemId.questions.module.css";

const Editor = ({ testId, itemId }: { testId: number; itemId: number }) => {
  const [searchParams] = useSearchParams();
  const subjectId = Number(searchParams.get("subjectId"));
  const { data: testItems } = useTeacherTestItemsQuery(testId);
  const { data: subjects } = useTestItemSubjectsQuery(itemId);
  const item = testItems?.find((i) => i.id === itemId);
  const subject = subjects?.find((s) => s.id === subjectId);
  const itemsHref = `/admin/test-series/${testId}/edit?tab=tests`;

  return (
    <div className={styles.wrap}>
      {item && (
        <div className={styles.heading}>
          <h2 className={styles.title}>{subject ? subject.subjectName : "Questions"}</h2>
          <p className={styles.subtitle}>{item.title}</p>
        </div>
      )}
      <TestItemQuestionsEditor packageId={testId} itemId={itemId} itemsHref={itemsHref} />
    </div>
  );
};

export default function AdminTestItemQuestionsPage() {
  const { testId, itemId } = useParams<{ testId: string; itemId: string }>();
  const id = Number(testId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;
  const item = Number(itemId);
  const validItem = Number.isInteger(item) && item > 0 ? item : null;

  return (
    <AdminContentEditShell
      key={validId ?? "invalid"}
      type="mock_test"
      id={validItem === null ? null : validId}
      listHref={validId ? `/admin/test-series/${validId}/edit?tab=tests` : "/admin/test-series"}
      listLabel="the test series"
    >
      {validId !== null && validItem !== null && <Editor testId={validId} itemId={validItem} />}
    </AdminContentEditShell>
  );
}