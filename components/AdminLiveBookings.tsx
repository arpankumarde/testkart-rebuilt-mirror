import React, { useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Eye, Inbox, Search, SearchX, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { AdminLiveEmptyState } from "./AdminLiveEmptyState";
import { AdminLiveSessionDrawer } from "./AdminLiveSessionDrawer";
import { LivePaymentPill, LiveSessionStatusPill, rupees } from "./AdminLiveBits";
import { useAdminLiveBookingsQuery } from "../helpers/useAdminLiveModule";
import { addDays, dayKeyOf, dayStart, formatShortDate, formatTime, isDayKey, type DayKey } from "../helpers/liveCalendarDates";
import type { InputType as BookingsInput, LiveSessionListRow } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import styles from "./AdminLiveBookings.module.css";

const PAGE_SIZES = [25, 50, 100];

/* Every 1:1 session, newest first. The learner's attendance and payment details are in the session drawer. */
export const AdminLiveBookings: React.FC<{ active: boolean }> = ({ active }) => {
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebounce(q.trim(), 300);
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<LiveSessionListRow | null>(null);

  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);

  const input: BookingsInput = useMemo(
    () => ({
      q: debouncedQ || undefined,
      from: isDayKey(fromDay) ? dayStart(fromDay) : undefined,
      to: isDayKey(toDay) ? dayStart(addDays(toDay, 1)) : undefined,
      page,
      pageSize,
    }),
    [debouncedQ, fromDay, toDay, page, pageSize]
  );

  useEffect(() => setPage(1), [debouncedQ, fromDay, toDay, pageSize]);

  const { data, isLoading, isFetching, isError, refetch } = useAdminLiveBookingsQuery(input);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = !!q || !!fromDay || !!toDay;

  const resetFilters = () => {
    setQ("");
    setFromDay("");
    setToDay("");
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-labelledby="live-bookings-title">
        <h2 id="live-bookings-title" className={styles.srOnly}>
          Sessions
        </h2>

        <div className={styles.filters} role="search" aria-label="Search sessions">
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search learner, teacher, session or booking ID"
              aria-label="Search sessions"
              className={styles.searchInput}
            />
            {q ? (
              <button type="button" className={styles.searchClear} onClick={() => setQ("")} aria-label="Clear search">
                <X />
              </button>
            ) : null}
          </div>
          <div className={styles.dates} role="group" aria-label="Session date range">
            <CalendarRange className={styles.datesIcon} aria-hidden="true" />
            <input type="date" value={fromDay} max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)} aria-label="Sessions from" />
            <span className={styles.datesSep} aria-hidden="true">
              to
            </span>
            <input type="date" value={toDay} min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)} aria-label="Sessions to" />
          </div>
          {filtersActive ? (
            <button type="button" className={styles.clear} onClick={resetFilters}>
              <X aria-hidden="true" /> Clear
            </button>
          ) : null}
        </div>

        <div className={styles.results} aria-busy={isFetching}>
          {isError && !data ? (
            <AdminLiveEmptyState
              tone="peach"
              icon={<AlertTriangle />}
              title="Could not load sessions"
              description="Something went wrong fetching sessions."
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
                title="No sessions match"
                description="Try another search or date range."
                action={
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    Clear
                  </Button>
                }
              />
            ) : (
              <AdminLiveEmptyState tone="mint" icon={<Inbox />} title="No sessions yet" description="1:1 sessions appear here as soon as they are booked." />
            )
          ) : (
            <table className={`${styles.table} ${isFetching ? styles.tableBusy : ""}`}>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col" className={styles.colTeacher}>Teacher</th>
                  <th scope="col" className={styles.colStudents}>Learner</th>
                  <th scope="col" className={styles.colWhen}>Session date</th>
                  <th scope="col" className={styles.colPay}>Payment</th>
                  <th scope="col" className={styles.colStatus}>Session status</th>
                  <th scope="col" className={styles.colActions}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <SessionRow key={r.id} row={r} onOpen={() => setSelected(r)} />
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

      <AdminLiveSessionDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

const SessionRow: React.FC<{ row: LiveSessionListRow; onOpen: () => void }> = ({ row: r, onOpen }) => (
  <tr className={styles.row} onClick={onOpen}>
    <td className={styles.cellSession} data-label="Session">
      <span className={styles.stack}>
        <span className={styles.primary} title={r.title}>
          {r.title}
        </span>
        <span className={styles.secondary}>{r.durationMinutes} min</span>
      </span>
    </td>
    <td className={styles.cellTeacher} data-label="Teacher">
      <span className={styles.value} title={r.teacherName ?? undefined}>
        {r.teacherName ?? "-"}
      </span>
    </td>
    <td className={styles.cellStudents} data-label="Learner">
      <span className={styles.stack}>
        <span className={styles.value} title={r.studentName ?? undefined}>
          {r.studentName ?? "-"}
        </span>
        {r.isTrial ? <span className={styles.secondary}>Trial</span> : null}
      </span>
    </td>
    <td className={styles.cellWhen} data-label="Session date">
      <span className={styles.stack}>
        <span className={styles.value}>
          {formatShortDate(r.start)} {yearSuffix(r.start)}
        </span>
        <span className={styles.secondary}>{formatTime(r.start)}</span>
      </span>
    </td>
    <td className={styles.cellPay} data-label="Payment">
      <span className={styles.stack}>
        <span className={styles.amount}>{rupees(r.amountReceived)}</span>
        {r.paymentStatus ? (
          <LivePaymentPill status={r.paymentStatus} />
        ) : (
          <span className={styles.secondary}>{r.price > 0 ? "Not paid" : "Free"}</span>
        )}
      </span>
    </td>
    <td className={styles.cellStatus} data-label="Session status">
      <span className={styles.stack}>
        <LiveSessionStatusPill status={r.status} />
        {r.unmarked ? <span className={styles.secondary}>Ended, not marked yet</span> : null}
      </span>
    </td>
    <td className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" className={styles.viewButton} onClick={onOpen} aria-label={`View details of ${r.title}`}>
        <Eye aria-hidden="true" /> View
      </Button>
    </td>
  </tr>
);

const yearSuffix = (d: Date) => {
  const key: DayKey = dayKeyOf(d);
  const year = key.slice(0, 4);
  return year === dayKeyOf(Date.now()).slice(0, 4) ? "" : year;
};
