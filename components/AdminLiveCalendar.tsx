import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search, SearchX, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { AdminLiveEmptyState } from "./AdminLiveEmptyState";
import { AdminLiveSessionDrawer } from "./AdminLiveSessionDrawer";
import { LiveMonthPicker, ymOfKey, ymIndex, type LiveDotTone, type YearMonth } from "./LiveMonthPicker";
import { useAdminLiveCalendarQuery, useAdminLiveTeachersQuery } from "../helpers/useAdminLiveModule";
import {
  type CalendarView,
  type DayKey,
  dayKeyOf,
  dayOfMonth,
  formatDayLong,
  formatRangeLabel,
  formatTime,
  formatWeekdayShort,
  isDayKey,
  layoutOverlaps,
  minutesOfDay,
  monthOf,
  stepAnchor,
  todayKey,
  viewRange,
} from "../helpers/liveCalendarDates";
import { CALENDAR_EVENT_LIMIT, type LiveCalendarEvent } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import styles from "./AdminLiveCalendar.module.css";

/*
 * The admin Live Lessons calendar, built on the teacher 1:1 bookings calendar: the shared mini
 * month picker and a filters card on the left, the calendar card on the right, and the same
 * tinted event cards (1:1 blue, group lavender). Only sessions by teachers approved for live
 * teaching come back from the API. All dates are IST.
 */

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
type Filters = { q: string; status: StatusFilter; teacherId: string; kinds: { booking: boolean; group: boolean } };

const HOUR_PX = 64;
const MONTH_VISIBLE = 2;
const AGENDA_PAGE = 60;

const isView = (v: string | null): v is CalendarView => v === "day" || v === "week" || v === "month" || v === "agenda";

const eventName = (e: LiveCalendarEvent) => (e.kind === "booking" ? e.studentName ?? "1:1 session" : e.title);
const typeLabel = (e: LiveCalendarEvent) => (e.kind === "group" ? "Group" : "1:1");
const eventLabel = (e: LiveCalendarEvent) =>
  `${e.title}, ${formatTime(e.start)} to ${formatTime(e.end)}, ${e.teacherName ?? "unknown teacher"}, ${e.status}`;
const toneOf = (e: LiveCalendarEvent): LiveDotTone => (e.status === "cancelled" ? "muted" : e.kind === "group" ? "lavender" : "blue");

/* Session status chip: a scheduled session has none, except while it is happening. */
const chipOf = (e: LiveCalendarEvent, now: number) => {
  if (e.status === "cancelled") return { label: "Cancelled", cls: styles.chipMuted };
  if (e.status === "completed") return { label: "Completed", cls: styles.chipSage };
  if (e.status === "missed") return { label: "Missed", cls: styles.chipRose };
  const s = new Date(e.start).getTime();
  const end = new Date(e.end).getTime();
  if (s <= now && now < end) return { label: "Happening now", cls: styles.chipMint };
  return null;
};

const cardClass = (e: LiveCalendarEvent, now: number) =>
  [
    e.kind === "group" ? styles.kind_group : styles.kind_booking,
    e.status === "cancelled" || e.status === "missed" ? styles.isCancelled : "",
    e.status === "completed" || (e.status === "scheduled" && new Date(e.end).getTime() <= now) ? styles.isDone : "",
  ].join(" ");

