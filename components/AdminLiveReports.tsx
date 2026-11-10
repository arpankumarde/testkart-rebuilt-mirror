import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  Flag,
  MoreHorizontal,
  Search,
  SearchX,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./DropdownMenu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./Sheet";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { AdminLiveEmptyState } from "./AdminLiveEmptyState";
import { LiveAvatar, copyText } from "./AdminLiveBits";
import { useAdminLiveIssuesQuery, useAdminResolveLiveIssueMutation } from "../helpers/useLivePackages";
import { formatRupees } from "../helpers/livePricing";
import { ISSUE_REPORT_WINDOW_HOURS } from "../helpers/liveLessonConfig";
import { dayKeyOf, formatDateTime, formatDuration, formatShortDate, formatTime, type DayKey } from "../helpers/liveCalendarDates";
import type { LiveIssueRow } from "../endpoints/admin/live-lessons/issues_GET.schema";
import styles from "./AdminLiveReports.module.css";

/*
 * Reports & Issues: the live lessons problems an admin has to settle. The only kind the backend
 * records today is a learner's "teacher did not come" report on a paid 1:1 class, stored on the
 * booking itself, so the report id is the booking id. Its workflow is Open, then Resolved by
 * giving the class back or rejecting the report (resolve-issue endpoint).
 */

type StatusFilter = "all" | "open" | "resolved";
type Resolution = "refunded" | "rejected";

const ISSUE_TYPES = [{ value: "teacher_no_show", label: "Teacher no-show" }] as const;

const resolutionLabel = (r: LiveIssueRow["resolution"]) =>
  r === "refunded" ? "Class given back" : r === "rejected" ? "Rejected, teacher paid" : null;

