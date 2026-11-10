import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Video, Ban, RotateCcw, CheckCircle2, MoreHorizontal, Settings2 } from "lucide-react";
import {
  useMentorshipBookingsRangeQuery,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
  useCompleteLessonMutation,
} from "../helpers/useTeacherMentorship";
import { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Checkbox } from "../components/Checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/DropdownMenu";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Input } from "../components/Input";
import { useTeacherLivePackagesQuery } from "../helpers/useLivePackages";
import { formatRupees } from "../helpers/livePricing";
import { LiveMonthPicker, type LiveDotTone } from "../components/LiveMonthPicker";
import styles from "./teacher.mentorship.bookings.module.css";

/*
 * Teacher 1:1 bookings as a calendar: a month picker on the left and, on the
 * right, a continuous day-by-day agenda (like a schedule view). Scrolling the
 * agenda moves the month picker; picking a day scrolls the agenda to it. All
 * dates are read in IST. The page loads a four-month window around the month
 * on show and moves the window when the picker leaves it.
 */

const TIME_ZONE = "Asia/Kolkata";

type YearMonth = { y: number; m: number };
type Kind = MentorshipBookingRow["kind"];

const KIND_LABEL: Record<Kind, string> = { trial: "Trial", package: "Package", single: "Single session" };
const KIND_TONE: Record<Kind, LiveDotTone> = { trial: "lavender", package: "blue", single: "sage" };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = (date: Date) => keyFormat.format(date);
const ymOfKey = (key: string): YearMonth => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1 });
const ymIndex = (ym: YearMonth) => ym.y * 12 + ym.m;
const addMonths = (ym: YearMonth, n: number): YearMonth => {
  const t = ymIndex(ym) + n;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
};
const istMonthStart = ({ y, m }: YearMonth) => new Date(`${y}-${pad(m + 1)}-01T00:00:00+05:30`);
const utcOfKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const monthTitle = (ym: YearMonth) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ym.y, ym.m, 1)));
const weekdayOfKey = (key: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(utcOfKey(key));
const longDateOfKey = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utcOfKey(key));
const timeOf = (date: Date) => new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: TIME_ZONE }).format(date);

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Students on 4-week packages with this teacher. Hidden until there is one. */
const TeacherPackagesSection: React.FC = () => {
  const { data } = useTeacherLivePackagesQuery();
  const packages = data?.packages ?? [];
  if (packages.length === 0) return null;
  return (
    <section className={styles.packages} aria-labelledby="teacher-packages-title">
      <h2 id="teacher-packages-title" className={styles.railTitle}>
        Students on packages
      </h2>
      <ul className={styles.packageList}>
        {packages.map((p) => (
          <li key={p.id} className={styles.packageRow}>
            <span className={styles.packageName}>{p.studentName}</span>
            <span className={styles.packageMeta}>
              {p.classesPerWeek} a week, {p.classMinutes} min, {formatRupees(p.pricePerClass)} a class
            </span>
            <span className={styles.packageMeta}>
              {p.upcomingCount} booked, {p.heldCount} done
              {p.cycleEndsAt
                ? `, ${p.autoRenew ? "renews" : "ends"} ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(p.cycleEndsAt))}`
                : ""}
            </span>
            {p.status === "past_due" && <span className={styles.packageDue}>Payment due</span>}
          </li>
        ))}
      </ul>
    </section>
  );
};

