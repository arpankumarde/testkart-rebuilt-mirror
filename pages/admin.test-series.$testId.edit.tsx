import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { TestSeriesDetailsEditor } from "../components/TestSeriesDetailsEditor";
import { AddTestItemsButton, TestSeriesItemsList } from "../components/TestSeriesItemsEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import styles from "./admin.test-series.$testId.edit.module.css";

type EditorTab = "details" | "tests";

const Editor = ({ id }: { id: number }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: EditorTab = searchParams.get("tab") === "tests" ? "tests" : "details";

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className={styles.tabs} aria-label="Test series editor sections">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="tests">Tests</TabsTrigger>
      </TabsList>
      {/* Both panels stay mounted so unsaved details survive a switch to Tests. */}
      <TabsContent value="details" forceMount className={styles.panel}>
        <TestSeriesDetailsEditor testId={id} />
      </TabsContent>
      <TabsContent value="tests" forceMount className={styles.panel}>
        <div className={styles.testsToolbar}>
          <p className={styles.testsHint}>Drag a card to reorder. Open Subjects on a test to edit its questions.</p>
          <AddTestItemsButton packageId={id} />
        </div>
        <TestSeriesItemsList packageId={id} />
      </TabsContent>
    </Tabs>
  );
};

export default function AdminEditTestSeriesPage() {
  const { testId } = useParams<{ testId: string }>();
  const id = Number(testId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;

  return (
    <AdminContentEditShell key={validId ?? "invalid"} type="mock_test" id={validId} listHref="/admin/test-series" listLabel="test series">
      {validId !== null && <Editor id={validId} />}
    </AdminContentEditShell>
  );
}