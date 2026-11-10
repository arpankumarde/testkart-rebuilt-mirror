import React from "react";
import { CalendarDays, Copy } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./Sheet";
import { Button } from "./Button";
import {
  LiveAvatar,
  LiveKindBadge,
  LivePaymentPill,
  LiveStatusPill,
  copyText,
  liveKindLabel,
  liveStatusLabel,
  rupees,
} from "./AdminLiveBits";
import { useAdminLiveBookingQuery } from "../helpers/useAdminLiveModule";
import { formatDateTime, formatDuration, formatLongDate, formatRelative, formatTime } from "../helpers/liveCalendarDates";
import type { LiveBookingRow } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import styles from "./AdminLiveBookingDrawer.module.css";

interface Props {
  /* The row as the table has it, shown at once and refreshed from the server. */
  row: LiveBookingRow | null;
  onClose: () => void;
  onOpenInCalendar: (row: LiveBookingRow) => void;
}

export const AdminLiveBookingDrawer: React.FC<Props> = ({ row, onClose, onOpenInCalendar }) => {
  const { data } = useAdminLiveBookingQuery(row ? { type: row.type, id: row.id } : null);
  const b = data?.booking ?? row;

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className={styles.sheet}>
          {b ? (
            <>
              <div className={styles.body}>
                <header className={styles.header}>
                  <div className={styles.chips}>
                    <LiveKindBadge kind={b.type} withLabel />
                    <LiveStatusPill status={b.status} />
                  </div>
                  <SheetTitle className={styles.title}>Booking {b.id.slice(0, 8)}</SheetTitle>
                  <SheetDescription className={styles.sub}>
                    {b.bookedAt ? `Booked ${formatDateTime(b.bookedAt)} IST` : "Booking date not recorded"}
                  </SheetDescription>
                </header>

                <Block title="Learner">
                  <div className={styles.person}>
                    <LiveAvatar name={b.studentName} size="lg" tone="sage" />
                    <div className={styles.personText}>
                      <span className={styles.strong}>{b.studentName ?? "Unknown learner"}</span>
                      {b.studentEmail ? <span className={styles.muted}>{b.studentEmail}</span> : null}
                      {b.studentId ? <span className={styles.muted}>User ID {b.studentId}</span> : null}
                    </div>
                  </div>
                </Block>

                <Block
                  title="Session"
                  action={
                    <Button size="sm" variant="ghost" className={styles.linkBtn} onClick={() => onOpenInCalendar(b)}>
                      <CalendarDays /> Open in calendar
                    </Button>
                  }
                >
                  <p className={styles.sessionTitle}>{b.sessionTitle}</p>
                  <dl className={styles.rows}>
                    <Row label="Date">{formatLongDate(b.sessionStart)}</Row>
                    <Row label="Time (IST)">
                      {formatTime(b.sessionStart)} - {formatTime(b.sessionEnd)} · {formatRelative(b.sessionStart)}
                    </Row>
                    <Row label="Duration">{formatDuration(b.durationMinutes)}</Row>
                    <Row label="Type">{liveKindLabel(b.type)}</Row>
                    {b.type === "group" ? (
                      <>
                        <Row label="Lesson status">{liveStatusLabel(b.sessionStatus)}</Row>
                        <Row label="Seats">
                          {b.enrolledCount ?? 0} of {b.maxCapacity ?? "-"} filled
                        </Row>
                      </>
                    ) : null}
                    <Row label="Teacher">
                      <span className={styles.inlinePerson}>
                        <LiveAvatar name={b.teacherName} src={b.teacherAvatarUrl} size="sm" />
                        {b.teacherName ?? "Unknown"} <span className={styles.muted}>· ID {b.teacherId}</span>
                      </span>
                    </Row>
                  </dl>
                </Block>

                <Block title="Payment">
                  <div className={styles.payHead}>
                    <span className={styles.amount}>
                      {rupees(b.amountPaid)}
                      <span className={styles.amountLabel}>received</span>
                    </span>
                    <LivePaymentPill status={b.paymentStatus} creditKind={b.creditKind} />
                  </div>
                  <dl className={styles.rows}>
                    <Row label="Session price">{rupees(b.price)}</Row>
                    {b.orderId ? <Row label="Order">#{b.orderId}{b.orderStatus ? ` · ${b.orderStatus}` : ""}</Row> : null}
                    {b.paymentMethod ? <Row label="Method">{b.paymentMethod}</Row> : null}
                    {b.paymentTransactionId ? (
                      <Row label="Transaction">
                        <span className={styles.mono}>{b.paymentTransactionId}</span>
                      </Row>
                    ) : null}
                    {b.paidAt ? <Row label="Paid at">{formatDateTime(b.paidAt)}</Row> : null}
                    {b.creditKind ? <Row label="Paid from">{b.creditKind === "package" ? "Package class credit" : "Trial credit"}</Row> : null}
                    {b.isTrial ? <Row label="Class">Trial class</Row> : null}
                    {b.fromPackage ? <Row label="Package">Part of a monthly package</Row> : null}
                    {b.refundedAt ? (
                      <Row label="Refunded">
                        {formatDateTime(b.refundedAt)}
                        {b.refundReason ? ` · ${b.refundReason}` : ""}
                      </Row>
                    ) : null}
                    {!b.orderId && !b.creditKind ? <Row label="Order">No payment record</Row> : null}
                  </dl>
                </Block>

                {b.cancelledAt || b.cancellationReason ? (
                  <Block title="Cancellation" tone="rose">
                    <dl className={styles.rows}>
                      {b.cancelledAt ? <Row label="When">{formatDateTime(b.cancelledAt)}</Row> : null}
                      {b.cancelledBy ? <Row label="By">{b.cancelledBy}</Row> : null}
                      {b.cancellationReason ? <Row label="Reason">{b.cancellationReason}</Row> : null}
                    </dl>
                  </Block>
                ) : null}

                {b.issueReportedAt ? (
                  <Block title="No-show report" tone={b.issueResolution ? undefined : "butter"}>
                    <dl className={styles.rows}>
                      <Row label="Reported">{formatDateTime(b.issueReportedAt)}</Row>
                      {b.issueNote ? <Row label="Note">"{b.issueNote}"</Row> : null}
                      <Row label="Resolution">
                        {b.issueResolution === "refunded"
                          ? "Class given back"
                          : b.issueResolution === "rejected"
                            ? "Rejected, teacher paid"
                            : "Open - settle it under Description"}
                      </Row>
                    </dl>
                  </Block>
                ) : null}

                {b.type === "group" ? (
                  <p className={styles.note}>
                    Learners leave a group lesson from their own account. To stop the lesson for everyone, cancel it from the
                    Calendar.
                  </p>
                ) : null}
              </div>

              <footer className={styles.footer}>
                <Button variant="outline" size="sm" onClick={() => copyText(b.id, "Booking ID")}>
                  <Copy /> Copy booking ID
                </Button>
              </footer>
            </>
          ) : null}
        </SheetContent>
    </Sheet>
  );
};

const Block: React.FC<{ title: string; action?: React.ReactNode; tone?: "rose" | "butter"; children: React.ReactNode }> = ({
  title,
  action,
  tone,
  children,
}) => (
  <section className={`${styles.block} ${tone ? styles[`block_${tone}`] : ""}`}>
    <div className={styles.blockHead}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.row}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);