const TeacherMentorshipBookingsPage: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const todayKey = dayKey(now);
  const todayYm = ymOfKey(todayKey);

  const [anchor, setAnchor] = useState<YearMonth>(todayYm);
  const [viewMonth, setViewMonth] = useState<YearMonth>(todayYm);
  const [focusKey, setFocusKey] = useState(todayKey);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MentorshipBookingRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<MentorshipBookingRow | null>(null);

  const windowStart = addMonths(anchor, -1);
  const windowEnd = addMonths(anchor, 3);
  const from = useMemo(() => istMonthStart(windowStart), [ymIndex(windowStart)]); // eslint-disable-line react-hooks/exhaustive-deps
  const to = useMemo(() => istMonthStart(windowEnd), [ymIndex(windowEnd)]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isPlaceholderData, isFetching } = useMentorshipBookingsRangeQuery(from, to);
  const completeMutation = useCompleteLessonMutation();

  const paneRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<string | null>("now");

  const showMonth = useCallback(
    (ym: YearMonth) => {
      setViewMonth(ym);
      const i = ymIndex(ym);
      if (i < ymIndex(addMonths(anchor, -1)) || i > ymIndex(addMonths(anchor, 2))) setAnchor(ym);
    },
    [anchor]
  );

  const visible = useMemo(
    () => (data?.bookings ?? []).filter((b) => showCancelled || b.status !== "cancelled"),
    [data, showCancelled]
  );

  const dots = useMemo(() => {
    const map = new Map<string, LiveDotTone[]>();
    for (const b of visible) {
      const key = dayKey(new Date(b.scheduledAt));
      map.set(key, [...(map.get(key) ?? []), KIND_TONE[b.kind]]);
    }
    return map;
  }, [visible]);

  /* Agenda days grouped by month; today always shows when it is in the window. */
  const months = useMemo(() => {
    const byDay = new Map<string, MentorshipBookingRow[]>();
    for (const b of visible) {
      const key = dayKey(new Date(b.scheduledAt));
      byDay.set(key, [...(byDay.get(key) ?? []), b]);
    }
    if (now >= from && now < to && !byDay.has(todayKey)) byDay.set(todayKey, []);
    const keys = [...byDay.keys()].sort();
    return Array.from({ length: 4 }, (_, i) => {
      const ym = addMonths(ymOfKey(dayKey(from)), i);
      const mk = keyOf(ym.y, ym.m, 1).slice(0, 7);
      return { ym, days: keys.filter((k) => k.startsWith(mk)).map((key) => ({ key, rows: byDay.get(key)! })) };
    });
  }, [visible, now, from, to, todayKey]);

  const paneScrolls = () => {
    const pane = paneRef.current;
    return !!pane && getComputedStyle(pane).overflowY === "auto";
  };

  const scrollToTarget = useCallback((target: string) => {
    const pane = paneRef.current;
    if (!pane) return false;
    let el: HTMLElement | null = null;
    if (target === "now") el = pane.querySelector<HTMLElement>("[data-now]");
    if (!el) {
      const key = target === "now" ? todayKey : target;
      const days = [...pane.querySelectorAll<HTMLElement>("[data-day]")];
      el = days.find((d) => (d.dataset.day ?? "") >= key) ?? days[days.length - 1] ?? null;
    }
    if (!el) return false;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    if (getComputedStyle(pane).overflowY === "auto") {
      const head = el.closest("section")?.querySelector<HTMLElement>("h3");
      const offset = (head?.offsetHeight ?? 0) + (el.hasAttribute("data-now") ? 48 : 0);
      pane.scrollTo({ top: Math.max(0, el.offsetTop - offset), behavior: target === pendingScroll.current ? "auto" : behavior });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior });
    }
    return true;
  }, [todayKey]);

  /* On a narrow screen the agenda flows with the page, so the first load leaves the page at the top. */
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!data || isPlaceholderData || !pendingScroll.current) return;
    const target = pendingScroll.current;
    const skip = firstLoad.current && !paneScrolls();
    firstLoad.current = false;
    requestAnimationFrame(() => {
      if (!skip) scrollToTarget(target);
      pendingScroll.current = null;
    });
  }, [data, isPlaceholderData, scrollToTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep the month picker on the day at the top of the agenda. */
  const ticking = useRef(false);
  const onPaneScroll = () => {
    if (ticking.current || !paneScrolls()) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const pane = paneRef.current;
      if (!pane) return;
      const top = pane.getBoundingClientRect().top + 56;
      const day = [...pane.querySelectorAll<HTMLElement>("[data-day]")].find((d) => d.getBoundingClientRect().bottom > top);
      const key = day?.dataset.day;
      if (!key) return;
      setFocusKey(key);
      const ym = ymOfKey(key);
      setViewMonth((cur) => (ymIndex(cur) === ymIndex(ym) ? cur : ym));
    });
  };

  const inWindow = (ym: YearMonth) => ymIndex(ym) >= ymIndex(windowStart) && ymIndex(ym) < ymIndex(windowEnd);

  /* Scroll the agenda to a day key or "now", loading a new window first when it is outside this one. */
  const jumpTo = (key: string, target = key) => {
    const ym = ymOfKey(key);
    setFocusKey(key);
    setViewMonth(ym);
    if (inWindow(ym)) {
      scrollToTarget(target);
    } else {
      pendingScroll.current = target;
      setAnchor(ym);
    }
  };

  /* The "Show <month>" buttons at either end of the agenda: put that month at the near edge of the next window. */
  const extend = (ym: YearMonth) => {
    const key = keyOf(ym.y, ym.m, 1);
    pendingScroll.current = key;
    setFocusKey(key);
    setViewMonth(ym);
    setAnchor(addMonths(ym, ymIndex(ym) > ymIndex(anchor) ? 1 : -2));
  };

  const menu = (b: MentorshipBookingRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More options for the session with ${b.studentName}`}>
          <MoreHorizontal size={16} />
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

  const renderEvent = (b: MentorshipBookingRow) => {
    const start = new Date(b.scheduledAt);
    const end = new Date(start.getTime() + b.durationMinutes * 60000);
    const cancelled = b.status === "cancelled";
    const live = b.status === "scheduled" && start <= now && now < end;
    const done = !cancelled && !live && (b.status !== "scheduled" || end <= now);
    const chip = cancelled
      ? { label: "Cancelled", tone: styles.chipMuted }
      : b.status === "completed"
        ? { label: "Completed", tone: styles.chipSage }
        : b.status === "no_show"
          ? { label: "No-show", tone: styles.chipButter }
          : live
            ? { label: "Happening now", tone: styles.chipMint }
            : null;
    return (
      <li
        key={b.id}
        className={[styles.event, styles[`kind_${b.kind}`], done ? styles.eventDone : "", cancelled ? styles.eventCancelled : ""].join(" ")}
      >
        <span className={styles.eventTime}>
          {timeOf(start)} - {timeOf(end)}
        </span>
        <div className={styles.eventBody}>
          <p className={styles.eventTitle}>
            <span className={styles.eventName}>{b.studentName}</span>
            <span className={styles.eventKind}>
              {KIND_LABEL[b.kind]}, {b.durationMinutes} min
            </span>
          </p>
          {chip && <span className={`${styles.chip} ${chip.tone}`}>{chip.label}</span>}
          {b.cancellationReason && <p className={styles.eventNote}>{b.cancellationReason}</p>}
        </div>
        {b.status === "scheduled" && (
          <div className={styles.eventActions}>
            {end > now && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/mentorship/classroom/booking/${b.id}`}>
                  <Video size={14} aria-hidden="true" /> Classroom
                </Link>
              </Button>
            )}
            {menu(b)}
          </div>
        )}
      </li>
    );
  };

  const nowLine = (
    <li key="now" className={styles.now} data-now="">
      <span className={styles.nowLabel}>{timeOf(now)}</span>
      <span className={styles.nowRule} aria-hidden="true" />
    </li>
  );

  const renderDay = ({ key, rows }: { key: string; rows: MentorshipBookingRow[] }) => {
    const isToday = key === todayKey;
    const items: React.ReactNode[] = [];
    let placedNow = !isToday;
    for (const b of rows) {
      if (!placedNow && new Date(b.scheduledAt) > now) {
        items.push(nowLine);
        placedNow = true;
      }
      items.push(renderEvent(b));
    }
    if (!placedNow) items.push(nowLine);
    return (
      <div
        key={key}
        data-day={key}
        className={`${styles.day} ${key === focusKey ? styles.dayFocus : ""} ${key < todayKey ? styles.dayPast : ""}`}
      >
        <div className={styles.dayGutter}>
          <span className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ""}`}>{Number(key.slice(8))}</span>
          <span className={styles.dayWeekday}>{isToday ? "Today" : weekdayOfKey(key)}</span>
        </div>
        <ol className={styles.events} aria-label={longDateOfKey(key)}>
          {items}
          {rows.length === 0 && <li className={styles.emptyDay}>Nothing booked today</li>}
        </ol>
      </div>
    );
  };

  const firstMonth = windowStart;
  const lastMonth = addMonths(windowEnd, -1);
  const bookingCount = visible.length;

  return (
    <>
      <Helmet>
        <title>1:1 Bookings - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader title="1:1 bookings" description="Sessions learners have booked with you. Times are in IST.">
          <Button variant="outline" asChild>
            <Link to="/teacher/mentorship">
              <Settings2 size={16} aria-hidden="true" /> Prices and hours
            </Link>
          </Button>
        </ConsolePageHeader>

        <div className={styles.board}>
          <aside className={styles.rail}>
            <LiveMonthPicker
              month={viewMonth}
              todayKey={todayKey}
              focusKey={focusKey}
              dots={dots}
              onMonth={showMonth}
              onPick={(key) => jumpTo(key)}
              onToday={() => jumpTo(todayKey, "now")}
            />
            <div className={styles.key}>
              <ul className={styles.legend} aria-label="Colours">
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <li key={k}>
                    <span className={`${styles.swatch} ${styles[`kind_${k}`]}`} aria-hidden="true" />
                    {KIND_LABEL[k]}
                  </li>
                ))}
              </ul>
              <label className={styles.toggle}>
                <Checkbox checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                Show cancelled sessions
              </label>
            </div>
            <TeacherPackagesSection />
          </aside>

          <div
            className={styles.pane}
            ref={paneRef}
            onScroll={onPaneScroll}
            aria-busy={isFetching}
            tabIndex={0}
            role="region"
            aria-label="Booked sessions"
          >
            {!data ? (
              <div className={styles.loading}>
                <Skeleton style={{ height: "1.5rem", width: "10rem" }} />
                <Skeleton style={{ height: "4.5rem", width: "100%", borderRadius: "1rem" }} />
                <Skeleton style={{ height: "4.5rem", width: "100%", borderRadius: "1rem" }} />
              </div>
            ) : (
              <>
                <button type="button" className={styles.edgeButton} onClick={() => extend(addMonths(firstMonth, -1))}>
                  Show {monthTitle(addMonths(firstMonth, -1))}
                </button>
                {months.map(({ ym, days }) => (
                  <section key={ymIndex(ym)} className={styles.month}>
                    <h3 className={styles.monthHead}>{monthTitle(ym)}</h3>
                    {days.length > 0 ? days.map(renderDay) : <p className={styles.emptyMonth}>No sessions this month</p>}
                  </section>
                ))}
                {bookingCount === 0 && (
                  <p className={styles.emptyWindow}>
                    Learners book from your profile once 1:1 sessions are on and you have open hours.
                  </p>
                )}
                <button type="button" className={styles.edgeButton} onClick={() => extend(addMonths(lastMonth, 1))}>
                  Show {monthTitle(addMonths(lastMonth, 1))}
                </button>
              </>
            )}
          </div>
        </div>
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
