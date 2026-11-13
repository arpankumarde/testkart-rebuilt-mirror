import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, Ban, RotateCcw, MoreHorizontal, Search, Flag, MessageSquare } from "lucide-react";
import { LivePackagesPanel } from "../components/LivePackagesPanel";
import { ClassroomRecapDialog, ClassroomRecapTarget } from "../components/ClassroomRecapDialog";
import { LiveSlotPicker, useLiveSlotRange } from "../components/LiveSlotPicker";
import { useBookingReportMutation, useInvalidateLiveClasses } from "../helpers/useLivePackages";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import { FREE_CANCELLATION_CUTOFF_HOURS, JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import {
  useMentorshipBookingsListQuery,
  useMentorshipBookingCancelMutation,
  useMentorshipBookingRescheduleMutation,
} from "../helpers/useMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
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
  LiveSessionCard,
  LiveSessionJoinLink,
  LiveSessionList,
  LiveSessionOpensNote,
  LiveSessionSegment,
  LiveSessionStatus,
} from "../components/LiveSession";
import styles from "./student.live-teaching.module.css";

type FilterValue = "upcoming" | "past" | "cancelled";

/* Upcoming sessions carry an Up next or Room open badge instead; only finished or stopped ones say what happened. */
const bookingStatus = (status: string, noShowParty?: string | null): LiveSessionStatus | null => {
  if (status === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (status === "completed") return { label: "Done", tone: "sage" };
  if (status === "no_show") return { label: noShowParty === "teacher" ? "Teacher absent" : "Missed", tone: "butter" };
  return null;
};

const MIN = 60000;

/** Re-renders every 30 seconds so a classroom button appears and disappears with its join window. */
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
};

/** The same window the join endpoint enforces: from shortly before the start to shortly after the end. */
const isInJoinWindow = (start: Date | string, durationMinutes: number, now: number) => {
  const startMs = new Date(start).getTime();
  return now >= startMs - JOIN_WINDOW_MINUTES_BEFORE * MIN && now <= startMs + (durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * MIN;
};

const opensLabel = (start: Date | string, now: number) => {
  const opens = new Date(new Date(start).getTime() - JOIN_WINDOW_MINUTES_BEFORE * MIN);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(opens);
  if (new Date(now).toDateString() === opens.toDateString()) return `Opens at ${time}`;
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(opens);
  return `Opens ${day}, ${time}`;
};

const StudentLiveTeachingPage: React.FC = () => {
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
        else if (result.orderStatus === "refunded") toast.info("This payment was not needed, so it is being refunded in full to your account.");
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
        <title>1:1 Classes - Testkart</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="1:1 classes">
          <Button variant="outline" asChild>
            <Link to="/expert">
              <Search size={16} aria-hidden="true" /> Find a teacher
            </Link>
          </Button>
        </ConsolePageHeader>

        <LivePackagesPanel />

        <div className={styles.toolbar}>
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

        <BookingsView filter={filter} />
      </div>
    </>
  );
};

export default StudentLiveTeachingPage;

const ListSkeleton: React.FC = () => (
  <div className={styles.skeletons}>
    <Skeleton style={{ height: "4.75rem", width: "100%", borderRadius: "1rem" }} />
    <Skeleton style={{ height: "4.75rem", width: "100%", borderRadius: "1rem" }} />
    <Skeleton style={{ height: "4.75rem", width: "100%", borderRadius: "1rem" }} />
  </div>
);

const BookingsView: React.FC<{ filter: FilterValue }> = ({ filter }) => {
  const { data, isFetching } = useMentorshipBookingsListQuery({ filter });
  const now = useNow();
  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);
  const [reportTarget, setReportTarget] = useState<MentorshipBookingRow | null>(null);
  const [recapTarget, setRecapTarget] = useState<ClassroomRecapTarget | null>(null);

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

  // A class can be moved or cancelled only before it starts, and entered only inside its join window.
  // Only the Upcoming list offers the join button; a past class opens its saved chat and whiteboard here in a dialog.
  const isUpcoming = (b: MentorshipBookingRow) => filter === "upcoming" && b.status === "scheduled";
  const notStarted = (b: MentorshipBookingRow) => b.status === "scheduled" && new Date(b.scheduledAt).getTime() > now;
  const canEnter = (b: MentorshipBookingRow) => isUpcoming(b) && isInJoinWindow(b.scheduledAt, b.durationMinutes, now);
  const nextId = bookings.find(isUpcoming)?.id;

  const menu = (b: MentorshipBookingRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-md" className={styles.menuTrigger} aria-label={`More options for ${b.sessionTitle}`}>
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuItem className={styles.menuItem} disabled={!b.freeChange} onSelect={() => setRescheduleTarget(b)}>
          <RotateCcw size={16} aria-hidden="true" />
          <span>{b.freeChange ? "Reschedule" : `Can't move within ${FREE_CANCELLATION_CUTOFF_HOURS} hours`}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className={`${styles.menuItem} ${styles.menuItemDanger}`} onSelect={() => setCancelTarget(b)}>
          <Ban size={16} aria-hidden="true" />
          <span>Cancel class</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const upcomingActions = (b: MentorshipBookingRow) => (
    <>
      {canEnter(b) ? (
        <LiveSessionJoinLink to={`/mentorship/classroom/booking/${b.id}`} />
      ) : notStarted(b) ? (
        <LiveSessionOpensNote>{opensLabel(b.scheduledAt, now)}</LiveSessionOpensNote>
      ) : null}
      {notStarted(b) && menu(b)}
    </>
  );

  const reportButton = (b: MentorshipBookingRow) =>
    b.canReport ? (
      <Button variant="outline" size="md" className={styles.reportButton} onClick={() => setReportTarget(b)}>
        <Flag size={14} aria-hidden="true" /> Teacher did not come
      </Button>
    ) : b.issue ? (
      <span className={styles.reportNote}>{b.issue.resolution ? (b.issue.resolution === "refunded" ? "Refunded" : "Report closed") : "Report sent"}</span>
    ) : undefined;

  const pastActions = (b: MentorshipBookingRow) => (
    <>
      {filter === "past" && b.status !== "cancelled" && (
        <Button
          variant="outline"
          size="md"
          onClick={() => setRecapTarget({ kind: "booking", id: b.id, withName: b.teacherName, startTime: b.scheduledAt })}
        >
          <MessageSquare size={14} aria-hidden="true" /> Chat and board
        </Button>
      )}
      {reportButton(b)}
    </>
  );

  return (
    <>
      <LiveSessionList>
        {bookings.map((b) => (
          <LiveSessionCard
            key={b.id}
            startTime={b.scheduledAt}
            durationMinutes={b.durationMinutes}
            title={b.sessionTitle}
            teacherName={b.teacherName}
            teacherAvatarUrl={b.teacherAvatarUrl}
            badge={canEnter(b) ? "live" : b.id === nextId ? "next" : null}
            status={filter === "past" && b.status === "scheduled" ? { label: "Ended", tone: "muted" } : bookingStatus(b.status, b.noShowParty)}
            note={b.cancellationReason}
            actions={isUpcoming(b) ? upcomingActions(b) : pastActions(b)}
          />
        ))}
      </LiveSessionList>

      <CancelBookingDialog booking={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RescheduleBookingDialog booking={rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)} />
      <ReportBookingDialog booking={reportTarget} onOpenChange={(open) => !open && setReportTarget(null)} />
      <ClassroomRecapDialog target={recapTarget} onOpenChange={(open) => !open && setRecapTarget(null)} />
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
