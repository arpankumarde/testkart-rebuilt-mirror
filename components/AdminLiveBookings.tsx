import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
  AlertTriangle,
  CalendarRange,
  CalendarCheck2,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Inbox,
  MoreHorizontal,
  Search,
  SearchX,
  Ticket,
  X,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { AdminLiveEmptyState } from "./AdminLiveEmptyState";
import { AdminLiveBookingDrawer } from "./AdminLiveBookingDrawer";
import { LiveAvatar, LiveKindBadge, LivePaymentPill, LiveStatusPill, copyText, rupees } from "./AdminLiveBits";
import { useAdminLiveBookingsQuery } from "../helpers/useAdminLiveModule";
import { addDays, dayKeyOf, dayStart, formatShortDate, formatTime, isDayKey, type DayKey } from "../helpers/liveCalendarDates";
import type { InputType as BookingsInput, LiveBookingRow } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import styles from "./AdminLiveBookings.module.css";

type StatusFilter = "all" | NonNullable<BookingsInput["status"]>;
type TypeFilter = "all" | "booking" | "group";

/* The list holds completed and cancelled bookings only; scheduled ones are on the Calendar. */
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "booking", label: "1:1 sessions" },
  { value: "group", label: "Group lessons" },
];

const PAGE_SIZES = [25, 50, 100];

