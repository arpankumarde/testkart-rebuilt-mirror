import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useAdminLiveLessonsQuery, useAdminCancelLiveLessonMutation } from "../helpers/useAdminLiveLessons";
import { AdminLiveLessonRow } from "../endpoints/admin/live-lessons/list_GET.schema";
import {
  JOIN_WINDOW_MINUTES_BEFORE,
  JOIN_WINDOW_MINUTES_AFTER,
  FREE_CANCELLATION_CUTOFF_HOURS,
  BOOKING_MIN_NOTICE_MINUTES,
  GROUP_LESSON_MIN_CAPACITY,
  GROUP_LESSON_MAX_CAPACITY,
  MENTORSHIP_SESSION_DURATIONS,
  VIDEO_PROVIDER_MODE,
} from "../helpers/liveLessonConfig";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Textarea } from "../components/Textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "../components/Select";
import { Users, Video, Ban, Info } from "lucide-react";
import tableStyles from "../components/AdminSubscriptionPlansManager.module.css";
import styles from "./admin.live-lessons.module.css";

const formatDateTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(date));

const statusVariant = (status: string): "success" | "secondary" | "destructive" | "outline" => {
  if (status === "scheduled") return "success";
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "no_show") return "outline";
  return "secondary";
};

type FilterValue = "upcoming" | "past" | "cancelled" | "all";

const AdminLiveLessonsPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterValue>("upcoming");
  const { data, isFetching } = useAdminLiveLessonsQuery(filter);
  const [cancelTarget, setCancelTarget] = useState<AdminLiveLessonRow | null>(null);

  return (
    <>
      <Helmet>
        <title>Live Lessons - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live Lessons" />

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <Info size={16} />
            <span>Policy defaults in effect (code-level, not editable here)</span>
          </div>
          <div className={styles.infoGrid}>
            <div><span className={styles.infoLabel}>Join window</span><span>{JOIN_WINDOW_MINUTES_BEFORE} min before to {JOIN_WINDOW_MINUTES_AFTER} min after start</span></div>
            <div><span className={styles.infoLabel}>Min. booking notice</span><span>{BOOKING_MIN_NOTICE_MINUTES} min</span></div>
            <div><span className={styles.infoLabel}>Free cancellation until</span><span>{FREE_CANCELLATION_CUTOFF_HOURS}h before start</span></div>
            <div><span className={styles.infoLabel}>1:1 durations</span><span>{MENTORSHIP_SESSION_DURATIONS.join(" / ")} min</span></div>
            <div><span className={styles.infoLabel}>Group capacity</span><span>{GROUP_LESSON_MIN_CAPACITY}-{GROUP_LESSON_MAX_CAPACITY} learners</span></div>
            <div>
              <span className={styles.infoLabel}>Video provider</span>
              <span className={styles.mockBadgeWrap}>
                <Badge variant="outline" className={tableStyles.flag}>
                  <Video size={12} /> {VIDEO_PROVIDER_MODE === "mock" ? "Development mock — not live video" : "Live"}
                </Badge>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.filterRow}>
          <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className={tableStyles.results}>
          {isFetching && !data ? (
            <div className={tableStyles.tableContainer} style={{ display: "block" }}>
              <table className={tableStyles.table}>
                <tbody>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ height: "0.875rem", width: "70%" }} /></td>
                      <td><Skeleton style={{ height: "0.875rem", width: "50%" }} /></td>
                      <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
                      <td><Skeleton style={{ height: "1.5rem", width: "5rem", marginLeft: "auto" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !data || data.rows.length === 0 ? (
            <p className={tableStyles.emptyState}>
              No {filter !== "all" ? filter : ""} live lessons yet. Bookings and group lessons created by teachers and
              learners will show up here for moderation.
            </p>
          ) : (
            <div className={tableStyles.tableContainer} style={{ display: "block" }}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Teacher</th>
                    <th>Starts</th>
                    <th>Status</th>
                    <th>Seats / Price</th>
                    <th><span className={tableStyles.srOnly}>Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td>
                        <div className={tableStyles.stack}>
                          <span className={tableStyles.primaryLine}>
                            {r.kind === "group" ? <Users size={14} /> : <Video size={14} />}
                            <span className={tableStyles.truncate} title={r.title}>{r.title}</span>
                          </span>
                          <span className={tableStyles.secondaryLine}>
                            {r.kind === "group" ? "Group lesson" : "1:1 booking"} · {r.durationMinutes} min
                          </span>
                        </div>
                      </td>
                      <td><span className={tableStyles.valueLine}>{r.teacherName ?? "—"}</span></td>
                      <td><span className={tableStyles.valueLine}>{formatDateTime(r.startTime)}</span></td>
                      <td>
                        <Badge variant={statusVariant(r.status)} className={tableStyles.flag}>
                          {r.status.replace("_", " ")}
                        </Badge>
                        {r.cancellationReason && (
                          <div className={tableStyles.secondaryLine} title={r.cancellationReason}>
                            {r.cancellationReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={tableStyles.valueLine}>
                          {r.kind === "group" ? `${r.enrolledCount ?? 0} / ${r.maxCapacity ?? "—"}` : "1 learner"}
                        </span>
                        <span className={tableStyles.secondaryLine}>₹{r.price.toLocaleString("en-IN")}</span>
                      </td>
                      <td>
                        <div className={tableStyles.rowActions}>
                          {r.status !== "cancelled" && r.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="icon-md"
                              className={tableStyles.iconButton}
                              aria-label={`Cancel ${r.title}`}
                              onClick={() => setCancelTarget(r)}
                            >
                              <Ban />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CancelDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} row={cancelTarget} />
    </>
  );
};

export default AdminLiveLessonsPage;

const CancelDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminLiveLessonRow | null;
}> = ({ open, onOpenChange, row }) => {
  const [reason, setReason] = useState("");
  const cancelMutation = useAdminCancelLiveLessonMutation();

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleCancel = () => {
    if (!row) return;
    if (reason.trim().length < 3) {
      toast.error("Give a short reason for the cancellation.");
      return;
    }
    cancelMutation.mutate(
      { kind: row.kind, id: row.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Cancelled. Affected people are not yet auto-notified — this records the decision for now.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this session."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title={`Cancel "${row?.title ?? ""}"`}
          description="This immediately marks the session cancelled. Refund/credit handling follows the existing order and wallet rules for its payment, if any."
        />
        <ConsoleDialogBody>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Reported policy violation, teacher unreachable, duplicate booking..."
          />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" variant="destructive" disabled={cancelMutation.isPending} onClick={handleCancel}>
            {cancelMutation.isPending ? "Cancelling..." : "Cancel session"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};
