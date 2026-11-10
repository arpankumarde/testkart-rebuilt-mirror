import React, { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useMentorshipSlotsQuery } from "../helpers/useMentorship";
import { Skeleton } from "./Skeleton";
import styles from "./LiveSlotPicker.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
export const localDayKey = (d: Date) => new Intl.DateTimeFormat("en-CA").format(d);

/**
 * A teacher's open 1:1 times, grouped by day in the viewer's time zone. Selection is a list of
 * start times (ms). In "single" mode a pick replaces the last one; in "multi" mode picks toggle,
 * days that already hold a pick are greyed out (one class a day) and picking stops at maxSelected.
 */
export const LiveSlotPicker: React.FC<{
  teacherId: number;
  minutes: number;
  /** From useLiveSlotRange, so the picker and its caller share one slots request. */
  range: SlotRange;
  mode: "single" | "multi";
  selected: number[];
  onChange: (next: number[]) => void;
  maxSelected?: number;
  /** Days (localDayKey) that cannot take another class, e.g. ones already booked with this teacher. */
  busyDays?: Set<string>;
  title?: string;
  emptyText?: string;
  className?: string;
}> = ({ teacherId, minutes, range, mode, selected, onChange, maxSelected, busyDays, title = "Pick a time", emptyText, className }) => {
  const slotsQuery = useMentorshipSlotsQuery(teacherId, minutes, range.from, range.to);

  const byDay = useMemo(() => {
    const groups = new Map<string, Date[]>();
    for (const slot of slotsQuery.data?.slots ?? []) {
      const start = new Date(slot.startTime);
      if (start.getTime() >= range.to.getTime()) continue;
      const key = localDayKey(start);
      groups.set(key, [...(groups.get(key) ?? []), start]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slotsQuery.data, range.to]);

  const pickedDays = useMemo(() => new Set(selected.map((ms) => localDayKey(new Date(ms)))), [selected]);
  const full = maxSelected !== undefined && selected.length >= maxSelected;

  const toggle = (ms: number) => {
    if (mode === "single") return onChange([ms]);
    if (selected.includes(ms)) return onChange(selected.filter((s) => s !== ms));
    if (full) return;
    onChange([...selected, ms].sort((a, b) => a - b));
  };

  return (
    <section className={`${styles.picker} ${className ?? ""}`}>
      <h2 className={styles.title}>
        <CalendarDays size={16} aria-hidden="true" /> {title}
        <span className={styles.zone}>Your time zone</span>
      </h2>
      {slotsQuery.isLoading ? (
        <Skeleton style={{ height: "8rem", width: "100%" }} />
      ) : byDay.length === 0 ? (
        <p className={styles.empty}>{emptyText ?? "No open times right now. Please check back later."}</p>
      ) : (
        <div className={styles.dayList}>
          {byDay.map(([key, starts]) => {
            const dayTaken = mode === "multi" && (busyDays?.has(key) || (pickedDays.has(key) && !starts.some((s) => selected.includes(s.getTime()))));
            return (
              <div key={key} className={styles.dayGroup}>
                <p className={styles.dayLabel}>
                  {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(starts[0])}
                  {dayTaken && <span className={styles.dayNote}>One class a day</span>}
                </p>
                <div className={styles.slotGrid}>
                  {starts.map((start) => {
                    const ms = start.getTime();
                    const isSelected = selected.includes(ms);
                    const disabled = !isSelected && mode === "multi" && (dayTaken || pickedDays.has(key) || full);
                    return (
                      <button
                        key={ms}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={disabled}
                        className={`${styles.slot} ${isSelected ? styles.slotSelected : ""}`}
                        onClick={() => toggle(ms)}
                      >
                        {new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(start)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export type SlotRange = { from: Date; to: Date };

/** A window fixed at first render, so the slots query key stays stable. */
export const useLiveSlotRange = (days: number): SlotRange => {
  const [range] = useState(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + days * DAY_MS) };
  });
  return range;
};

/** The open start times in a window, for callers that fill picks automatically. */
export const useOpenSlotTimes = (teacherId: number, minutes: number, range: SlotRange) => {
  const slotsQuery = useMentorshipSlotsQuery(teacherId, minutes, range.from, range.to);
  return useMemo(
    () => new Set((slotsQuery.data?.slots ?? []).map((s) => new Date(s.startTime).getTime()).filter((ms) => ms < range.to.getTime())),
    [slotsQuery.data, range.to]
  );
};
