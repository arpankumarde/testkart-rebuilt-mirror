import React, { useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Clock, Copy, IndianRupee, ListChecks, Timer, UserRound, Users, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./Sheet";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import {
  LiveAttendanceDialog,
  LiveAttendancePill,
  LiveAvatar,
  LiveCancelDialog,
  LiveKindBadge,
  LivePaymentPill,
  LiveSessionOutcomeDialog,
  LiveSessionStatusPill,
  actorLabel,
  attendanceLabel,
  copyText,
  liveKindLabel,
  rupees,
  sessionStatusLabel,
  type AttendanceTarget,
  type SessionTarget,
} from "./AdminLiveBits";
import { useAdminLiveSessionQuery } from "../helpers/useAdminLiveModule";
import { formatDuration, formatLongDate, formatTime, formatDateTime } from "../helpers/liveCalendarDates";
import type { LiveCalendarEvent, LiveSessionStatus } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import type { LiveAttendeeRow, LiveSessionEvent } from "../endpoints/admin/live-lessons/session_GET.schema";
import styles from "./AdminLiveSessionDrawer.module.css";

interface Props {
  /* The session as the calendar or the Bookings list already has it, shown while the details load. */
  event: LiveCalendarEvent | null;
  onClose: () => void;
}

export const AdminLiveSessionDrawer: React.FC<Props> = ({ event, onClose }) => {
  const target = event ? { kind: event.kind, id: event.id } : null;
  const { data, isLoading, isError, refetch } = useAdminLiveSessionQuery(target);
  const [cancelTarget, setCancelTarget] = useState<SessionTarget | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<(SessionTarget & { action: "complete" | "missed" }) | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<AttendanceTarget | null>(null);
  const s = data?.session ?? event;
  const detail = data?.session;

  const started = !!s && new Date(s.start).getTime() <= Date.now();
  const canResolve = s?.status === "scheduled" && started;
  const canCancel = s?.status === "scheduled";
  const isGroup = s?.kind === "group";
  const sessionTarget: SessionTarget | null = s ? { kind: s.kind, id: s.id, title: s.title } : null;

  return (
    <>
      <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className={styles.sheet}>
          {s ? (
            <div className={styles.body}>
              <header className={styles.header}>
                <div className={styles.chips}>
                  <LiveKindBadge kind={s.kind} withLabel />
                  {s.isTrial ? <span className={styles.trial}>Trial</span> : null}
                </div>
                <SheetTitle className={styles.title}>{s.title}</SheetTitle>
                <SheetDescription className={styles.when}>
                  {formatLongDate(s.start)} · {formatTime(s.start)} - {formatTime(s.end)} IST
                </SheetDescription>
              </header>

              <section className={styles.block} aria-labelledby="live-session-details">
                <h3 id="live-session-details" className={styles.blockTitle}>
                  Session details
                </h3>
                <div className={styles.statusLine}>
                  <span className={styles.statusLabel}>Session status</span>
                  <LiveSessionStatusPill status={s.status} />
                  {s.unmarked ? <span className={styles.muted}>Ended, not marked yet</span> : null}
                </div>
                <dl className={styles.facts}>
                  <Fact icon={<UserRound />} label="Teacher" wide>
                    <span className={styles.inlinePerson}>
                      <LiveAvatar name={s.teacherName} src={s.teacherAvatarUrl} size="sm" />
                      {s.teacherName ?? "Unknown teacher"}
                    </span>
                  </Fact>
                  <Fact icon={<CalendarClock />} label="Date">
                    {formatLongDate(s.start)}
                  </Fact>
                  <Fact icon={<Clock />} label="Time (IST)">
                    {formatTime(s.start)} - {formatTime(s.end)}
                  </Fact>
                  <Fact icon={<Timer />} label="Duration">
                    {formatDuration(s.durationMinutes)}
                  </Fact>
                  <Fact icon={<ListChecks />} label="Type">
                    {liveKindLabel(s.kind)}
                  </Fact>
                  {isGroup ? (
                    <Fact icon={<Users />} label="Seats">
                      {s.studentCount} of {s.maxCapacity ?? "-"} taken
                    </Fact>
                  ) : null}
                  <Fact icon={<IndianRupee />} label={isGroup ? "Price per learner" : "Session price"}>
                    {rupees(s.price)}
                  </Fact>
                </dl>
                <StatusNote status={s.status} detail={detail} cancellationReason={s.cancellationReason} />
              </section>

              <section className={styles.block} aria-labelledby="live-session-attendance">
                <h3 id="live-session-attendance" className={styles.blockTitle}>
                  Student attendance
                  {data ? <span className={styles.count}>{data.attendees.length}</span> : null}
                </h3>
                {isLoading ? (
                  <div className={styles.loading}>
                    <Skeleton style={{ height: "4rem", width: "100%", borderRadius: "0.75rem" }} />
                  </div>
                ) : isError ? (
                  <div className={styles.inlineError}>
                    Could not load the learners.
                    <Button size="sm" variant="outline" onClick={() => refetch()}>
                      Try again
                    </Button>
                  </div>
                ) : data && data.attendees.length === 0 ? (
                  <p className={styles.muted}>No learners enrolled.</p>
                ) : (
                  <ul className={styles.attendees}>
                    {data?.attendees.map((a) => (
                      <AttendeeItem key={a.id} a={a} onMark={(attendance) => setAttendanceTarget({ type: a.type, id: a.id, name: a.studentName ?? "this learner", attendance })} />
                    ))}
                  </ul>
                )}
              </section>

              {data && data.history.length > 0 ? (
                <section className={styles.block} aria-labelledby="live-session-history">
                  <h3 id="live-session-history" className={styles.blockTitle}>
                    Changes
                  </h3>
                  <ol className={styles.history}>
                    {data.history.map((h) => (
                      <HistoryItem key={h.id} event={h} />
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          ) : null}

          {s && sessionTarget ? (
            <footer className={styles.footer}>
              {canResolve ? (
                <>
                  <Button size="sm" onClick={() => setOutcomeTarget({ ...sessionTarget, action: "complete" })}>
                    <CheckCircle2 /> Mark completed
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOutcomeTarget({ ...sessionTarget, action: "missed" })}>
                    <XCircle /> Mark missed
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => copyText(s.id, "Session ID")}>
                <Copy /> Copy ID
              </Button>
              {canCancel ? (
                <Button variant="destructive" size="sm" className={styles.cancel} onClick={() => setCancelTarget(sessionTarget)}>
                  <Ban /> Cancel session
                </Button>
              ) : null}
            </footer>
          ) : null}
        </SheetContent>
      </Sheet>
      <LiveCancelDialog target={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <LiveSessionOutcomeDialog target={outcomeTarget} onOpenChange={(open) => !open && setOutcomeTarget(null)} />
      <LiveAttendanceDialog target={attendanceTarget} onOpenChange={(open) => !open && setAttendanceTarget(null)} />
    </>
  );
};

/* What happened to the session, once it is no longer scheduled. */
const StatusNote: React.FC<{
  status: LiveSessionStatus;
  detail?: { completedAt: Date | null; completedBy: string | null; cancelledAt: Date | null; cancelledBy: string | null; missedReason: string | null };
  cancellationReason: string | null;
}> = ({ status, detail, cancellationReason }) => {
  if (status === "completed" && detail?.completedAt) {
    return (
      <p className={styles.note}>
        Marked completed {formatDateTime(detail.completedAt)} IST{detail.completedBy ? ` by ${actorLabel(detail.completedBy)}` : ""}.
      </p>
    );
  }
  if (status === "missed") {
    return (
      <p className={`${styles.note} ${styles.noteRose}`}>
        The teacher did not hold this session.
        {detail?.missedReason ? ` ${detail.missedReason}` : ""}
        {detail?.cancelledBy || detail?.cancelledAt
          ? ` Marked ${detail.cancelledAt ? `${formatDateTime(detail.cancelledAt)} IST` : ""}${detail.cancelledBy ? ` by ${actorLabel(detail.cancelledBy)}` : ""}.`
          : ""}
      </p>
    );
  }
  if (status === "cancelled") {
    return (
      <p className={styles.note}>
        Cancelled{detail?.cancelledAt ? ` ${formatDateTime(detail.cancelledAt)} IST` : ""}
        {detail?.cancelledBy ? ` by ${actorLabel(detail.cancelledBy)}` : ""}.{cancellationReason ? ` Reason: ${cancellationReason}` : ""}
      </p>
    );
  }
  return null;
};

const BASIS: Record<NonNullable<LiveAttendeeRow["attendanceBasis"]>, string> = {
  marked: "",
  teacher: "Marked by the teacher",
  classroom: "Joined the classroom",
  no_join: "Did not join the classroom",
};

const AttendeeItem: React.FC<{ a: LiveAttendeeRow; onMark: (attendance: "attended" | "missed") => void }> = ({ a, onMark }) => {
  const basis =
    a.attendanceBasis === "marked"
      ? `Set by ${actorLabel(a.attendanceMarkedBy) ?? "an admin"}${a.attendanceMarkedAt ? `, ${formatDateTime(a.attendanceMarkedAt)} IST` : ""}`
      : a.attendanceBasis
        ? BASIS[a.attendanceBasis]
        : null;
  return (
    <li className={styles.attendee}>
      <div className={styles.attendeeHead}>
        <LiveAvatar name={a.studentName} size="sm" tone="sage" />
        <div className={styles.attendeeText}>
          <span className={styles.attendeeName}>{a.studentName ?? "Learner"}</span>
          {a.studentEmail ? <span className={styles.muted}>{a.studentEmail}</span> : null}
        </div>
        <LiveAttendancePill status={a.attendance} />
      </div>
      <dl className={styles.attendeeMeta}>
        <div>
          <dt>Booking ID</dt>
          <dd>
            <button type="button" className={styles.mono} onClick={() => copyText(a.id, "Booking ID")} title="Copy booking ID">
              {a.id.slice(0, 8)}
            </button>
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd className={styles.payment}>
            {rupees(a.amountPaid)}
            {a.price !== a.amountPaid ? <span className={styles.muted}> of {rupees(a.price)}</span> : null}
            <LivePaymentPill status={a.paymentStatus} />
            {a.orderId ? <span className={styles.muted}>Order #{a.orderId}</span> : null}
          </dd>
        </div>
      </dl>
      {basis || a.canMark ? (
        <div className={styles.attendeeFoot}>
          {basis ? <span className={styles.muted}>{basis}</span> : <span />}
          {a.canMark ? (
            <span className={styles.attendeeActions}>
              {a.attendance !== "attended" ? (
                <Button size="sm" variant="outline" onClick={() => onMark("attended")}>
                  Mark attended
                </Button>
              ) : null}
              {a.attendance !== "missed" ? (
                <Button size="sm" variant="outline" onClick={() => onMark("missed")}>
                  Mark missed
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

const ACTOR: Record<LiveSessionEvent["actorType"], string> = {
  admin: "Admin",
  teacher: "Teacher",
  learner: "Learner",
  system: "Testkart (automatic)",
};

const statusWord = (v: string) =>
  v === "scheduled" || v === "completed" || v === "missed" || v === "cancelled" ? sessionStatusLabel(v) : v.replace(/_/g, " ");

const HistoryItem: React.FC<{ event: LiveSessionEvent }> = ({ event: h }) => {
  const attendance = h.toStatus === "attendance_attended" ? "attended" : h.toStatus === "attendance_missed" ? "missed" : null;
  const [who, note] = attendance && h.reason ? [h.reason.split(": ")[0], h.reason.split(": ").slice(1).join(": ")] : [null, h.reason];
  return (
    <li className={styles.historyItem}>
      <span className={styles.historyChange}>
        {attendance
          ? `${who ?? "Learner"}: attendance ${attendanceLabel(attendance).toLowerCase()}`
          : `Session ${h.fromStatus ? `${statusWord(h.fromStatus).toLowerCase()} to ` : ""}${statusWord(h.toStatus).toLowerCase()}`}
      </span>
      <span className={styles.muted}>
        {formatDateTime(h.createdAt)} IST · {ACTOR[h.actorType] ?? h.actorType}
        {h.actorLabel ? ` ${h.actorLabel}` : ""}
      </span>
      {note ? <span className={styles.historyReason}>{note}</span> : null}
    </li>
  );
};

const Fact: React.FC<{ icon: React.ReactNode; label: string; wide?: boolean; children: React.ReactNode }> = ({
  icon,
  label,
  wide,
  children,
}) => (
  <div className={`${styles.fact} ${wide ? styles.factWide : ""}`}>
    <span className={styles.factIcon} aria-hidden="true">
      {icon}
    </span>
    <div className={styles.factText}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  </div>
);
