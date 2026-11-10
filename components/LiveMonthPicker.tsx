import React, { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import styles from "./LiveMonthPicker.module.css";

/*
 * The mini month calendar of the live lessons calendars (teacher 1:1 bookings and the admin
 * Live Lessons calendar): Monday-first, IST day keys ("YYYY-MM-DD"), up to three coloured dots
 * per day, arrow-key navigation and a Today button.
 */

export type YearMonth = { y: number; m: number };
export type LiveDotTone = "lavender" | "blue" | "sage" | "peach" | "butter" | "muted";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const ymOfKey = (key: string): YearMonth => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1 });
export const ymIndex = (ym: YearMonth) => ym.y * 12 + ym.m;
export const addMonthsYm = (ym: YearMonth, n: number): YearMonth => {
  const t = ymIndex(ym) + n;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
};

const utcOfKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const monthTitle = (ym: YearMonth) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ym.y, ym.m, 1)));

const longDateOfKey = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utcOfKey(key));

/* Six Monday-first weeks covering the month, as day keys. */
const monthGrid = ({ y, m }: YearMonth) => {
  const offset = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(y, m, 1 - offset + i));
    return keyOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  });
};

interface LiveMonthPickerProps {
  month: YearMonth;
  todayKey: string;
  focusKey: string;
  dots: Map<string, LiveDotTone[]>;
  onMonth: (ym: YearMonth) => void;
  onPick: (key: string) => void;
  onToday: () => void;
  className?: string;
}

export const LiveMonthPicker: React.FC<LiveMonthPickerProps> = ({ month, todayKey, focusKey, dots, onMonth, onPick, onToday, className }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => monthGrid(month), [month]);
  const inMonth = (key: string) => ymIndex(ymOfKey(key)) === ymIndex(month);
  const tabKey = cells.includes(focusKey) && inMonth(focusKey) ? focusKey : cells.find(inMonth)!;

  const moveFocus = (from: string, days: number) => {
    const d = utcOfKey(from);
    d.setUTCDate(d.getUTCDate() + days);
    const next = keyOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    onPick(next);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${next}"]`)?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    moveFocus(key, step);
  };

  return (
    <section className={`${styles.picker} ${className ?? ""}`} aria-label="Pick a day">
      <div className={styles.pickerHead}>
        <h2 className={styles.pickerTitle} aria-live="polite">
          {monthTitle(month)}
        </h2>
        <Button variant="ghost" size="icon-md" aria-label="Previous month" onClick={() => onMonth(addMonthsYm(month, -1))}>
          <ChevronLeft size={18} />
        </Button>
        <Button variant="ghost" size="icon-md" aria-label="Next month" onClick={() => onMonth(addMonthsYm(month, 1))}>
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className={styles.grid} ref={gridRef}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday} aria-hidden="true">
            {w.charAt(0)}
          </span>
        ))}
        {cells.map((key) => {
          const tones = dots.get(key) ?? [];
          const label = `${longDateOfKey(key)}${tones.length ? `, ${tones.length} session${tones.length === 1 ? "" : "s"}` : ""}`;
          return (
            <button
              key={key}
              type="button"
              data-key={key}
              tabIndex={key === tabKey ? 0 : -1}
              className={[
                styles.cell,
                inMonth(key) ? "" : styles.cellOutside,
                key === todayKey ? styles.cellToday : "",
                key === focusKey ? styles.cellFocus : "",
              ].join(" ")}
              aria-label={label}
              aria-current={key === todayKey ? "date" : undefined}
              onClick={() => onPick(key)}
              onKeyDown={(e) => onKeyDown(e, key)}
            >
              <span className={styles.cellNum}>{Number(key.slice(8))}</span>
              <span className={styles.dots} aria-hidden="true">
                {tones.slice(0, 3).map((t, i) => (
                  <span key={i} className={`${styles.dot} ${styles[`tone_${t}`]}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <Button variant="outline" size="sm" className={styles.todayButton} onClick={onToday}>
        Today
      </Button>
    </section>
  );
};