export const AdminLiveBookings: React.FC<{ active: boolean; onOpenInCalendar: (row: LiveBookingRow) => void }> = ({
  active,
  onOpenInCalendar,
}) => {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session") ?? undefined;

  const [q, setQ] = useState("");
  const [debouncedQ] = useDebounce(q.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<LiveBookingRow | null>(null);

  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);

  const input: BookingsInput = useMemo(
    () => ({
      q: debouncedQ || undefined,
      status: status === "all" ? undefined : status,
      type: type === "all" ? undefined : type,
      sessionId,
      from: isDayKey(fromDay) ? dayStart(fromDay) : undefined,
      to: isDayKey(toDay) ? dayStart(addDays(toDay, 1)) : undefined,
      page,
      pageSize,
    }),
    [debouncedQ, status, type, sessionId, fromDay, toDay, page, pageSize]
  );

  useEffect(() => setPage(1), [debouncedQ, status, type, sessionId, fromDay, toDay, pageSize]);

  const { data, isLoading, isFetching, isError, refetch } = useAdminLiveBookingsQuery(input);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = !!q || status !== "all" || type !== "all" || !!fromDay || !!toDay || !!sessionId;

  const clearSession = () =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("session");
        return p;
      },
      { replace: true }
    );

  const resetFilters = () => {
    setQ("");
    setStatus("all");
    setType("all");
    setFromDay("");
    setToDay("");
    if (sessionId) clearSession();
  };

  const summary = data?.summary;
  const cards: { key: StatusFilter; label: string; value?: number; icon: React.ReactNode; tone: string }[] = [
    { key: "all", label: "Total bookings", value: summary?.total, icon: <Ticket />, tone: "peach" },
    { key: "completed", label: "Completed", value: summary?.completed, icon: <CalendarCheck2 />, tone: "sage" },
    { key: "cancelled", label: "Cancelled", value: summary?.cancelled, icon: <CalendarX2 />, tone: "rose" },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.cards}>
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`${styles.card} ${status === c.key ? styles.cardActive : ""}`}
            aria-pressed={status === c.key}
            onClick={() => setStatus(c.key)}
          >
            <span className={`${styles.cardIcon} ${styles[`tone_${c.tone}`]}`} aria-hidden="true">
              {c.icon}
            </span>
            <span className={styles.cardText}>
              <span className={styles.cardLabel}>{c.label}</span>
              {summary ? <span className={styles.cardValue}>{c.value?.toLocaleString("en-IN")}</span> : <Skeleton style={{ height: "1.375rem", width: "3rem" }} />}
            </span>
          </button>
        ))}
      </div>

      <section className={styles.panel} aria-labelledby="live-bookings-title">
        <h2 id="live-bookings-title" className={styles.srOnly}>
          Learner bookings
        </h2>

        <div className={styles.filters} role="search" aria-label="Filter bookings">
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search learner, teacher, session or booking ID"
              aria-label="Search bookings"
              className={styles.searchInput}
            />
            {q ? (
              <button type="button" className={styles.searchClear} onClick={() => setQ("")} aria-label="Clear search">
                <X />
              </button>
            ) : null}
          </div>
          <FilterSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} label="Booking status" options={STATUS_OPTIONS} />
          <FilterSelect value={type} onChange={(v) => setType(v as TypeFilter)} label="Session type" options={TYPE_OPTIONS} />
          <div className={styles.dates} role="group" aria-label="Session date range">
            <CalendarRange className={styles.datesIcon} aria-hidden="true" />
            <input
              type="date"
              value={fromDay}
              max={toDay || undefined}
              onChange={(e) => setFromDay(e.target.value)}
              aria-label="Sessions from"
            />
            <span className={styles.datesSep} aria-hidden="true">
              to
            </span>
            <input
              type="date"
              value={toDay}
              min={fromDay || undefined}
              onChange={(e) => setToDay(e.target.value)}
              aria-label="Sessions to"
            />
          </div>
          <button type="button" className={styles.clear} onClick={resetFilters} disabled={!filtersActive}>
            <X aria-hidden="true" /> Clear filters
          </button>
        </div>

        <p className={styles.scopeNote}>
          Completed and cancelled bookings. Scheduled sessions and those pending completion are on the Calendar.
        </p>

        {sessionId ? (
          <div className={styles.sessionChip}>
            Showing bookings for one session <code>{sessionId.slice(0, 8)}</code>
            <button type="button" onClick={clearSession} aria-label="Show bookings for all sessions">
              <X />
            </button>
          </div>
        ) : null}

        <div className={styles.results} aria-busy={isFetching}>
          {isError && !data ? (
            <AdminLiveEmptyState
              tone="peach"
              icon={<AlertTriangle />}
              title="Could not load bookings"
              description="Something went wrong fetching bookings."
              action={
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          ) : isLoading ? (
            <div className={styles.skeleton}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} style={{ height: "3.25rem", width: "100%", borderRadius: "0.625rem" }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            filtersActive ? (
              <AdminLiveEmptyState
                tone="powder"
                icon={<SearchX />}
                title="No bookings match"
                description="Try another search, status, type or date range."
                action={
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <AdminLiveEmptyState
                tone="mint"
                icon={<Inbox />}
                title="No completed or cancelled bookings yet"
                description="Bookings appear here once their session is marked completed or the booking is cancelled. Upcoming and pending sessions are on the Calendar."
              />
            )
          ) : (
            <table className={`${styles.table} ${isFetching ? styles.tableBusy : ""}`}>
              <thead>
                <tr>
                  <th scope="col" className={styles.colId}>Booking ID</th>
                  <th scope="col">Learner</th>
                  <th scope="col">Session</th>
                  <th scope="col" className={styles.colTeacher}>Teacher</th>
                  <th scope="col" className={styles.colBooked}>Booked on</th>
                  <th scope="col" className={styles.colWhen}>Session date &amp; time</th>
                  <th scope="col" className={styles.colType}>Type</th>
                  <th scope="col" className={styles.colPay}>Payment</th>
                  <th scope="col" className={styles.colStatus}>Status</th>
                  <th scope="col" className={styles.colActions}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <BookingRow key={`${r.type}-${r.id}`} row={r} onOpen={() => setSelected(r)} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && total > 0 ? (
          <footer className={styles.pager}>
            <span className={styles.pagerInfo}>
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total.toLocaleString("en-IN")}
            </span>
            <div className={styles.pagerControls}>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className={styles.pageSize} aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft />
              </button>
              <span className={styles.pageNum}>
                Page {page} of {pages}
              </span>
              <button type="button" className={styles.pageBtn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight />
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <AdminLiveBookingDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onOpenInCalendar={(r) => {
          setSelected(null);
          onOpenInCalendar(r);
        }}
      />
    </div>
  );
};

const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}> = ({ value, onChange, label, options }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className={styles.select} aria-label={label}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const BookingRow: React.FC<{ row: LiveBookingRow; onOpen: () => void }> = ({ row: r, onOpen }) => (
    <tr
      className={styles.row}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Booking ${r.id.slice(0, 8)} for ${r.studentName ?? "learner"}`}
    >
      <td className={styles.cellId} data-label="Booking ID">
        <span className={styles.mono} title={r.id}>
          {r.id.slice(0, 8)}
        </span>
      </td>
      <td className={styles.cellLearner} data-label="Learner">
        <span className={styles.person}>
          <LiveAvatar name={r.studentName} size="sm" tone="sage" />
          <span className={styles.stack}>
            <span className={styles.primary} title={r.studentName ?? undefined}>
              {r.studentName ?? "Unknown learner"}
            </span>
            {r.studentEmail ? (
              <span className={styles.secondary} title={r.studentEmail}>
                {r.studentEmail}
              </span>
            ) : null}
          </span>
        </span>
      </td>
      <td className={styles.cellSession} data-label="Session">
        <span className={styles.stack}>
          <span className={styles.primary} title={r.sessionTitle}>
            {r.type === "group" ? r.sessionTitle : "1:1 session"}
          </span>
          <span className={styles.secondary}>{r.durationMinutes} min</span>
        </span>
      </td>
      <td className={styles.cellTeacher} data-label="Teacher">
        <span className={styles.value} title={r.teacherName ?? undefined}>
          {r.teacherName ?? "-"}
        </span>
      </td>
      <td className={styles.cellBooked} data-label="Booked on">
        <span className={styles.stack}>
          <span className={styles.value}>{r.bookedAt ? formatShortDate(r.bookedAt) : "-"}</span>
          {r.bookedAt ? <span className={styles.secondary}>{formatTime(r.bookedAt)}</span> : null}
        </span>
      </td>
      <td className={styles.cellWhen} data-label="Session">
        <span className={styles.stack}>
          <span className={styles.value}>{formatShortDate(r.sessionStart)} {yearSuffix(r.sessionStart)}</span>
          <span className={styles.secondary}>{formatTime(r.sessionStart)}</span>
        </span>
      </td>
      <td className={styles.cellType} data-label="Type">
        <LiveKindBadge kind={r.type} withLabel />
      </td>
      <td className={styles.cellPay} data-label="Payment">
        <span className={styles.stack}>
          <span className={styles.amountLine}>
            <span className={styles.amount}>{rupees(r.amountPaid)}</span>
            {r.price !== r.amountPaid ? <span className={styles.secondary}>of {rupees(r.price)}</span> : null}
          </span>
          <LivePaymentPill status={r.paymentStatus} creditKind={r.creditKind} />
        </span>
      </td>
      <td className={styles.cellStatus} data-label="Status">
        <LiveStatusPill status={r.status} />
      </td>
      <td className={styles.cellActions} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-md" className={styles.menuButton} aria-label={`Actions for booking ${r.id.slice(0, 8)}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.menu}>
            <DropdownMenuItem className={styles.menuItem} onSelect={onOpen}>
              <Eye aria-hidden="true" /> View details
            </DropdownMenuItem>
            <DropdownMenuItem className={styles.menuItem} onSelect={() => copyText(r.id, "Booking ID")}>
              <Copy aria-hidden="true" /> Copy booking ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
);

const yearSuffix = (d: Date) => {
  const key: DayKey = dayKeyOf(d);
  const year = key.slice(0, 4);
  return year === dayKeyOf(Date.now()).slice(0, 4) ? "" : year;
};
