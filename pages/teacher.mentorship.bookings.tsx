import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Calendar, Ban, RotateCcw, CheckCircle2 } from "lucide-react";
import {
  useMentorshipBookingsQuery,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
  useCompleteLessonMutation,
} from "../helpers/useTeacherMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/Tabs";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Input } from "../components/Input";
import styles from "./teacher.mentorship.bookings.module.css";

type FilterValue = "upcoming" | "past" | "cancelled" | "all";

const formatDateTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(date));

const statusVariant = (status: string): "success" | "secondary" | "destructive" | "outline" => {
  if (status === "scheduled") return "success";
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  return "outline";
};

const TeacherMentorshipBookingsPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterValue>("upcoming");
  const { data, isFetching } = useMentorshipBookingsQuery(filter);
  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);
  const completeMutation = useCompleteLessonMutation();

  return (
    <>
      <Helmet>
        <title>1:1 Bookings - Testkart</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="1:1 bookings" description="Sessions learners have booked with you." />

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isFetching && !data ? (
          <div className={styles.list}>
            <Skeleton style={{ height: "4.5rem", width: "100%" }} />
            <Skeleton style={{ height: "4.5rem", width: "100%" }} />
          </div>
        ) : !data || data.bookings.length === 0 ? (
          <p className={styles.emptyState}>No {filter !== "all" ? filter : ""} bookings.</p>
        ) : (
          <div className={styles.list}>
            {data.bookings.map((b) => (
              <div key={b.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowTitle}>{b.sessionTitle} with {b.studentName}</span>
                  <span className={styles.rowMeta}>
                    <Calendar size={13} /> {formatDateTime(b.scheduledAt)} &middot; {b.durationMinutes} min
                  </span>
                  {b.cancellationReason && <span className={styles.rowReason}>{b.cancellationReason}</span>}
                </div>
                <div className={styles.rowActions}>
                  <Badge variant={statusVariant(b.status)}>{b.status.replace("_", " ")}</Badge>
                  {b.status === "scheduled" && (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/mentorship/classroom/booking/${b.id}`}>
                          <Video size={14} /> Classroom
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-md" onClick={() => setRescheduleTarget(b)} aria-label="Reschedule">
                        <RotateCcw size={16} />
                      </Button>
                      <Button variant="ghost" size="icon-md" onClick={() => setCancelTarget(b)} aria-label="Cancel">
                        <Ban size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-md"
                        aria-label="Mark completed"
                        disabled={completeMutation.isPending}
                        onClick={() =>
                          completeMutation.mutate(
                            { kind: "booking", id: b.id },
                            { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status.") }
                          )
                        }
                      >
                        <CheckCircle2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CancelDialog booking={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RescheduleDialog booking={rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)} />
    </>
  );
};

export default TeacherMentorshipBookingsPage;

const CancelDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) => {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelBookingMutation();

  return (
    <ConsoleConfirmDialog
      open={!!booking}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
      title={`Cancel session with ${booking?.studentName ?? ""}?`}
      description="The learner is notified by email. Refund/credit, if any, follows the existing order rules for this booking's payment."
      tone="destructive"
      confirmLabel="Cancel session"
      pendingLabel="Cancelling..."
      isPending={cancelMutation.isPending}
      note={{ label: "Reason", value: reason, onChange: setReason, required: true, placeholder: "e.g. unavailable, illness..." }}
      onConfirm={() => {
        if (!booking) return;
        cancelMutation.mutate(
          { bookingId: booking.id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success("Session cancelled.");
              setReason("");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this session."),
          }
        );
      }}
    />
  );
};

const RescheduleDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) => {
  const [newTime, setNewTime] = useState("");
  const rescheduleMutation = useRescheduleBookingMutation();

  return (
    <Dialog open={!!booking} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="sm">
        <ConsoleDialogHeader
          title={`Reschedule session with ${booking?.studentName ?? ""}`}
          description="Pick a new time within your available hours. Both of you get an email with the new time."
        />
        <ConsoleDialogBody>
          <Input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={rescheduleMutation.isPending || !newTime}
            onClick={() => {
              if (!booking || !newTime) return;
              rescheduleMutation.mutate(
                { bookingId: booking.id, newStartTime: new Date(newTime) },
                {
                  onSuccess: () => {
                    toast.success("Session rescheduled.");
                    setNewTime("");
                    onOpenChange(false);
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reschedule this session."),
                }
              );
            }}
          >
            {rescheduleMutation.isPending ? "Saving..." : "Reschedule"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};
