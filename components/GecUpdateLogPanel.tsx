import React, { useState } from "react";
import { Globe, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { useAddGecLogNote, useAdminGecLog, useDeleteGecLogNote } from "../helpers/useAdminGovtExamsCalendar";
import { gecDay } from "../helpers/gecView";
import { adminFormat } from "../helpers/adminFormat";
import { todayInIndia } from "../helpers/govtExamsCalendarFilter";
import styles from "./GecUpdateLogPanel.module.css";

const KIND_LABEL = { auto: "Edit", manual: "Note", publish: "Published" } as const;

/**
 * Every change is logged automatically. Public lines (publish notes and public manual notes) show on the
 * page's update log, newest first, once published.
 */
export const GecUpdateLogPanel: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useAdminGecLog({ page, limit: 15 });
  const add = useAddGecLogNote();
  const remove = useDeleteGecLogNote();
  const [summary, setSummary] = useState("");
  const [logDate, setLogDate] = useState(todayInIndia());
  const [isPublic, setIsPublic] = useState(true);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) return;
    add.mutate(
      { summary: summary.trim(), section: "Page", isPublic, logDate },
      {
        onSuccess: () => {
          setSummary("");
          setPage(1);
        },
      }
    );
  };

  return (
    <div className={styles.panel}>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formRow}>
          <label htmlFor="gec-log-text" className={styles.label}>
            Add a manual update note
          </label>
          <Input id="gec-log-text" value={summary} maxLength={600} placeholder="e.g. RRB NTPC last date extended to 20 November 2026." onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className={styles.formControls}>
          <Input type="date" aria-label="Note date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className={styles.date} />
          <label className={styles.check}>
            <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Show on the public page
          </label>
          <Button type="submit" size="sm" disabled={!summary.trim() || add.isPending}>
            <Plus size={15} /> Add note
          </Button>
        </div>
      </form>

      <ol className={styles.list} aria-busy={isFetching}>
        {(data?.rows ?? []).map((entry) => (
          <li key={entry.id} className={styles.entry}>
            <span className={`${styles.kind} ${styles[`kind_${entry.kind}`]}`}>{KIND_LABEL[entry.kind]}</span>
            <div className={styles.entryBody}>
              <p className={styles.summary}>{entry.summary}</p>
              <p className={styles.meta}>
                {entry.section} - {gecDay(entry.logDate)} - {entry.adminName ?? "System"} - {adminFormat.relativeTime(entry.createdAt)}
              </p>
            </div>
            <span className={styles.visibility} title={entry.isPublic ? "Shown in the public update log" : "Admin only"}>
              {entry.isPublic ? <Globe size={14} aria-label="Public" /> : <Lock size={14} aria-label="Admin only" />}
            </span>
            {entry.kind === "manual" && (
              <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}>
                <Trash2 size={14} />
              </Button>
            )}
          </li>
        ))}
        {data && data.rows.length === 0 && <li className={styles.empty}>Nothing logged yet.</li>}
      </ol>
      {data && data.totalPages > 1 && <ConsoleListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
};