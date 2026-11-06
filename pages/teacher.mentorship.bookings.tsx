import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Calendar, Ban, RotateCcw, CheckCircle2, MoreHorizontal, Settings2 } from "lucide-react";
import {
  useMentorshipBookingsQuery,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
  useCompleteLessonMutation,
} from "../helpers/useTeacherMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/DropdownMenu";
import {
  LiveSessionList,
  LiveSessionNextCard,
  LiveSessionRow,
  LiveSessionSegment,
  LiveSessionStatus,
  LiveSessionTone,
} from "../components/LiveSession";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Input } from "../components/Input";
import styles from "./teacher.mentorship.bookings.module.css";

type FilterValue = "upcoming" | "past" | "cancelled" | "all";

const TIME_ZONE = "Asia/Kolkata";
const TONES: LiveSessionTone[] = ["lavender", "blue", "sage", "butter", "mint"];

const bookingStatus = (status: string): LiveSessionStatus | null => {
  if (status === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (status === "completed") return { label: "Completed", tone: "sage" };
  if (status === "no_show") return { label: "No-show", tone: "butter" };
  return null;
};

const TeacherMentorshipBookingsPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterValue>("upcoming");
  const { data, isFetching } = useMentorshipBookingsQuery(filter);
  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);
  const completeMutation = useCompleteLessonMutation();

  const bookings = data?.bookings ?? [];
  const [first, ...rest] = bookings;
  const showNext = filter === "upcoming" && !!first && first.status === "scheduled";
  const listed = showNext ? rest : bookings;

  const menu = (b: MentorshipBookingRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-md" aria-label={`More options for the session with ${b.studentName}`}>
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setRescheduleTarget(b)}>
          <RotateCcw size={14} /> Reschedule
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={completeMutation.isPending}
          onSelect={() =>
            completeMutation.mutate(
              { kind: "booking", id: b.id },
              { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status.") }
            )
          }
        >
          <CheckCircle2 size={14} /> Mark completed
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setCancelTarget(b)}>
          <Ban size={14} /> Cancel session
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <Helmet>
        <title>1:1 Bookings - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader title="1:1 bookings" description="Sessions learners have booked with you. Times are in IST.">
          <Button variant="outline" asChild>
            <Link to="/teacher/mentorship">
              <Settings2 size={16} aria-hidden="true" /> Rate and hours
            </Link>
          </Button>
        </ConsolePageHeader>

        <LiveSessionSegment<FilterValue>
          label="Show"
          variant="pills"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "cancelled", label: "Cancelled" },
            { value: "all", label: "All" },
          ]}
        />

        {isFetching && !data ? (
          <div className={styles.list}>
            <Skeleton style={{ height: "6.5rem", width: "100%", borderRadius: "1.5rem" }} />
            <Skeleton style={{ height: "5rem", width: "100%", borderRadius: "1.25rem" }} />
          </div>
        ) : bookings.length === 0 ? (
          <ConsoleListEmpty
            icon={<Calendar size={28} />}
            title={filter === "upcoming" ? "No sessions booked yet" : `No ${filter !== "all" ? filter : ""} bookings`}
            description={
              filter === "upcoming" ? "Learners book from your profile once 1:1 sessions are on and you have open hours." : undefined
            }
          />
        ) : (
          <>
            {showNext && (
              <LiveSessionNextCard
                startTime={first.scheduledAt}
                durationMinutes={first.durationMinutes}
                title={`${first.sessionTitle}${first.isTrial ? " (trial)" : ""}`}
                subtitle={`with ${first.studentName}`}
                timeZone={TIME_ZONE}
                actions={
                  <>
                    <Button asChild>
                      <Link to={`/mentorship/classroom/booking/${first.id}`}>
                        <Video size={16} aria-hidden="true" /> Open classroom
                      </Link>
                    </Button>
                    {menu(first)}
                  </>
                }
              />
            )}
            {listed.length > 0 && (
              <LiveSessionList title={showNext ? "Later" : undefined}>
                {listed.map((b, i) => (
                  <LiveSessionRow
                    key={b.id}
                    startTime={b.scheduledAt}
                    durationMinutes={b.durationMinutes}
                    title={`${b.sessionTitle}${b.isTrial ? " (trial)" : ""}`}
                    subtitle={`with ${b.studentName}`}
                    tone={TONES[i % TONES.length]}
                    status={bookingStatus(b.status)}
                    note={b.cancellationReason}
                    timeZone={TIME_ZONE}
                    actions={
                      b.status === "scheduled" ? (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/mentorship/classroom/booking/${b.id}`}>
                              <Video size={14} aria-hidden="true" /> Classroom
                            </Link>
                          </Button>
                          {menu(b)}
                        </>
                      ) : undefined
                    }
                  />
                ))}
              </LiveSessionList>
            )}
          </>
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