export const AdminLiveCalendar: React.FC<{ active: boolean }> = ({ active }) => {
  const [params, setParams] = useSearchParams();
  const [fallbackView] = useState<CalendarView>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "agenda" : "week"
  );
  const view: CalendarView = isView(params.get("view")) ? (params.get("view") as CalendarView) : fallbackView;
  const anchor: DayKey = isDayKey(params.get("date")) ? (params.get("date") as DayKey) : todayKey();

  const [filters, setFilters] = useState<Filters>({ q: "", status: "all", teacherId: "all", kinds: { booking: true, group: true } });
  const [debouncedQ] = useDebounce(filters.q.trim(), 300);
  const [selected, setSelected] = useState<LiveCalendarEvent | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pickerMonth, setPickerMonth] = useState<YearMonth>(() => ymOfKey(anchor));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);
  const anchorMonth = ymIndex(ymOfKey(anchor));
  useEffect(() => setPickerMonth(ymOfKey(anchor)), [anchorMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const setNav = (next: { view?: CalendarView; date?: DayKey }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.view) p.set("view", next.view);
        if (next.date) p.set("date", next.date);
        return p;
      },
      { replace: true }
    );

  const apiFilters = {
    kinds: filters.kinds.booking && filters.kinds.group ? undefined : filters.kinds.booking ? "booking" : "group",
    status: filters.status === "all" ? undefined : filters.status,
    teacherId: filters.teacherId === "all" ? undefined : Number(filters.teacherId),
    q: debouncedQ || undefined,
  };

  const range = useMemo(() => viewRange(view, anchor), [view, anchor]);
  const { data, isLoading, isFetching, isError, refetch } = useAdminLiveCalendarQuery({ from: range.from, to: range.to, ...apiFilters });

  /* The mini picker's dots cover its own month; in month view this is the same request. */
  const pickerKey = `${pickerMonth.y}-${String(pickerMonth.m + 1).padStart(2, "0")}-01`;
  const pickerRange = useMemo(() => viewRange("month", pickerKey), [pickerKey]);
  const pickerQuery = useAdminLiveCalendarQuery({ from: pickerRange.from, to: pickerRange.to, ...apiFilters });
  const teachers = useAdminLiveTeachersQuery();

  const events = data?.events ?? [];
  const filtersActive =
    !!filters.q || filters.status !== "all" || filters.teacherId !== "all" || !filters.kinds.booking || !filters.kinds.group;
  const resetFilters = () => setFilters({ q: "", status: "all", teacherId: "all", kinds: { booking: true, group: true } });
  const toggleKind = (k: "booking" | "group") =>
    setFilters((prev) => {
      const kinds = { ...prev.kinds, [k]: !prev.kinds[k] };
      return kinds.booking || kinds.group ? { ...prev, kinds } : prev;
    });

  const byDay = useMemo(() => groupByDay(events), [events]);
  const pickerDots = useMemo(() => {
    const map = new Map<string, LiveDotTone[]>();
    for (const [key, list] of groupByDay(pickerQuery.data?.events ?? [])) map.set(key, list.map(toneOf));
    return map;
  }, [pickerQuery.data]);

  const openDay = (key: DayKey) => setNav({ view: "day", date: key });
  const today = todayKey();

  return (
    <div className={styles.root}>
      <section className={styles.board} aria-label="Live lessons calendar">
        <aside className={styles.rail}>
          <LiveMonthPicker
            month={pickerMonth}
            todayKey={today}
            focusKey={anchor}
            dots={pickerDots}
            onMonth={setPickerMonth}
            onPick={(key) => setNav({ date: key })}
            onToday={() => setNav({ date: todayKey() })}
          />

          <section className={styles.card} aria-labelledby="live-cal-filters">
            <div className={styles.cardHead}>
              <h2 id="live-cal-filters" className={styles.cardTitle}>
                Filters
              </h2>
              {filtersActive ? (
                <button type="button" className={styles.reset} onClick={resetFilters}>
                  <RotateCcw aria-hidden="true" /> Reset
                </button>
              ) : null}
            </div>

            <div className={styles.search}>
              <Search className={styles.searchIcon} aria-hidden="true" />
              <Input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Teacher or session"
                aria-label="Search sessions by teacher or session name"
                className={styles.searchInput}
              />
              {filters.q ? (
                <button type="button" className={styles.searchClear} onClick={() => setFilters((f) => ({ ...f, q: "" }))} aria-label="Clear search">
                  <X />
                </button>
              ) : null}
            </div>

            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as StatusFilter }))}>
              <SelectTrigger className={styles.select} aria-label="Session status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.teacherId} onValueChange={(v) => setFilters((f) => ({ ...f, teacherId: v }))}>
              <SelectTrigger className={styles.select} aria-label="Teacher">
                <SelectValue placeholder="All teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teachers.data?.teachers.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className={styles.legend} role="group" aria-label="Session type">
              {(["booking", "group"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filters.kinds[k]}
                  className={`${styles.legendRow} ${k === "group" ? styles.kind_group : styles.kind_booking} ${filters.kinds[k] ? "" : styles.legendOff}`}
                  onClick={() => toggleKind(k)}
                >
                  <span className={styles.swatch} aria-hidden="true" />
                  <span className={styles.legendLabel}>{k === "group" ? "Group lessons" : "1:1 sessions"}</span>
                  <span className={styles.legendState}>{filters.kinds[k] ? "Shown" : "Hidden"}</span>
                </button>
              ))}
            </div>
            <p className={styles.note}>Only sessions by teachers approved for live teaching appear here.</p>
          </section>
        </aside>

        <div className={styles.pane}>
          <header className={styles.toolbar}>
            <div className={styles.navGroup}>
              <Button variant="outline" size="sm" className={styles.todayBtn} onClick={() => setNav({ date: todayKey() })}>
                Today
              </Button>
              <div className={styles.arrows}>
                <button type="button" className={styles.arrow} aria-label="Previous" onClick={() => setNav({ date: stepAnchor(view, anchor, -1) })}>
                  <ChevronLeft />
                </button>
                <button type="button" className={styles.arrow} aria-label="Next" onClick={() => setNav({ date: stepAnchor(view, anchor, 1) })}>
                  <ChevronRight />
                </button>
              </div>
              <h2 className={styles.rangeLabel} aria-live="polite">
                {formatRangeLabel(view, anchor)}
              </h2>
              {isFetching && !isLoading ? <Loader2 className={styles.spinner} aria-label="Updating" /> : null}
            </div>
            <div className={styles.toolbarEnd}>
              <span className={styles.count}>
                {data ? `${events.length}${data.truncated ? "+" : ""} ${events.length === 1 ? "session" : "sessions"}` : " "}
                <span className={styles.tz}>IST</span>
              </span>
              <div className={styles.views} role="group" aria-label="Calendar view">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    aria-pressed={view === v.value}
                    className={`${styles.viewBtn} ${view === v.value ? styles.viewBtnActive : ""}`}
                    onClick={() => setNav({ view: v.value })}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {data?.truncated ? (
            <p className={styles.truncated}>
              Showing the first {CALENDAR_EVENT_LIMIT} sessions in this range. Narrow it with a shorter view or the filters.
            </p>
          ) : null}

          <div className={styles.stage}>
            {isError && !data ? (
              <AdminLiveEmptyState
                tone="peach"
                icon={<AlertTriangle />}
                title="Could not load the calendar"
                description="Something went wrong fetching sessions for this range."
                action={
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : isLoading ? (
              <CalendarSkeleton view={view} />
            ) : view === "month" ? (
              <MonthView days={range.days} anchor={anchor} byDay={byDay} now={now} onSelect={setSelected} onOpenDay={openDay} />
            ) : view === "agenda" ? (
              events.length === 0 ? (
                <AdminLiveEmptyState
                  tone={filtersActive ? "powder" : "mint"}
                  icon={filtersActive ? <SearchX /> : <CalendarPlus />}
                  title={filtersActive ? "No sessions match these filters" : "No sessions this month"}
                  description={
                    filtersActive ? "Try another teacher, status or search term." : "Approved teachers' 1:1 sessions and group lessons appear here once scheduled."
                  }
                  action={
                    filtersActive ? (
                      <Button size="sm" variant="outline" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <AgendaView days={range.days} byDay={byDay} now={now} onSelect={setSelected} />
              )
            ) : (
              <TimeGridView days={range.days} byDay={byDay} now={now} onSelect={setSelected} onOpenDay={openDay} detailed={view === "day"} />
            )}
          </div>

          {!isLoading && !isError && events.length === 0 && view !== "agenda" ? (
            <p className={styles.emptyNote}>
              {filtersActive ? "No sessions match these filters in this range." : "No sessions scheduled in this range."}
              {filtersActive ? (
                <button type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>

      <AdminLiveSessionDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

function groupByDay(events: LiveCalendarEvent[]) {
  const map = new Map<DayKey, LiveCalendarEvent[]>();
  const seen = new Set<string>();
  for (const e of events) {
    const uid = `${e.kind}:${e.id}`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const key = dayKeyOf(e.start);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

/* ---------- month ---------- */

const EventPill: React.FC<{ event: LiveCalendarEvent; now: number; onSelect: (e: LiveCalendarEvent) => void }> = ({ event: e, now, onSelect }) => (
  <button type="button" className={`${styles.pill} ${cardClass(e, now)}`} onClick={() => onSelect(e)} aria-label={eventLabel(e)} title={eventLabel(e)}>
    <span className={styles.pillLine}>
      <span className={styles.pillDot} aria-hidden="true" />
      <span className={styles.pillName}>{eventName(e)}</span>
    </span>
    <span className={styles.pillMeta}>
      <span className={styles.pillTime}>{formatTime(e.start)}</span>
      {` · ${typeLabel(e)}`}
      {e.teacherName ? ` · ${e.teacherName}` : ""}
    </span>
  </button>
);

const MonthView: React.FC<{
  days: DayKey[];
  anchor: DayKey;
  byDay: Map<DayKey, LiveCalendarEvent[]>;
  now: number;
  onSelect: (e: LiveCalendarEvent) => void;
  onOpenDay: (key: DayKey) => void;
}> = ({ days, anchor, byDay, now, onSelect, onOpenDay }) => {
  const today = todayKey();
  const month = monthOf(anchor);
  const weeks = useMemo(() => {
    const out: DayKey[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      if (week.some((d) => monthOf(d) === month)) out.push(week);
    }
    return out;
  }, [days, month]);

  return (
    <div className={styles.month}>
      <div className={styles.monthHead}>
        {days.slice(0, 7).map((d) => (
          <span key={d}>{formatWeekdayShort(d)}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {weeks.flat().map((d) => {
          const list = byDay.get(d) ?? [];
          const hidden = list.length - MONTH_VISIBLE;
          return (
            <div
              key={d}
              className={[styles.cell, monthOf(d) !== month ? styles.cellOut : "", d === today ? styles.cellToday : "", d === anchor ? styles.cellFocus : ""].join(" ")}
            >
              <button type="button" className={styles.cellDate} onClick={() => onOpenDay(d)} aria-label={`Open ${formatDayLong(d)}`}>
                {dayOfMonth(d)}
              </button>
              <div className={styles.cellEvents}>
                {list.slice(0, MONTH_VISIBLE).map((e) => (
                  <EventPill key={`${e.kind}-${e.id}`} event={e} now={now} onSelect={onSelect} />
                ))}
                {hidden > 0 ? <MoreButton day={d} events={list} count={hidden} now={now} onSelect={onSelect} onOpenDay={onOpenDay} /> : null}
              </div>
              {list.length ? (
                <button type="button" className={styles.cellDots} onClick={() => onOpenDay(d)} aria-label={`${list.length} sessions on ${formatDayLong(d)}`}>
                  {list.slice(0, 3).map((e) => (
                    <span key={`${e.kind}-${e.id}`} className={`${styles.miniDot} ${cardClass(e, now)}`} />
                  ))}
                  {list.length > 3 ? <span className={styles.miniMore}>+{list.length - 3}</span> : null}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MoreButton: React.FC<{
  day: DayKey;
  events: LiveCalendarEvent[];
  count: number;
  now: number;
  onSelect: (e: LiveCalendarEvent) => void;
  onOpenDay: (key: DayKey) => void;
}> = ({ day, events, count, now, onSelect, onOpenDay }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.more}>
          +{count} more
        </button>
      </PopoverTrigger>
      <PopoverContent className={styles.morePop} align="start">
        <div className={styles.morePopHead}>
          <p className={styles.morePopTitle}>{formatDayLong(day)}</p>
          <button
            type="button"
            className={styles.morePopLink}
            onClick={() => {
              setOpen(false);
              onOpenDay(day);
            }}
          >
            Open day
          </button>
        </div>
        <div className={styles.morePopList}>
          {events.map((e) => (
            <EventPill
              key={`${e.kind}-${e.id}`}
              event={e}
              now={now}
              onSelect={(ev) => {
                setOpen(false);
                onSelect(ev);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ---------- week / day ---------- */

const formatHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

const TimeGridView: React.FC<{
  days: DayKey[];
  byDay: Map<DayKey, LiveCalendarEvent[]>;
  now: number;
  onSelect: (e: LiveCalendarEvent) => void;
  onOpenDay: (key: DayKey) => void;
  detailed: boolean;
}> = ({ days, byDay, now, onSelect, onOpenDay, detailed }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const nowMin = minutesOfDay(now);

  const firstMin = useMemo(() => {
    let min = Infinity;
    for (const d of days) for (const e of byDay.get(d) ?? []) min = Math.min(min, minutesOfDay(e.start));
    return min;
  }, [days, byDay]);

  const daysKey = days.join(",");
  const firstKey = Number.isFinite(firstMin) ? firstMin : -1;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetMin = firstKey >= 0 ? Math.max(0, firstKey - 60) : days.includes(today) ? Math.max(0, nowMin - 120) : 8 * 60;
    const apply = () => {
      el.scrollTop = (targetMin / 60) * HOUR_PX;
    };
    if (el.clientHeight > 0) {
      apply();
      return;
    }
    // Mounted inside a hidden tab: scroll once it is shown.
    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0) {
        apply();
        ro.disconnect();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Only when the range or its first session changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey, firstKey]);

  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className={`${styles.grid} ${detailed ? styles.gridDay : ""}`} style={{ ["--cols" as string]: days.length, ["--hour" as string]: `${HOUR_PX}px` }}>
      <div className={styles.gridScroll} ref={scrollRef}>
        <div className={styles.gridHead}>
          <span className={styles.gutterHead} />
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={`${styles.dayHead} ${d === today ? styles.dayHeadToday : ""}`}
              onClick={() => onOpenDay(d)}
              disabled={detailed}
              aria-label={`Open ${formatDayLong(d)}`}
            >
              <span className={styles.dayHeadWeek}>{d === today ? "Today" : formatWeekdayShort(d)}</span>
              <span className={styles.dayHeadNum}>{dayOfMonth(d)}</span>
              {(byDay.get(d)?.length ?? 0) > 0 ? <span className={styles.dayHeadCount}>{byDay.get(d)!.length}</span> : null}
            </button>
          ))}
        </div>
        <div className={styles.gridBody} style={{ height: 24 * HOUR_PX }}>
          <div className={styles.gutter}>
            {hours.map((h) => (
              <span key={h} className={styles.hourLabel} style={{ top: h * HOUR_PX }}>
                {h === 0 ? "" : formatHour(h)}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d} events={byDay.get(d) ?? []} isToday={d === today} now={now} nowMin={nowMin} onSelect={onSelect} detailed={detailed} />
          ))}
        </div>
      </div>
    </div>
  );
};

const DayColumn: React.FC<{
  events: LiveCalendarEvent[];
  isToday: boolean;
  now: number;
  nowMin: number;
  onSelect: (e: LiveCalendarEvent) => void;
  detailed: boolean;
}> = ({ events, isToday, now, nowMin, onSelect, detailed }) => {
  const placed = useMemo(() => {
    const items = events.map((e) => {
      const startMin = minutesOfDay(e.start);
      const endMin = Math.min(24 * 60, startMin + Math.max(e.durationMinutes, 20));
      return { key: `${e.kind}-${e.id}`, startMin, endMin, e };
    });
    const layout = layoutOverlaps(items);
    return items.map((it) => ({ ...it, ...layout.get(it.key)! }));
  }, [events]);

  return (
    <div className={`${styles.dayCol} ${isToday ? styles.dayColToday : ""}`}>
      {placed.map(({ key, startMin, endMin, col, cols, e }) => {
        const height = ((endMin - startMin) / 60) * HOUR_PX - 3;
        const size = height >= 62 ? "roomy" : height >= 36 ? "mid" : "tight";
        const chip = detailed ? chipOf(e, now) : null;
        const meta = [
          typeLabel(e),
          e.teacherName,
          detailed ? (e.kind === "group" ? `${e.studentCount}/${e.maxCapacity ?? "-"} seats` : `${e.durationMinutes} min`) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <button
            key={key}
            type="button"
            className={`${styles.block} ${cardClass(e, now)} ${styles[`block_${size}`]}`}
            style={{
              top: (startMin / 60) * HOUR_PX + 1,
              height,
              left: `calc(${(col / cols) * 100}% + 3px)`,
              width: `calc(${100 / cols}% - 6px)`,
            }}
            onClick={() => onSelect(e)}
            aria-label={eventLabel(e)}
            title={eventLabel(e)}
          >
            {size === "tight" ? (
              <>
                <span className={styles.blockTime}>{formatTime(e.start)}</span>
                <span className={styles.blockName}>{eventName(e)}</span>
              </>
            ) : size === "mid" ? (
              <>
                <span className={styles.blockName}>{eventName(e)}</span>
                <span className={styles.blockMeta}>
                  <span className={styles.blockTime}>{formatTime(e.start)}</span> · {detailed ? meta : typeLabel(e)}
                </span>
              </>
            ) : (
              <>
                <span className={styles.blockTime}>
                  {formatTime(e.start)} - {formatTime(e.end)}
                </span>
                <span className={styles.blockName}>{eventName(e)}</span>
                <span className={styles.blockMeta}>{meta}</span>
                {chip && height >= 86 ? <span className={`${styles.chip} ${chip.cls}`}>{chip.label}</span> : null}
              </>
            )}
          </button>
        );
      })}
      {isToday ? (
        <span className={styles.nowLine} style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden="true" />
      ) : null}
    </div>
  );
};

/* ---------- agenda (the teacher calendar's day-by-day list) ---------- */

const AgendaView: React.FC<{
  days: DayKey[];
  byDay: Map<DayKey, LiveCalendarEvent[]>;
  now: number;
  onSelect: (e: LiveCalendarEvent) => void;
}> = ({ days, byDay, now, onSelect }) => {
  const [limit, setLimit] = useState(AGENDA_PAGE);
  const today = todayKey();
  const daysKey = days.join(",");
  useEffect(() => setLimit(AGENDA_PAGE), [daysKey]);

  let shown = 0;
  let total = 0;
  const groups: { day: DayKey; events: LiveCalendarEvent[] }[] = [];
  for (const d of days) {
    const list = byDay.get(d) ?? [];
    total += list.length;
    if (!list.length && d !== today) continue;
    if (shown >= limit) continue;
    const take = list.slice(0, limit - shown);
    shown += take.length;
    groups.push({ day: d, events: take });
  }

  return (
    <div className={styles.agenda}>
      {groups.map((g) => {
        const isToday = g.day === today;
        const items: React.ReactNode[] = [];
        let placedNow = !isToday;
        for (const e of g.events) {
          if (!placedNow && new Date(e.start).getTime() > now) {
            items.push(<NowRow key="now" now={now} />);
            placedNow = true;
          }
          items.push(<AgendaRow key={`${e.kind}-${e.id}`} event={e} now={now} onSelect={onSelect} />);
        }
        if (!placedNow) items.push(<NowRow key="now" now={now} />);
        return (
          <div key={g.day} className={`${styles.agendaDay} ${g.day < today ? styles.agendaDayPast : ""}`}>
            <div className={styles.agendaGutter}>
              <span className={`${styles.agendaNum} ${isToday ? styles.agendaNumToday : ""}`}>{dayOfMonth(g.day)}</span>
              <span className={styles.agendaWeekday}>{isToday ? "Today" : formatWeekdayShort(g.day)}</span>
            </div>
            <ol className={styles.agendaList} aria-label={formatDayLong(g.day)}>
              {items}
              {g.events.length === 0 ? <li className={styles.agendaEmpty}>Nothing scheduled today</li> : null}
            </ol>
          </div>
        );
      })}
      {shown < total ? (
        <div className={styles.agendaMore}>
          <span>
            Showing {shown} of {total}
          </span>
          <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + AGENDA_PAGE)}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const NowRow: React.FC<{ now: number }> = ({ now }) => (
  <li className={styles.nowRow} aria-hidden="true">
    <span className={styles.nowLabel}>{formatTime(now)}</span>
    <span className={styles.nowRule} />
  </li>
);

const AgendaRow: React.FC<{ event: LiveCalendarEvent; now: number; onSelect: (e: LiveCalendarEvent) => void }> = ({ event: e, now, onSelect }) => {
  const chip = chipOf(e, now);
  return (
    <li>
      <button type="button" className={`${styles.agendaEvent} ${cardClass(e, now)}`} onClick={() => onSelect(e)} aria-label={eventLabel(e)}>
        <span className={styles.agendaTime}>
          {formatTime(e.start)} - {formatTime(e.end)}
        </span>
        <span className={styles.agendaBody}>
          <span className={styles.agendaTitle}>
            <span className={styles.agendaName}>{eventName(e)}</span>
            <span className={styles.agendaKind}>
              {e.kind === "group" ? "Group lesson" : "1:1 session"}, {e.durationMinutes} min
            </span>
          </span>
          <span className={styles.agendaTeacher}>
            {e.teacherName ?? "Unknown teacher"} · {e.kind === "group" ? `${e.studentCount} of ${e.maxCapacity ?? "-"} seats booked` : "1 learner"}
          </span>
        </span>
        {chip ? <span className={`${styles.chip} ${chip.cls}`}>{chip.label}</span> : <span />}
      </button>
    </li>
  );
};

/* ---------- loading ---------- */

const CalendarSkeleton: React.FC<{ view: CalendarView }> = ({ view }) => {
  if (view === "agenda") {
    return (
      <div className={styles.skeletonList}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: "3.5rem", width: "100%", borderRadius: "0.875rem" }} />
        ))}
      </div>
    );
  }
  return (
    <div className={styles.skeletonGrid} data-view={view}>
      {Array.from({ length: view === "month" ? 35 : view === "week" ? 7 : 1 }).map((_, i) => (
        <Skeleton key={i} style={{ height: view === "month" ? "6rem" : "24rem", width: "100%", borderRadius: "0.75rem" }} />
      ))}
    </div>
  );
};
