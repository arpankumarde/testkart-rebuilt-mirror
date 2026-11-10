import React, { useState } from "react";
import { Ban, CalendarClock, Clock, Copy, IndianRupee, ListChecks, Timer, Users, Video } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./Sheet";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import {
  LiveAvatar,
  LiveCancelDialog,
  LiveKindBadge,
  LivePaymentPill,
  LiveStatusPill,
  copyText,
  liveKindLabel,
  rupees,
  type CancelTarget,
} from "./AdminLiveBits";
import { useAdminLiveSessionQuery } from "../helpers/useAdminLiveModule";
import { VIDEO_PROVIDER_MODE } from "../helpers/liveLessonConfig";
import { formatDuration, formatLongDate, formatRelative, formatTime, formatDateTime } from "../helpers/liveCalendarDates";
import type { LiveCalendarEvent } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import styles from "./AdminLiveSessionDrawer.module.css";

interface Props {
  /* The event as the calendar already has it, shown while the full details load. */
  event: LiveCalendarEvent | null;
  onClose: () => void;
  onViewBookings: (sessionId: string, kind: "booking" | "group") => void;
}

export const AdminLiveSessionDrawer: React.FC<Props> = ({ event, onClose, onViewBookings }) => {
  const target = event ? { kind: event.kind, id: event.id } : null;
  const { data, isLoading, isError, refetch } = useAdminLiveSessionQuery(target);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const s = data?.session ?? event;

  const awaiting = !!s && s.status === "scheduled" && new Date(s.end).getTime() < Date.now();
  const cancellable = !!s && (s.kind === "booking" ? s.status === "scheduled" : s.status !== "cancelled" && s.status !== "completed");
  const isGroup = s?.kind === "group";
  const fill = isGroup && s?.maxCapacity ? Math.min(100, Math.round(((s.enrolledCount ?? 0) / s.maxCapacity) * 100)) : null;

  return (
    <>
      <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className={styles.sheet}>
          {s ? (
            <div className={styles.body}>
              <header className={styles.header}>
                <div className={styles.chips}>
                  <LiveKindBadge kind={s.kind} withLabel />
                  <LiveStatusPill status={s.status} awaiting={awaiting} />
                  {s.isTrial ? <span className={styles.trial}>Trial</span> : null}
                </div>
                <SheetTitle className={styles.title}>{s.title}</SheetTitle>
                <SheetDescription className={styles.when}>
                  {formatLongDate(s.start)} · {formatTime(s.start)} - {formatTime(s.end)} IST
                  <span className={styles.relative}>{formatRelative(s.start)}</span>
                </SheetDescription>
              </header>

              <section className={styles.teacher} aria-label="Teacher">
                <LiveAvatar name={s.teacherName} src={s.teacherAvatarUrl} size="lg" />
                <div className={styles.teacherText}>
                  <span className={styles.eyebrow}>Teacher</span>
                  <span className={styles.teacherName}>{s.teacherName ?? "Unknown teacher"}</span>
                  <span className={styles.muted}>User ID {s.teacherId}</span>
                </div>
              </section>

              <dl className={styles.facts}>
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
                <Fact icon={<Users />} label={isGroup ? "Seats" : "Learner"}>
                  {isGroup ? (
                    <span className={styles.seats}>
                      {s.enrolledCount ?? 0} of {s.maxCapacity ?? "-"} filled
                      {fill !== null ? (
                        <span className={styles.bar} aria-hidden="true">
                          <span style={{ width: `${fill}%` }} />
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    s.studentName ?? "1 learner"
                  )}
                </Fact>
                <Fact icon={<IndianRupee />} label={isGroup ? "Price per learner" : "Session price"}>
                  {rupees(s.price)}
                </Fact>
                <Fact icon={<Video />} label="Video provider" wide>
                  <span className={`${styles.provider} ${VIDEO_PROVIDER_MODE === "mock" ? styles.providerMock : ""}`}>
                    <span aria-hidden="true" />
                    {VIDEO_PROVIDER_MODE === "mock" ? "Development mock - not live video" : "Live"}
                  </span>
                </Fact>
              </dl>

              {s.cancellationReason ? (
                <div className={styles.notice}>
                  <span className={styles.eyebrow}>Cancellation reason</span>
                  <p>{s.cancellationReason}</p>
                </div>
              ) : null}

              {data?.session.description ? (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>About this lesson</h3>
                  <p className={styles.description}>{data.session.description}</p>
                  <p className={styles.muted}>
                    {[data.session.subject, data.session.level, data.session.language].filter(Boolean).join(" · ")}
                    {data.session.minEnrollment ? ` · runs with ${data.session.minEnrollment}+ learners` : ""}
                  </p>
                </div>
              ) : null}

              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>
                    {isGroup ? "Enrolled learners" : "Booking"}
                    {data && isGroup ? <span className={styles.count}>{data.bookingsTotal}</span> : null}
                  </h3>
                </div>
                {isLoading ? (
                  <div className={styles.loading}>
                    <Skeleton style={{ height: "3rem", width: "100%", borderRadius: "0.75rem" }} />
                    <Skeleton style={{ height: "3rem", width: "100%", borderRadius: "0.75rem" }} />
                  </div>
                ) : isError ? (
                  <div className={styles.inlineError}>
                    Could not load booking details.
                    <Button size="sm" variant="outline" onClick={() => refetch()}>
                      Try again
                    </Button>
                  </div>
                ) : data && data.bookings.length === 0 ? (
                  <p className={styles.muted}>No learner has booked a seat yet.</p>
                ) : (
                  <ul className={styles.bookings}>
                    {data?.bookings.slice(0, 8).map((b) => (
                      <li key={b.id} className={styles.booking}>
                        <LiveAvatar name={b.studentName} size="sm" tone="sage" />
                        <div className={styles.bookingText}>
                          <span className={styles.bookingName}>{b.studentName ?? "Learner"}</span>
                          <span className={styles.muted}>
                            {b.bookedAt ? `Booked ${formatDateTime(b.bookedAt)}` : "Booking date unknown"}
                          </span>
                        </div>
                        <div className={styles.bookingSide}>
                          <span className={styles.amount}>{rupees(b.amountPaid)}</span>
                          <LivePaymentPill status={b.paymentStatus} creditKind={b.creditKind} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {data && data.bookingsTotal > 8 ? (
                  <p className={styles.muted}>{data.bookingsTotal - 8} more in Bookings.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {s ? (
            <footer className={styles.footer}>
              <Button variant="outline" size="sm" onClick={() => copyText(s.id, "Session ID")}>
                <Copy /> Copy ID
              </Button>
              <Button variant="outline" size="sm" onClick={() => onViewBookings(s.id, s.kind)}>
                <ListChecks /> View bookings
              </Button>
              {cancellable ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className={styles.cancel}
                  onClick={() => setCancelTarget({ kind: s.kind, id: s.id, title: s.title })}
                >
                  <Ban /> {isGroup ? "Cancel lesson" : "Cancel session"}
                </Button>
              ) : null}
            </footer>
          ) : null}
        </SheetContent>
      </Sheet>
      <LiveCancelDialog target={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
    </>
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