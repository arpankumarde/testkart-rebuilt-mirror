import React, { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { useAdminLiveIssuesQuery, useAdminResolveLiveIssueMutation } from "../helpers/useLivePackages";
import { formatRupees } from "../helpers/livePricing";
import type { LiveIssueRow } from "../endpoints/admin/live-lessons/issues_GET.schema";
import styles from "./AdminLiveIssues.module.css";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(d));

/** Students' "teacher did not come" reports on paid 1:1 classes, for an admin to settle. */
export const AdminLiveIssues: React.FC = () => {
  const { data } = useAdminLiveIssuesQuery({ status: "open" });
  const resolve = useAdminResolveLiveIssueMutation();
  const [target, setTarget] = useState<{ row: LiveIssueRow; resolution: "refunded" | "rejected" } | null>(null);
  const issues = data?.issues ?? [];

  return (
    <section className={styles.card} aria-labelledby="live-issues-title">
      <h2 id="live-issues-title" className={styles.title}>
        <Flag size={16} aria-hidden="true" /> Reports: teacher did not come
        <span className={styles.count}>{issues.length}</span>
      </h2>
      {issues.length === 0 ? (
        <p className={styles.empty}>No open reports.</p>
      ) : (
        <ul className={styles.list}>
          {issues.map((r) => (
            <li key={r.bookingId} className={styles.row}>
              <div className={styles.main}>
                <span className={styles.strong}>
                  {r.studentName} with {r.teacherName}
                </span>
                <span className={styles.meta}>
                  {when(r.scheduledAt)}, {r.durationMinutes} min {r.kind === "trial" ? "trial" : "package class"}, {formatRupees(r.amount)}
                </span>
                {r.note && <span className={styles.note}>"{r.note}"</span>}
              </div>
              <div className={styles.flags}>
                <span className={r.teacherJoined ? styles.yes : styles.no}>Teacher {r.teacherJoined ? "joined" : "never joined"}</span>
                <span className={r.studentJoined ? styles.yes : styles.no}>Student {r.studentJoined ? "joined" : "never joined"}</span>
              </div>
              <div className={styles.actions}>
                <Button size="sm" onClick={() => setTarget({ row: r, resolution: "refunded" })}>
                  Give class back
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget({ row: r, resolution: "rejected" })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConsoleConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.resolution === "refunded" ? "Give the class back to the student?" : "Reject this report?"}
        description={
          target?.resolution === "refunded"
            ? "The teacher is not paid for it. A package class goes back into the package; a trial's price goes to the student's live class balance. The student is emailed."
            : "The class stands and the teacher is paid for it."
        }
        tone={target?.resolution === "refunded" ? "default" : "destructive"}
        confirmLabel={target?.resolution === "refunded" ? "Give class back" : "Reject"}
        pendingLabel="Saving..."
        isPending={resolve.isPending}
        onConfirm={() => {
          if (!target) return;
          resolve.mutate(
            { bookingId: target.row.bookingId, resolution: target.resolution },
            {
              onSuccess: () => {
                toast.success("Report settled.");
                setTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not settle the report."),
            }
          );
        }}
      />
    </section>
  );
};
