import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Calendar, Ban, RotateCcw, Users } from "lucide-react";
import {
  useMentorshipBookingsListQuery,
  useMentorshipBookingCancelMutation,
  useMentorshipBookingRescheduleMutation,
  useMentorshipMyGroupLessonEnrollmentsQuery,
  useMentorshipGroupLessonUnenrollMutation,
} from "../helpers/useMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/Tabs";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Input } from "../components/Input";
import styles from "./student.live-teaching.module.css";

type FilterValue = "upcoming" | "past" | "cancelled" | "all";
type SubTab = "bookings" | "group";

const formatDateTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

const bookingStatusVariant = (status: string): "success" | "secondary" | "destructive" | "outline" => {
  if (status === "scheduled") return "success";
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  return "outline";
};

const enrollmentStatusVariant = (status: string): "success" | "secondary" | "destructive" | "outline" => {
  if (status === "enrolled") return "success";
  if (status === "cancelled" || status === "removed") return "destructive";
  return "outline";
};

const StudentLiveTeachingPage: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>("bookings");
  const [filter, setFilter] = useState<FilterValue>("upcoming");

  const bookingsQuery = useMentorshipBookingsListQuery({ filter });
  const enrollmentsQuery = useMentorshipMyGroupLessonEnrollmentsQuery({ filter });

  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);
  const unenrollMutation = useMentorshipGroupLessonUnenrollMutation();

  return (
    <>
      <Helmet>
        <title>Live Teaching - Testkart</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live teaching" description="Your 1:1 sessions and group lessons." />

        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
          <TabsList>
            <TabsTrigger value="bookings">1:1 sessions</TabsTrigger>
            <TabsTrigger value="group">Group lessons</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {subTab === "bookings" ? (
          bookingsQuery.isFetching && !bookingsQuery.data ? (
            <div className={styles.list}>
              <Skeleton style={{ height: "4.5rem", width: "100%" }} />
              <Skeleton style={{ height: "4.5rem", width: "100%" }} />
            </div>
          ) : !bookingsQuery.data || bookingsQuery.data.bookings.length === 0 ? (
            <ConsoleListEmpty
              icon={<Calendar size={28} />}
              title="No sessions here"
              description="Book a 1:1 session from any educator's profile to see it here."
            />
          ) : (
            <div className={styles.list}>
              {bookingsQuery.data.bookings.map((b) => (
                <div key={b.id} className={styles.row}>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowTitle}>
                      {b.sessionTitle} with {b.teacherName}
                    </span>
                    <span className={styles.rowMeta}>
                      <Calendar size={13} aria-hidden="true" /> {formatDateTime(b.scheduledAt)} &middot; {b.durationMinutes} min
                    </span>
                    {b.cancellationReason && <span className={styles.rowReason}>{b.cancellationReason}</span>}
                  </div>
                  <div className={styles.rowActions}>
                    <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace("_", " ")}</Badge>
                    {b.status === "scheduled" && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/mentorship/classroom/booking/${b.id}`}>
                            <Video size={14} aria-hidden="true" /> Classroom
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-md" onClick={() => setRescheduleTarget(b)} aria-label="Reschedule">
                          <RotateCcw size={16} aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon-md" onClick={() => setCancelTarget(b)} aria-label="Cancel">
                          <Ban size={16} aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : enrollmentsQuery.isFetching && !enrollmentsQuery.data ? (
          <div className={styles.list}>
            <Skeleton style={{ height: "4.5rem", width: "100%" }} />
            <Skeleton style={{ height: "4.5rem", width: "100%" }} />
          </div>
        ) : !enrollmentsQuery.data || enrollmentsQuery.data.enrollments.length === 0 ? (
          <ConsoleListEmpty
            icon={<Users size={28} />}
            title="No group lessons here"
            description="Enroll in an open group lesson from the Live Teaching page to see it here."
          />
        ) : (
          <div className={styles.list}>
            {enrollmentsQuery.data.enrollments.map((e) => {
              const canUnenroll = e.status === "enrolled" && e.lessonStatus === "scheduled" && new Date(e.startTime) > new Date();
              return (
                <div key={e.enrollmentId} className={styles.row}>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowTitle}>
                      {e.title} with {e.teacherName}
                    </span>
                    <span className={styles.rowMeta}>
                      <Calendar size={13} aria-hidden="true" /> {formatDateTime(e.startTime)} &middot; {e.durationMinutes} min
                    </span>
                    {e.removedByTeacher && <span className={styles.rowReason}>Removed by the teacher.</span>}
                  </div>
                  <div className={styles.rowActions}>
                    <Badge variant={enrollmentStatusVariant(e.status)}>{e.status.replace("_", " ")}</Badge>
                    {e.status === "enrolled" && e.lessonStatus === "scheduled" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/mentorship/classroom/group/${e.groupLessonId}`}>
                          <Video size={14} aria-hidden="true" /> Classroom
                        </Link>
                      </Button>
                    )}
                    {canUnenroll && (
                      <Button
                        variant="ghost"
                        size="icon-md"
                        aria-label="Cancel enrollment"
                        disabled={unenrollMutation.isPending}
                        onClick={() =>
                          unenrollMutation.mutate(
                            { groupLessonId: e.groupLessonId },
                            {
                              onSuccess: () => toast.success("Enrollment cancelled."),
                              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel enrollment."),
                            }
                          )
                        }
                      >
                        <Ban size={16} aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CancelBookingDialog booking={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RescheduleBookingDialog booking={rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)} />
    </>
  );
};

export default StudentLiveTeachingPage;

const CancelBookingDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) => {
  const [reason, setReason] = useState("");
  const cancelMutation = useMentorshipBookingCancelMutation();

  return (
    <ConsoleConfirmDialog
      open={!!booking}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
      title={`Cancel session with ${booking?.teacherName ?? ""}?`}
      description="The teacher is notified by email. Refund/credit, if any, follows our standard cancellation policy for this booking's payment."
      tone="destructive"
      confirmLabel="Cancel session"
      pendingLabel="Cancelling..."
      isPending={cancelMutation.isPending}
      note={{ label: "Reason", value: reason, onChange: setReason, required: true, placeholder: "e.g. schedule conflict, no longer needed..." }}
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

const RescheduleBookingDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) => {
  const [newTime, setNewTime] = useState("");
  const rescheduleMutation = useMentorshipBookingRescheduleMutation();

  return (
    <Dialog open={!!booking} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="sm">
        <ConsoleDialogHeader
          title={`Reschedule session with ${booking?.teacherName ?? ""}`}
          description="Pick a new time. Both of you get an email with the new time, and it's re-checked against the teacher's availability."
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
