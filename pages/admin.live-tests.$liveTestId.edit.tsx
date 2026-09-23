import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { LiveTestDetailsEditor } from "../components/LiveTestDetailsEditor";
import { LiveTestQuestionsEditor } from "../components/LiveTestQuestionsEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import styles from "./admin.live-tests.$liveTestId.edit.module.css";

type EditorTab = "details" | "questions";

const Editor = ({ id }: { id: number }) => {
  const exitTo = useAdminContentEdit()?.exitTo ?? "/admin/live-tests";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: EditorTab = searchParams.get("tab") === "questions" ? "questions" : "details";

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className={styles.tabs} aria-label="Live test editor sections">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="questions">Questions</TabsTrigger>
      </TabsList>
      {/* Both panels stay mounted so unsaved details survive a switch to Questions. */}
      <TabsContent value="details" forceMount className={styles.panel}>
        <div className={styles.form}>
          <LiveTestDetailsEditor liveTestId={id} exitTo={exitTo} exitLabel="live tests" />
        </div>
      </TabsContent>
      <TabsContent value="questions" forceMount className={styles.panel}>
        <LiveTestQuestionsEditor liveTestId={id} />
      </TabsContent>
    </Tabs>
  );
};

export default function AdminEditLiveTestPage() {
  const { liveTestId } = useParams<{ liveTestId: string }>();
  const id = Number(liveTestId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;

  return (
    <AdminContentEditShell key={validId ?? "invalid"} type="live_test" id={validId} listHref="/admin/live-tests" listLabel="live tests">
      {validId !== null && <Editor id={validId} />}
    </AdminContentEditShell>
  );
}