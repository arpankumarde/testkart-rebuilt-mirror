import React, { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { ConsoleListToolbar } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { perfStyles as styles, StudentName, ProgressBar, PerformanceFacts } from "./TeacherPerformanceKit";
import type { PerformanceToolbarTabs } from "./TeacherPerformanceStudents";
import { useTeacherPerformanceNote } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import { dateText, downloadCsv, scoreText } from "../helpers/teacherPerformanceFormat";
import type { NoteReadingStatus } from "../endpoints/teacher/performance/note_GET.schema";

type Props = {
  toolbar: PerformanceToolbarTabs;
  productId: number | null;
  onSelect: (productId: number) => void;
  onOpenStudent: (studentId: number) => void;
  enabled: boolean;
};

type StatusFilter = "all" | NoteReadingStatus;

export const NOTE_STATUS: Record<NoteReadingStatus, { label: string; variant: "secondary" | "warning" | "success" }> = {
  not_opened: { label: "Not opened", variant: "secondary" },
  reading: { label: "Reading", variant: "warning" },
  finished: { label: "Finished", variant: "success" },
};

const STATUS_ORDER: readonly StatusFilter[] = ["all", "not_opened", "reading", "finished"];

export const TeacherPerformanceNotes = ({ toolbar, productId, onSelect, onOpenStudent, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceNote(productId, enabled);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const note = data?.note ?? null;

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = { all: 0, not_opened: 0, reading: 0, finished: 0 };
    for (const row of note?.rows ?? []) {
      base.all += 1;
      base[row.status] += 1;
    }
    return base;
  }, [note]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (note?.rows ?? []).filter(
      (row) => (status === "all" || row.status === status) && (!term || row.name.toLowerCase().includes(term))
    );
  }, [note, search, status]);

  const exportCsv = () => {
    if (!note) return;
    downloadCsv(
      `note-reading-${note.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}`,
      rows.map((row) => ({
        Student: row.name,
        "Read (%)": row.progress,
        "Pages read": row.pagesRead,
        "Pages in note": row.pagesTotal,
        Status: NOTE_STATUS[row.status].label,
        "Last opened": dateText(row.lastOpenedAt),
        "Bought on": dateText(row.boughtAt),
      }))
    );
  };

  const toolbarBand = (
    <ConsoleListToolbar
      {...toolbar}
      search={
        note && note.rows.length > 0
          ? { value: search, onChange: setSearch, placeholder: "Find a student", label: "Find a student who bought these notes" }
          : undefined
      }
    >
      <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
        <Download size={16} />
        Export CSV
      </Button>
    </ConsoleListToolbar>
  );

  if (isError && !data) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          tone="error"
          icon={<FileText size={22} />}
          title="Note reading could not be loaded"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        {toolbarBand}
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!note) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          icon={<FileText size={22} />}
          title="No notes bought yet"
          description="Once students buy one of your notes or PDFs, you can see who opened it and how many pages they read here."
        />
      </div>
    );
  }

  const statusOptions = STATUS_ORDER.filter((value) => value === "all" || counts[value] > 0).map((value) => ({
    value,
    label: `${value === "all" ? "All" : NOTE_STATUS[value].label} (${counts[value]})`,
  }));

  return (
    <div className={styles.stack}>
      {toolbarBand}

      <section className={`${styles.panel} ${isFetching ? styles.busy : ""}`} aria-busy={isFetching} aria-label="Note reading">
        <div className={styles.panelHeader}>
          <Select
            value={String(note.id)}
            onValueChange={(value) => {
              setSearch("");
              setStatus("all");
              onSelect(Number(value));
            }}
          >
            <SelectTrigger className={styles.picker} aria-label="Notes or PDF">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.notes.map((n) => (
                <SelectItem key={n.id} value={String(n.id)}>
                  {n.title} ({n.buyers} {n.buyers === 1 ? "buyer" : "buyers"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {note.rows.length > 0 && (
            <SegmentedControl value={status} onValueChange={setStatus} options={statusOptions} aria-label="Reading status" />
          )}
        </div>

        <PerformanceFacts
          flat
          items={[
            { label: "Bought", value: adminFormat.count(note.totals.buyers) },
            { label: "Opened", value: adminFormat.count(note.totals.opened), note: "read at least one page" },
            { label: "Finished", value: adminFormat.count(note.totals.finished), note: "read every page" },
            {
              label: "Average read",
              value: scoreText(note.totals.averageProgress),
              note: note.pages > 0 ? `${adminFormat.count(note.pages)} pages, of those who opened it` : "of those who opened it",
            },
          ]}
        />

        {note.rows.length === 0 ? (
          <p className={styles.empty}>No one has bought these notes yet.</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No student matches these filters.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Pages read</th>
                <th>Status</th>
                <th className={styles.num}>Last opened</th>
                <th className={styles.num}>Bought on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <StudentName name={row.name} avatarUrl={row.avatarUrl} onOpen={() => onOpenStudent(row.studentId)} />
                  </td>
                  <td>
                    {row.pagesTotal > 0 ? (
                      <ProgressBar value={row.progress} caption={`${row.pagesRead} of ${row.pagesTotal} pages`} />
                    ) : row.pagesRead > 0 ? (
                      `${row.pagesRead} pages`
                    ) : (
                      <span className={styles.none}>-</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={NOTE_STATUS[row.status].variant}>{NOTE_STATUS[row.status].label}</Badge>
                  </td>
                  <td className={styles.num}>
                    {row.lastOpenedAt ? (
                      <span title={dateText(row.lastOpenedAt)}>{adminFormat.relativeTime(row.lastOpenedAt)}</span>
                    ) : (
                      <span className={styles.none}>-</span>
                    )}
                  </td>
                  <td className={styles.num}>{dateText(row.boughtAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className={styles.footnote}>
        Pages read counts the pages a student opened in the reader on the website, from 29-09-2026 and for the last 90
        days. Reading in the app is not counted.
      </p>
    </div>
  );
};
