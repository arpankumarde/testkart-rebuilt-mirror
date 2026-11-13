import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Repeat, X } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { LiveSlotPicker, localDayKey, SlotRange } from "./LiveSlotPicker";
import { useMentorshipSlotsQuery } from "../helpers/useMentorship";
import { useCreditScheduleManyMutation } from "../helpers/useLivePackages";
import type { LivePackageView } from "../endpoints/mentorship/packages/list_GET.schema";
import styles from "./LivePackageScheduler.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const SINGLE_RANGE_DAYS = 35;
const fmtTime = new Intl.DateTimeFormat("en-IN", { timeStyle: "short" });
const fmtDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmtWeekday = new Intl.DateTimeFormat("en-IN", { weekday: "short" });
const fmtWeekdayLong = new Intl.DateTimeFormat("en-IN", { weekday: "long" });

type Pattern = { key: string; weekday: number; times: number[] };

/**
 * Picks times for a package's paid classes. By default the student picks a weekday and a time once
 * ("Monday 10:00") and every free week of that slot is filled; switching "Same time every week" off
 * picks single dates instead. Slots come from the teacher's 1:1 hours minus bookings, live course
 * and group classes, and the server checks every time again before booking.
 */
export const LivePackageScheduler: React.FC<{
  pkg: LivePackageView;
  /** Called after a booking round with how many paid classes still need a time. */
  onDone?: (waiting: number) => void;
}> = ({ pkg, onDone }) => {
  const waiting = pkg.waitingCredits.length;
  const [weekly, setWeekly] = useState(waiting >= 2);
  const [picks, setPicks] = useState<string[]>([]);
  const [singles, setSingles] = useState<number[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const schedule = useCreditScheduleManyMutation();

  const [weeklyRange] = useState<SlotRange>(() => {
    const from = new Date();
    const cycleEnd = pkg.cycle ? new Date(pkg.cycle.endsAt).getTime() : 0;
    const to = cycleEnd > from.getTime() + 7 * DAY_MS ? cycleEnd : from.getTime() + 28 * DAY_MS;
    return { from, to: new Date(to) };
  });
  const [singleRange] = useState<SlotRange>(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + SINGLE_RANGE_DAYS * DAY_MS) };
  });
  const slotsQuery = useMentorshipSlotsQuery(pkg.teacher.id, pkg.classMinutes, weeklyRange.from, weeklyRange.to);
  const busyDays = useMemo(() => new Set(pkg.upcoming.map((b) => localDayKey(new Date(b.scheduledAt)))), [pkg.upcoming]);

  const patterns = useMemo(() => {
    const map = new Map<string, Pattern>();
    for (const slot of slotsQuery.data?.slots ?? []) {
      const d = new Date(slot.startTime);
      if (d.getTime() >= weeklyRange.to.getTime() || busyDays.has(localDayKey(d))) continue;
      const key = `${d.getDay()}-${d.getHours() * 60 + d.getMinutes()}`;
      const p = map.get(key) ?? { key, weekday: d.getDay(), times: [] };
      p.times.push(d.getTime());
      map.set(key, p);
    }
    for (const p of map.values()) p.times.sort((a, b) => a - b);
    return map;
  }, [slotsQuery.data, weeklyRange.to, busyDays]);

  const days = useMemo(() => {
    const set = new Set(Array.from(patterns.values()).map((p) => p.weekday));
    return Array.from(set).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  }, [patterns]);
  const shownDay = activeDay !== null && days.includes(activeDay) ? activeDay : (days[0] ?? null);
  const dayTimes = useMemo(
    () =>
      Array.from(patterns.values())
        .filter((p) => p.weekday === shownDay)
        .sort((a, b) => {
          const am = new Date(a.times[0]);
          const bm = new Date(b.times[0]);
          return am.getHours() * 60 + am.getMinutes() - (bm.getHours() * 60 + bm.getMinutes());
        }),
    [patterns, shownDay]
  );
  const mostWeeks = Math.max(0, ...dayTimes.map((p) => p.times.length));

  const chosen = useMemo(() => {
    let left = waiting;
    return picks
      .map((key) => patterns.get(key))
      .filter((p): p is Pattern => !!p)
      .map((p) => {
        const times = p.times.slice(0, Math.max(0, left));
        left -= times.length;
        return { ...p, first: p.times[0], times };
      });
  }, [picks, patterns, waiting]);

  const weeklyTimes = chosen.flatMap((p) => p.times);
  const selected = weekly ? weeklyTimes : singles;
  const remaining = waiting - selected.length;
  const pickedDays = new Set(chosen.map((p) => p.weekday));

  const pickPattern = (p: Pattern) => {
    const current = picks.find((k) => patterns.get(k)?.weekday === p.weekday);
    if (current === p.key) return setPicks(picks.filter((k) => k !== p.key));
    if (!current && remaining <= 0) return;
    setPicks([...picks.filter((k) => k !== current), p.key]);
    const nextDay = days.find((d) => d !== p.weekday && !pickedDays.has(d) && ((d + 6) % 7) > ((p.weekday + 6) % 7));
    if (nextDay !== undefined && remaining - p.times.length > 0) setActiveDay(nextDay);
  };

  const book = () =>
    schedule.mutate(
      { packageId: pkg.id, startTimes: selected.map((ms) => new Date(ms)) },
      {
        onSuccess: (r) => {
          setPicks([]);
          setSingles([]);
          if (r.skipped.length > 0) {
            toast.warning(
              `${r.booked.length} class${r.booked.length === 1 ? "" : "es"} booked. ${r.skipped.length} time${r.skipped.length === 1 ? " was" : "s were"} just taken, please pick ${r.skipped.length === 1 ? "it" : "them"} again.`
            );
          } else {
            toast.success(r.waiting > 0 ? `${r.booked.length} classes booked. ${r.waiting} still need a time.` : "All your classes are booked.");
          }
          onDone?.(r.waiting);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not book these classes."),
      }
    );

  if (waiting === 0) return null;

  return (
    <div className={styles.scheduler}>
      <div className={styles.head}>
        <p className={styles.counter} aria-live="polite">
          {remaining > 0 ? `Pick ${remaining} more class${remaining > 1 ? "es" : ""}` : "All classes picked"}
          <span className={styles.counterSub}>
            {selected.length} of {waiting}
          </span>
        </p>
        {waiting >= 2 && (
          <label className={styles.repeat}>
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            <Repeat size={14} aria-hidden="true" /> Same time every week
          </label>
        )}
      </div>

      {weekly ? (
        <section className={styles.card}>
          <h3 className={styles.title}>
            <CalendarDays size={16} aria-hidden="true" /> Pick a day, then a time
            <span className={styles.zone}>Your time zone</span>
          </h3>
          {slotsQuery.isLoading ? (
            <Skeleton style={{ height: "8rem", width: "100%" }} />
          ) : days.length === 0 ? (
            <p className={styles.empty}>{pkg.teacher.displayName} has no open times in the next 4 weeks.</p>
          ) : (
            <>
              <div className={styles.days} role="tablist" aria-label="Day of the week">
                {days.map((d) => {
                  const sample = Array.from(patterns.values()).find((p) => p.weekday === d);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="tab"
                      aria-selected={shownDay === d}
                      className={`${styles.day} ${shownDay === d ? styles.dayOn : ""} ${pickedDays.has(d) ? styles.dayPicked : ""}`}
                      onClick={() => setActiveDay(d)}
                    >
                      {sample ? fmtWeekday.format(new Date(sample.times[0])) : d}
                      {pickedDays.has(d) && <Check size={12} aria-label="picked" />}
                    </button>
                  );
                })}
              </div>
              <div className={styles.times}>
                {dayTimes.map((p) => {
                  const on = picks.includes(p.key);
                  const blocked = !on && !pickedDays.has(p.weekday) && remaining <= 0;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      disabled={blocked}
                      className={`${styles.time} ${on ? styles.timeOn : ""}`}
                      onClick={() => pickPattern(p)}
                    >
                      {fmtTime.format(new Date(p.times[0]))}
                      {p.times.length < mostWeeks && <span className={styles.timeNote}>{p.times.length} wk</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {chosen.length > 0 && (
            <ul className={styles.picked}>
              {chosen.map((p) => (
                <li key={p.key} className={styles.pickedRow}>
                  <div>
                    <p className={styles.pickedTitle}>
                      Every {fmtWeekdayLong.format(new Date(p.first))} at {fmtTime.format(new Date(p.first))}
                    </p>
                    <p className={styles.pickedDates}>
                      {p.times.length > 0 ? p.times.map((ms) => fmtDay.format(new Date(ms))).join(", ") : "No classes left to book"}
                    </p>
                  </div>
                  <button type="button" className={styles.remove} aria-label="Remove" onClick={() => setPicks(picks.filter((k) => k !== p.key))}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <LiveSlotPicker
          teacherId={pkg.teacher.id}
          minutes={pkg.classMinutes}
          range={singleRange}
          mode="multi"
          selected={singles}
          onChange={setSingles}
          maxSelected={waiting}
          busyDays={busyDays}
          title={`Times with ${pkg.teacher.displayName}`}
        />
      )}

      <div className={styles.cta}>
        <Button size="lg" disabled={selected.length === 0 || schedule.isPending} onClick={book}>
          {schedule.isPending ? "Booking..." : selected.length === 0 ? "Book classes" : `Book ${selected.length} class${selected.length === 1 ? "" : "es"}`}
        </Button>
        {selected.length > 0 && remaining > 0 && <p className={styles.note}>The other {remaining} stay paid. Pick their times any time.</p>}
      </div>
    </div>
  );
};