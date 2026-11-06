import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Calendar, Ban, RotateCcw, Users, MoreHorizontal, Search } from "lucide-react";
import {
  useMentorshipBookingsListQuery,
  useMentorshipBookingCancelMutation,
  useMentorshipBookingRescheduleMutation,
  useMentorshipMyGroupLessonEnrollmentsQuery,
  useMentorshipGroupLessonUnenrollMutation,
} from "../helpers/useMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import { MyGroupLessonEnrollmentRow } from "../endpoints/mentorship/group-lessons/my-enrollments_GET.schema";
import { GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/DropdownMenu";
import { Input } from "../components/Input";
import {
  LiveSessionList,
  LiveSessionNextCard,
  LiveSessionRow,
  LiveSessionSegment,
  LiveSessionStatus,
  LiveSessionTone,
} from "../components/LiveSession";
import styles from "./student.live-teaching.module.css";

type FilterValue = "upcoming" | "past" | "cancelled";
type Kind = "bookings" | "group";

const TONES: LiveSessionTone[] = ["lavender", "blue", "sage", "butter", "mint"];

/* Upcoming sessions need no label; only finished or stopped ones say what happened. */
const bookingStatus = (status: string): LiveSessionStatus | null => {
  if (status === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (status === "completed") return { label: "Done", tone: "sage" };
  if (status === "no_show") return { label: "Missed", tone: "butter" };
  return null;
};

const enrollmentStatus = (e: MyGroupLessonEnrollmentRow): LiveSessionStatus | null => {
  if (e.status === "removed" || e.removedByTeacher) return { label: "Removed", tone: "peach" };
  if (e.status === "cancelled" || e.lessonStatus === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (e.lessonStatus === "completed") return { label: "Done", tone: "sage" };
  return null;
};

const StudentLiveTeachingPage: React.FC = () => {
  const [kind, setKind] = useState<Kind>("bookings");
  const [filter, setFilter] = useState<FilterValue>("upcoming");

  return (
    <>
      <Helmet>
        <title>Live Teaching - Testkart</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live classes">
          <Button variant="outline" asChild>
            <Link to={GROUP_LESSON_LIST_PATH}>
              <Search size={16} aria-hidden="true" /> Find a class
            </Link>
          </Button>
        </ConsolePageHeader>

        <div className={styles.toolbar}>
          <LiveSessionSegment<Kind>
            label="Session type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "bookings", label: "1:1 sessions", icon: <Video size={16} aria-hidden="true" /> },
              { value: "group", label: "Group classes", icon: <Users size={16} aria-hidden="true" /> },
            ]}
          />
          <LiveSessionSegment<FilterValue>
            label="Show"
            variant="pills"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </div>

        {kind === "bookings" ? <BookingsView filter={filter} /> : <GroupView filter={filter} />}
      </div>
    </>
  );
};

export default StudentLiveTeachingPage;

const ListSkeleton: React.FC = () => (
  <div className={styles.skeletons}>
    <Skeleton style={{ height: "6.5rem", width: "100%", borderRadius: "1.5rem" }} />
    <Skeleton style={{ height: "5rem", width: "100%", borderRadius: "1.25rem" }} />
  </div>
);

const BookingsView: React.FC<{ filter: FilterValue }> = ({ filter }) => {
  const { data, isFetching } = useMentorshipBookingsListQuery({ filter });
  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);

  if (isFetching && !data) return <ListSkeleton />;

  const bookings = data?.bookings ?? [];
  if (bookings.length === 0) {
    return (
      <ConsoleListEmpty
        icon={<Calendar size={28} />}
        title={filter === "upcoming" ? "No 1:1 sessions booked" : `No ${filter} sessions`}
        description={filter === "upcoming" ? "Open a teacher's profile to book a private session." : undefined}
      />
    );
  }

  const [first, ...rest] = bookings;
  const showNext = filter === "upcoming" && first.status === "scheduled";
  const listed = showNext ? rest : bookings;

  const menu = (b: MentorshipBookingRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-md" aria-label={`More options for ${b.sessionTitle}`}>
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setRescheduleTarget(b)}>
          <RotateCcw size={14} /> Reschedule
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setCancelTarget(b)}>
          <Ban size={14} /> Cancel session
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {showNext && (
        <LiveSessionNextCard
          startTime={first.scheduledAt}
          durationMinutes={first.durationMinutes}
          title={first.sessionTitle}
          subtitle={`with ${first.teacherName}`}
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
              title={b.sessionTitle}
              subtitle={`with ${b.teacherName}`}
              tone={TONES[i % TONES.length]}
              status={bookingStatus(b.status)}
              note={b.cancellationReason}
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

      <CancelBookingDialog booking={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RescheduleBookingDialog booking={rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)} />
    </>
  );
};