export const AdminLiveReports: React.FC<{ active: boolean; onOpenInCalendar: (day: DayKey) => void }> = ({ active, onOpenInCalendar }) => {
  const open = useAdminLiveIssuesQuery({ status: "open" });
  const resolved = useAdminLiveIssuesQuery({ status: "resolved" });
  const resolve = useAdminResolveLiveIssueMutation();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<string>("all");
  const [selected, setSelected] = useState<LiveIssueRow | null>(null);
  const [target, setTarget] = useState<{ row: LiveIssueRow; resolution: Resolution } | null>(null);

  useEffect(() => {
    if (!active) {
      setSelected(null);
      setTarget(null);
    }
  }, [active]);

  const isLoading = open.isLoading || resolved.isLoading;
  const isError = (open.isError && !open.data) || (resolved.isError && !resolved.data);
  const openRows = open.data?.issues ?? [];
  const resolvedRows = resolved.data?.issues ?? [];

  const rows = useMemo(() => {
    const base = status === "open" ? openRows : status === "resolved" ? resolvedRows : [...openRows, ...resolvedRows];
    const needle = q.trim().toLowerCase();
    return base
      .filter((r) => type === "all" || type === "teacher_no_show")
      .filter(
        (r) =>
          !needle ||
          [r.bookingId, r.teacherName, r.studentName, r.note].some((v) => v && String(v).toLowerCase().includes(needle))
      )
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [openRows, resolvedRows, status, type, q]);

  const filtersActive = !!q || status !== "all" || type !== "all";
  const clearFilters = () => {
    setQ("");
    setStatus("all");
    setType("all");
  };

  /* Keep the open drawer in step after a resolution moves the report between lists. */
  const current = selected ? [...openRows, ...resolvedRows].find((r) => r.bookingId === selected.bookingId) ?? selected : null;

  return (
    <section className={styles.panel} aria-labelledby="live-reports-title">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id="live-reports-title" className={styles.title}>
            Reports &amp; issues
          </h2>
          <p className={styles.subtitle}>
            Learners can report a teacher no-show on a paid 1:1 class up to {ISSUE_REPORT_WINDOW_HOURS}h after it ends.
          </p>
        </div>
        <span className={`${styles.openCount} ${openRows.length ? styles.openCountOn : ""}`}>
          {open.data ? openRows.length : "-"} open
        </span>
      </header>

      <div className={styles.filters} role="search" aria-label="Filter reports">
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teacher, learner, report ID or note"
            aria-label="Search reports"
            className={styles.searchInput}
          />
          {q ? (
            <button type="button" className={styles.searchClear} onClick={() => setQ("")} aria-label="Clear search">
              <X />
            </button>
          ) : null}
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className={styles.select} aria-label="Report status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={styles.select} aria-label="Issue type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All issue types</SelectItem>
            {ISSUE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="button" className={styles.clear} onClick={clearFilters} disabled={!filtersActive}>
          <X aria-hidden="true" /> Clear filters
        </button>
      </div>

      <div className={styles.results}>
        {isError ? (
          <AdminLiveEmptyState
            tone="peach"
            icon={<AlertTriangle />}
            title="Could not load reports"
            description="Something went wrong fetching reported issues."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  open.refetch();
                  resolved.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isLoading ? (
          <div className={styles.skeleton}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: "3.25rem", width: "100%", borderRadius: "0.625rem" }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtersActive && openRows.length + resolvedRows.length > 0 ? (
            <AdminLiveEmptyState
              tone="powder"
              icon={<SearchX />}
              title="No reports match"
              description="Try another search, status or issue type."
              action={
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <AdminLiveEmptyState tone="mint" icon={<ShieldCheck />} title="No reported issues right now." />
          )
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colId}>Report ID</th>
                <th scope="col" className={styles.colType}>Report type</th>
                <th scope="col">Teacher</th>
                <th scope="col">Learner</th>
                <th scope="col" className={styles.colSession}>Related session</th>
                <th scope="col" className={styles.colWhen}>Reported on</th>
                <th scope="col" className={styles.colStatus}>Status</th>
                <th scope="col" className={styles.colActions}>
                  <span className={styles.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ReportRow
                  key={r.bookingId}
                  row={r}
                  onOpen={() => setSelected(r)}
                  onResolve={(resolution) => setTarget({ row: r, resolution })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ReportDrawer
        row={current}
        onClose={() => setSelected(null)}
        onResolve={(resolution) => current && setTarget({ row: current, resolution })}
        onOpenInCalendar={(day) => {
          setSelected(null);
          onOpenInCalendar(day);
        }}
      />

      <ConsoleConfirmDialog
        open={!!target}
        onOpenChange={(isOpen) => !isOpen && setTarget(null)}
        title={target?.resolution === "refunded" ? "Give the class back to the student?" : "Reject this report?"}
        description={
          target?.resolution === "refunded"
            ? "The teacher is not paid for it. A package class goes back into the package; a trial's price goes to the student's live class balance. The student is emailed."
            : "The class stands and the teacher is paid for it."
        }
        tone={target?.resolution === "refunded" ? "default" : "destructive"}
        confirmLabel={target?.resolution === "refunded" ? "Give class back" : "Reject"}
        pendingLabel="Saving..."
        isPending={resolve.isPending}
        onConfirm={() => {
          if (!target) return;
          resolve.mutate(
            { bookingId: target.row.bookingId, resolution: target.resolution },
            {
              onSuccess: () => {
                toast.success("Report settled.");
                setTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not settle the report."),
            }
          );
        }}
      />
    </section>
  );
};

const StatusPill: React.FC<{ row: LiveIssueRow }> = ({ row }) =>
  row.resolution ? (
    <span className={`${styles.pill} ${styles.pillResolved}`}>
      <span className={styles.dot} aria-hidden="true" />
      Resolved
    </span>
  ) : (
    <span className={`${styles.pill} ${styles.pillOpen}`}>
      <span className={styles.dot} aria-hidden="true" />
      Open
    </span>
  );

const ReportRow: React.FC<{ row: LiveIssueRow; onOpen: () => void; onResolve: (r: Resolution) => void }> = ({ row: r, onOpen, onResolve }) => (
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
    aria-label={`Report ${r.bookingId.slice(0, 8)}: ${r.teacherName} with ${r.studentName}`}
  >
    <td className={styles.cellId} data-label="Report ID">
      <span className={styles.mono} title={r.bookingId}>
        {r.bookingId.slice(0, 8)}
      </span>
    </td>
    <td className={styles.cellType} data-label="Report type">
      <span className={styles.typeChip}>
        <Flag aria-hidden="true" /> Teacher no-show
      </span>
    </td>
    <td className={styles.cellTeacher} data-label="Teacher">
      <span className={styles.person}>
        <LiveAvatar name={r.teacherName} size="sm" />
        <span className={styles.primary} title={r.teacherName}>
          {r.teacherName}
        </span>
      </span>
    </td>
    <td className={styles.cellLearner} data-label="Learner">
      <span className={styles.person}>
        <LiveAvatar name={r.studentName} size="sm" tone="sage" />
        <span className={styles.primary} title={r.studentName}>
          {r.studentName}
        </span>
      </span>
    </td>
    <td className={styles.cellSession} data-label="Related session">
      <span className={styles.stack}>
        <span className={styles.value}>
          {formatShortDate(r.scheduledAt)}, {formatTime(r.scheduledAt)}
        </span>
        <span className={styles.secondary}>
          {r.durationMinutes} min {r.kind === "trial" ? "trial" : "package class"} · {formatRupees(r.amount)}
        </span>
      </span>
    </td>
    <td className={styles.cellWhen} data-label="Reported on">
      <span className={styles.stack}>
        <span className={styles.value}>{formatShortDate(r.reportedAt)}</span>
        <span className={styles.secondary}>{formatTime(r.reportedAt)}</span>
      </span>
    </td>
    <td className={styles.cellStatus} data-label="Status">
      <span className={styles.stack}>
        <StatusPill row={r} />
        {r.resolution ? <span className={styles.secondary}>{resolutionLabel(r.resolution)}</span> : null}
      </span>
    </td>
    <td className={styles.cellActions} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-md" className={styles.menuButton} aria-label={`Actions for report ${r.bookingId.slice(0, 8)}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.menu}>
          <DropdownMenuItem className={styles.menuItem} onSelect={onOpen}>
            <Eye aria-hidden="true" /> View details
          </DropdownMenuItem>
          {!r.resolution ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={styles.menuItem} onSelect={() => onResolve("refunded")}>
                <CheckCircle2 aria-hidden="true" /> Give class back
              </DropdownMenuItem>
              <DropdownMenuItem className={styles.menuItem} onSelect={() => onResolve("rejected")}>
                <XCircle aria-hidden="true" /> Reject report
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
);

const ReportDrawer: React.FC<{
  row: LiveIssueRow | null;
  onClose: () => void;
  onResolve: (r: Resolution) => void;
  onOpenInCalendar: (day: DayKey) => void;
}> = ({ row: r, onClose, onResolve, onOpenInCalendar }) => (
  <Sheet open={!!r} onOpenChange={(isOpen) => !isOpen && onClose()}>
    <SheetContent side="right" className={styles.sheet}>
      {r ? (
        <>
          <div className={styles.drawerBody}>
            <header className={styles.drawerHead}>
              <div className={styles.chips}>
                <span className={styles.typeChip}>
                  <Flag aria-hidden="true" /> Teacher no-show
                </span>
                <StatusPill row={r} />
              </div>
              <SheetTitle className={styles.drawerTitle}>Report {r.bookingId.slice(0, 8)}</SheetTitle>
              <SheetDescription className={styles.drawerSub}>Reported {formatDateTime(r.reportedAt)} IST</SheetDescription>
            </header>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>What the learner said</h3>
              <p className={styles.note}>{r.note ? `"${r.note}"` : "No note was added to this report."}</p>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>People</h3>
              <div className={styles.people}>
                <span className={styles.personBig}>
                  <LiveAvatar name={r.teacherName} size="md" />
                  <span className={styles.stack}>
                    <span className={styles.primary}>{r.teacherName}</span>
                    <span className={styles.secondary}>Teacher · ID {r.teacherId}</span>
                  </span>
                </span>
                <span className={styles.personBig}>
                  <LiveAvatar name={r.studentName} size="md" tone="sage" />
                  <span className={styles.stack}>
                    <span className={styles.primary}>{r.studentName}</span>
                    <span className={styles.secondary}>Learner · ID {r.studentId}</span>
                  </span>
                </span>
              </div>
              <div className={styles.flags}>
                <span className={r.teacherJoined ? styles.yes : styles.no}>
                  {r.teacherJoined ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
                  Teacher {r.teacherJoined ? "joined" : "never joined"}
                </span>
                <span className={r.studentJoined ? styles.yes : styles.no}>
                  {r.studentJoined ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
                  Learner {r.studentJoined ? "joined" : "never joined"}
                </span>
              </div>
            </section>

            <section className={styles.block}>
              <div className={styles.blockHead}>
                <h3 className={styles.blockTitle}>Related session</h3>
                <Button size="sm" variant="ghost" className={styles.linkBtn} onClick={() => onOpenInCalendar(dayKeyOf(r.scheduledAt))}>
                  <CalendarDays /> Open in calendar
                </Button>
              </div>
              <dl className={styles.rows}>
                <div className={styles.dlRow}>
                  <dt>When (IST)</dt>
                  <dd>{formatDateTime(r.scheduledAt)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Length</dt>
                  <dd>{formatDuration(r.durationMinutes)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Class</dt>
                  <dd>{r.kind === "trial" ? "Trial class" : "Package class"}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Class value</dt>
                  <dd>{formatRupees(r.amount)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Booking ID</dt>
                  <dd className={styles.mono}>{r.bookingId}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>Resolution</h3>
              {r.resolution ? (
                <dl className={styles.rows}>
                  <div className={styles.dlRow}>
                    <dt>Outcome</dt>
                    <dd>{resolutionLabel(r.resolution)}</dd>
                  </div>
                  {r.resolvedAt ? (
                    <div className={styles.dlRow}>
                      <dt>Settled</dt>
                      <dd>{formatDateTime(r.resolvedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className={styles.help}>
                  Give the class back and the teacher is not paid: a package class returns to the package, a trial's price goes
                  to the learner's live class balance, and the learner is emailed. Reject it and the class stands and the teacher
                  is paid.
                </p>
              )}
            </section>
          </div>

          <footer className={styles.drawerFoot}>
            <Button variant="outline" size="sm" onClick={() => copyText(r.bookingId, "Booking ID")}>
              <Copy /> Copy ID
            </Button>
            {!r.resolution ? (
              <div className={styles.footActions}>
                <Button variant="outline" size="sm" onClick={() => onResolve("rejected")}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => onResolve("refunded")}>
                  Give class back
                </Button>
              </div>
            ) : null}
          </footer>
        </>
      ) : null}
    </SheetContent>
  </Sheet>
);
