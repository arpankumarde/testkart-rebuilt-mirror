import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { useAdminGecMeta, usePublishGec } from "../helpers/useAdminGovtExamsCalendar";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { gecLongDay } from "../helpers/gecView";
import styles from "./GecPublishDialog.module.css";

interface GecPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs first, e.g. to save the block being edited, and can stop the publish by throwing. */
  beforePublish?: () => Promise<void>;
}

/** Freezes the current draft into a new publication. The public page reads only publications. */
export const GecPublishDialog: React.FC<GecPublishDialogProps> = ({ open, onOpenChange, beforePublish }) => {
  const { data: meta } = useAdminGecMeta();
  const publish = usePublishGec();
  const [addToLog, setAddToLog] = useState(true);
  const [publicText, setPublicText] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = meta?.pendingSummary ?? [];
  const sections = [...new Set(pending.map((entry) => entry.section).filter((section) => section !== "Verification"))];

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSummary("");
    setPublicText(sections.length ? `Updated ${sections.slice(0, 4).join(", ").toLowerCase()}.` : "Checked all dates against official sources.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meta?.pendingChanges]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await beforePublish?.();
      await publish.mutateAsync({ summary, addToPublicLog: addToLog, publicText });
      onOpenChange(false);
    } catch (err) {
      setError(parseErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <form onSubmit={submit}>
          <ConsoleDialogHeader
            icon={<Send size={18} />}
            title="Publish changes"
            description={`The public page switches to the saved draft and shows Last updated: ${meta ? gecLongDay(meta.today) : "today"}.`}
          />
          <ConsoleDialogBody className={styles.body}>
            <div className={styles.pending}>
              <p className={styles.pendingTitle}>
                {meta?.pendingChanges
                  ? `${meta.pendingChanges} change${meta.pendingChanges === 1 ? "" : "s"} since the last publish`
                  : "No saved changes since the last publish. Publishing again records that the page was checked today."}
              </p>
              {pending.length > 0 && (
                <ul className={styles.pendingList}>
                  {pending.slice(0, 8).map((entry, index) => (
                    <li key={index}>
                      <span className={styles.pendingSection}>{entry.section}</span> {entry.summary}
                    </li>
                  ))}
                  {pending.length > 8 && <li className={styles.more}>and {pending.length - 8} more</li>}
                </ul>
              )}
            </div>

            <label className={styles.check}>
              <Checkbox checked={addToLog} onChange={(e) => setAddToLog(e.target.checked)} />
              <span>Add a line to the public update log</span>
            </label>
            {addToLog && (
              <div className={styles.field}>
                <label htmlFor="gec-publish-log" className={styles.label}>
                  Update log line (shown on the page, newest first)
                </label>
                <Textarea id="gec-publish-log" rows={2} value={publicText} maxLength={600} onChange={(e) => setPublicText(e.target.value)} />
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="gec-publish-note" className={styles.label}>
                Internal note (optional)
              </label>
              <Textarea id="gec-publish-note" rows={2} value={summary} maxLength={1000} onChange={(e) => setSummary(e.target.value)} />
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publish.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={publish.isPending || (addToLog && !publicText.trim())}>
              <Send size={16} /> {publish.isPending ? "Publishing..." : "Publish now"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};