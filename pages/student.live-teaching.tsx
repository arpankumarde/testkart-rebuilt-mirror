import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Calendar, Ban, RotateCcw, Users, MoreHorizontal, Search, Flag } from "lucide-react";
import { LivePackagesPanel } from "../components/LivePackagesPanel";
import { LiveSlotPicker, useLiveSlotRange } from "../components/LiveSlotPicker";
import { useBookingReportMutation, useInvalidateLiveClasses } from "../helpers/useLivePackages";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import { FREE_CANCELLATION_CUTOFF_HOURS } from "../helpers/liveLessonConfig";
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
  const invalidate = useInvalidateLiveClasses();

  // Back from a one-time payment for a package renewal whose autopay failed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = Number(params.get("order_id"));
    if (params.get("gateway") !== "cashfree" || !orderId) return;
    window.history.replaceState({}, "", window.location.pathname);
    const toastId = toast.loading("Confirming your payment...");
    postPaymentCashfreeVerify({ orderId })
      .then(async (result) => {
        toast.dismiss(toastId);
        await invalidate();
        if (result.orderStatus === "completed") toast.success("Paid. Your next 4 weeks are booked.");
        else if (result.orderStatus === "pending") toast.warning("Your payment is still being confirmed.");
        else toast.error(result.message || "The payment did not go through.");
      })
      .catch((err) => {
        toast.dismiss(toastId);
        toast.error(err instanceof Error ? err.message : "Could not check the payment.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        <LivePackagesPanel />

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
  const [reportTarget, setReportTarget] = useState<MentorshipBookingRow | null>(null);

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
        <DropdownMenuItem disabled={!b.freeChange} onSelect={() => setRescheduleTarget(b)}>
          <RotateCcw size={14} /> {b.freeChange ? "Reschedule" : `Can't move within ${FREE_CANCELLATION_CUTOFF_HOURS} hours`}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setCancelTarget(b)}>
          <Ban size={14} /> Cancel class
        </DropdownMenuItem>
        {b.canReport && (
          <DropdownMenuItem onSelect={() => setReportTarget(b)}>
            <Flag size={14} /> Teacher did not come
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const reportButton = (b: MentorshipBookingRow) =>
    b.canReport ? (
      <Button variant="outline" size="sm" onClick={() => setReportTarget(b)}>
        <Flag size={14} aria-hidden="true" /> Teacher did not come
      </Button>
    ) : b.issue ? (
      <span className={styles.reportNote}>{b.issue.resolution ? (b.issue.resolution === "refunded" ? "Refunded" : "Report closed") : "Report sent"}</span>
    ) : undefined;

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
                ) : (
                  reportButton(b)
                )
              }
            />
          ))}
        </LiveSessionList>
      )}

      <CancelBookingDialog booking={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RescheduleBookingDialog booking={rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)} />
      <ReportBookingDialog booking={reportTarget} onOpenChange={(open) => !open && setReportTarget(null)} />
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
      title={`Cancel class with ${booking?.teacherName ?? ""}?`}
      description={cancelText(booking)}
      tone="destructive"
      confirmLabel="Cancel class"
      pendingLabel="Cancelling..."
      isPending={cancelMutation.isPending}
      note={{ label: "Reason", value: reason, onChange: setReason, required: true, placeholder: "e.g. schedule conflict, no longer needed..." }}
      onConfirm={() => {
        if (!booking) return;
        cancelMutation.mutate(
          { bookingId: booking.id, reason: reason.trim() },
          {
            onSuccess: (result) => {
              toast.success(
                result.credit === "unscheduled"
                  ? "Class cancelled. It is back in your package to book again."
                  : result.credit === "released"
                    ? "Class cancelled. Its price is in your live class balance."
                    : "Class cancelled."
              );
              setReason("");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this class."),
          }
        );
      }}
    />
  );
};

const cancelText = (booking: MentorshipBookingRow | null): string => {
  if (!booking) return "";
  if (!booking.freeChange) {
    return `This class starts within ${FREE_CANCELLATION_CUTOFF_HOURS} hours, so it is charged in full. The teacher is told by email.`;
  }
  if (booking.kind === "package") return "The class goes back into your package so you can book another time. The teacher is told by email.";
  if (booking.kind === "trial") return "The trial price goes to your live class balance, to use with any teacher. The teacher is told by email.";
  return "The teacher is told by email.";
};

const RescheduleBookingDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) =>
  booking ? <RescheduleBookingBody key={booking.id} booking={booking} onOpenChange={onOpenChange} /> : null;

const RescheduleBookingBody: React.FC<{ booking: MentorshipBookingRow; onOpenChange: (open: boolean) => void }> = ({ booking, onOpenChange }) => {
  const [picked, setPicked] = useState<number[]>([]);
  const range = useLiveSlotRange(35);
  const rescheduleMutation = useMentorshipBookingRescheduleMutation();
  const invalidate = useInvalidateLiveClasses();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={`Move your class with ${booking.teacherName}`} description="Pick a new time. You both get an email." />
        <ConsoleDialogBody>
          <LiveSlotPicker
            teacherId={booking.teacherId}
            minutes={booking.durationMinutes}
            range={range}
            mode="single"
            selected={picked}
            onChange={setPicked}
            title="New time"
          />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={rescheduleMutation.isPending || picked.length === 0}
            onClick={() => {
              rescheduleMutation.mutate(
                { bookingId: booking.id, newStartTime: new Date(picked[0]) },
                {
                  onSuccess: async () => {
                    await invalidate();
                    toast.success("Class moved.");
                    onOpenChange(false);
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Could not move this class."),
                }
              );
            }}
          >
            {rescheduleMutation.isPending ? "Saving..." : "Move class"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const ReportBookingDialog: React.FC<{ booking: MentorshipBookingRow | null; onOpenChange: (open: boolean) => void }> = ({
  booking,
  onOpenChange,
}) => {
  const [note, setNote] = useState("");
  const report = useBookingReportMutation();
  return (
    <ConsoleConfirmDialog
      open={!!booking}
      onOpenChange={(open) => {
        if (!open) setNote("");
        onOpenChange(open);
      }}
      title="Teacher did not come?"
      description="Our team checks the class record. If the teacher did not take the class, you get the class back."
      confirmLabel="Send report"
      pendingLabel="Sending..."
      isPending={report.isPending}
      note={{ label: "What happened", value: note, onChange: setNote, required: true, placeholder: "e.g. the teacher never joined the room" }}
      onConfirm={() => {
        if (!booking) return;
        report.mutate(
          { bookingId: booking.id, note: note.trim() },
          {
            onSuccess: () => {
              toast.success("Report sent. We will email you once it is checked.");
              setNote("");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the report."),
          }
        );
      }}
    />
  );
};