const GroupView: React.FC<{ filter: FilterValue }> = ({ filter }) => {
  const { data, isFetching } = useMentorshipMyGroupLessonEnrollmentsQuery({ filter });
  const unenrollMutation = useMentorshipGroupLessonUnenrollMutation();
  const [leaveTarget, setLeaveTarget] = useState<MyGroupLessonEnrollmentRow | null>(null);

  if (isFetching && !data) return <ListSkeleton />;

  const enrollments = data?.enrollments ?? [];
  if (enrollments.length === 0) {
    return (
      <ConsoleListEmpty
        icon={<Users size={28} />}
        title={filter === "upcoming" ? "No group classes yet" : `No ${filter} classes`}
      >
        {filter === "upcoming" && (
          <Button asChild>
            <Link to={GROUP_LESSON_LIST_PATH}>Browse live classes</Link>
          </Button>
        )}
      </ConsoleListEmpty>
    );
  }

  const isJoinable = (e: MyGroupLessonEnrollmentRow) => e.status === "enrolled" && e.lessonStatus === "scheduled";
  const canLeave = (e: MyGroupLessonEnrollmentRow) => isJoinable(e) && new Date(e.startTime) > new Date();

  const [first, ...rest] = enrollments;
  const showNext = filter === "upcoming" && isJoinable(first);
  const listed = showNext ? rest : enrollments;

  const menu = (e: MyGroupLessonEnrollmentRow) =>
    canLeave(e) ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-md" aria-label={`More options for ${e.title}`}>
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setLeaveTarget(e)}>
            <Ban size={14} /> Leave this class
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <>
      {showNext && (
        <LiveSessionNextCard
          startTime={first.startTime}
          durationMinutes={first.durationMinutes}
          title={first.title}
          subtitle={`with ${first.teacherName}`}
          actions={
            <>
              <Button asChild>
                <Link to={`/mentorship/classroom/group/${first.groupLessonId}`}>
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
          {listed.map((e, i) => (
            <LiveSessionRow
              key={e.enrollmentId}
              startTime={e.startTime}
              durationMinutes={e.durationMinutes}
              title={e.title}
              subtitle={`with ${e.teacherName}`}
              tone={TONES[i % TONES.length]}
              status={enrollmentStatus(e)}
              actions={
                isJoinable(e) ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/mentorship/classroom/group/${e.groupLessonId}`}>
                        <Video size={14} aria-hidden="true" /> Classroom
                      </Link>
                    </Button>
                    {menu(e)}
                  </>
                ) : undefined
              }
            />
          ))}
        </LiveSessionList>
      )}

      <ConsoleConfirmDialog
        open={!!leaveTarget}
        onOpenChange={(open) => !open && setLeaveTarget(null)}
        title={`Leave ${leaveTarget?.title ?? "this class"}?`}
        description="You'll lose your seat. If you paid, refunds follow our standard cancellation policy."
        tone="destructive"
        confirmLabel="Leave class"
        pendingLabel="Leaving..."
        isPending={unenrollMutation.isPending}
        onConfirm={() => {
          if (!leaveTarget) return;
          unenrollMutation.mutate(
            { groupLessonId: leaveTarget.groupLessonId },
            {
              onSuccess: () => {
                toast.success("You've left the class.");
                setLeaveTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not leave this class."),
            }
          );
        }}
      />
    </>
  );
};

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
