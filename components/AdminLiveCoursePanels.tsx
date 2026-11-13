import React, { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, CheckCircle2, MoreHorizontal, Undo2, XCircle } from "lucide-react";
import {
  useAdminLiveCourseActionMutation,
  useAdminLiveCourseClassesQuery,
  useAdminLiveCourseEnrollmentsQuery,
  useAdminLiveCoursesQuery,
} from "../helpers/useLiveCourses";
import { formatIstDate, formatIstShort, formatRupees } from "../helpers/liveCourseRules";
import type { AdminLiveCourseClassRow, ClassView } from "../endpoints/admin/live-courses/classes_GET.schema";
import type { AdminLiveCourseEnrollmentRow, EnrollmentFilter } from "../endpoints/admin/live-courses/enrollments_GET.schema";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import styles from "./AdminLiveCoursePanels.module.css";

export const adminLiveCoursePath = (id: string) => `/admin/live-courses/${id}`;

const COURSE_LABEL: Record<string, string> = { draft: "Draft", published: "Live", completed: "Completed", cancelled: "Cancelled" };
const COURSE_TONE: Record<string, string> = { draft: "butter", published: "mint", completed: "sage", cancelled: "peach" };

const Chip: React.FC<{ tone: string; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`${styles.chip} ${styles[`tone_${tone}`] ?? ""}`}>{children}</span>
);

const State: React.FC<{ loading: boolean; error: unknown; empty: boolean; emptyText: string; children: React.ReactNode }> = ({
  loading,
  error,
  empty,
  emptyText,
  children,
}) => {
  if (loading) return <Skeleton style={{ height: "14rem" }} />;
  if (error) return <p className={styles.error}>{error instanceof Error ? error.message : "Could not load this list."}</p>;
  if (empty) return <p className={styles.empty}>{emptyText}</p>;
  return <>{children}</>;
};

const useSearch = () => {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  return { search, setSearch, q: q || undefined };
};

/* ------------------------------------------------------------- courses --- */

type CourseStatus = "all" | "draft" | "published" | "completed" | "cancelled";

export const AdminLiveCoursesPanel: React.FC = () => {
  const [status, setStatus] = useState<CourseStatus>("all");
  const { search, setSearch, q } = useSearch();
  const { data, isLoading, error } = useAdminLiveCoursesQuery({ status, q });

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <SegmentedControl
          aria-label="Course status"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "published", label: "Live" },
            { value: "draft", label: "Draft" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or teacher" className={styles.search} />
      </div>
      <State loading={isLoading} error={error} empty={!data?.courses.length} emptyText="No live courses here.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Teacher</th>
                <th scope="col">Status</th>
                <th scope="col">Dates</th>
                <th scope="col">Classes</th>
                <th scope="col">Seats</th>
                <th scope="col">Price</th>
                <th scope="col">Net sales</th>
              </tr>
            </thead>
            <tbody>
              {data?.courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={adminLiveCoursePath(c.id)} className={styles.title}>
                      {c.title}
                    </Link>
                    {c.examName && <span className={styles.sub}>{c.examName}</span>}
                  </td>
                  <td>{c.teacher.name}</td>
                  <td>
                    <Chip tone={COURSE_TONE[c.status] ?? "sage"}>{COURSE_LABEL[c.status] ?? c.status}</Chip>
                  </td>
                  <td className={styles.nowrap}>{c.startsOn ? `${formatIstDate(c.startsOn)} - ${formatIstDate(c.endsOn ?? c.startsOn)}` : "-"}</td>
                  <td>{c.classCount}</td>
                  <td>
                    {c.enrolledCount} / {c.seatLimit}
                  </td>
                  <td>{formatRupees(c.price)}</td>
                  <td>
                    {formatRupees(c.revenue)}
                    {c.refunds > 0 && <span className={styles.sub}>{formatRupees(c.refunds)} refunded</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
    </div>
  );
};

/* ------------------------------------------------------------- classes --- */

type ClassPending = { cls: AdminLiveCourseClassRow; kind: "cancel" | "held" | "missed" };

const classChip = (c: AdminLiveCourseClassRow) => {
  if (c.unmarked) return <Chip tone="butter">Not marked</Chip>;
  if (c.status === "scheduled") return <Chip tone="blue">Upcoming</Chip>;
  if (c.status === "completed") return <Chip tone="sage">Held</Chip>;
  if (c.status === "missed") return <Chip tone="peach">Missed</Chip>;
  return <Chip tone="muted">Cancelled</Chip>;
};

export const AdminLiveCourseClassesPanel: React.FC = () => {
  const [view, setView] = useState<ClassView>("upcoming");
  const { search, setSearch, q } = useSearch();
  const { data, isLoading, error } = useAdminLiveCourseClassesQuery({ view, q });
  const action = useAdminLiveCourseActionMutation();
  const [pending, setPending] = useState<ClassPending | null>(null);
  const [reason, setReason] = useState("");

  const close = () => {
    setPending(null);
    setReason("");
  };
  const confirm = () => {
    if (!pending) return;
    const input =
      pending.kind === "cancel"
        ? ({ action: "cancel_class", classId: pending.cls.id, reason: reason.trim() } as const)
        : ({ action: "class_outcome", classId: pending.cls.id, outcome: pending.kind, reason: reason.trim() || undefined } as const);
    action.mutate(input, {
      onSuccess: (r) => {
        toast.success(r.message);
        close();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
    });
  };
  const now = Date.now();

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <SegmentedControl
          aria-label="Which classes"
          value={view}
          onValueChange={setView}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "unmarked", label: "Not marked" },
            { value: "past", label: "Past" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, course or teacher" className={styles.search} />
      </div>
      {view === "unmarked" && (
        <p className={styles.hint}>Classes that have ended but are still scheduled. The sweep closes them on its own; mark one here to settle it now.</p>
      )}
      <State
        loading={isLoading}
        error={error}
        empty={!data?.classes.length}
        emptyText={view === "upcoming" ? "No upcoming classes." : view === "unmarked" ? "Every class that has ended is marked." : "No classes here."}
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When (IST)</th>
                <th scope="col">Class</th>
                <th scope="col">Teacher</th>
                <th scope="col">Status</th>
                <th scope="col">Present</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data?.classes.map((c) => {
                const started = new Date(c.startTime).getTime() <= now;
                const open = c.status === "scheduled";
                return (
                  <tr key={c.id}>
                    <td className={styles.nowrap}>
                      {formatIstShort(c.startTime)}
                      <span className={styles.sub}>{c.durationMinutes} min</span>
                    </td>
                    <td>
                      <span className={styles.strong}>{c.title}</span>
                      <Link to={adminLiveCoursePath(c.course.id)} className={styles.subLink}>
                        {c.course.title}
                      </Link>
                      {c.cancellationReason && <span className={styles.sub}>{c.cancellationReason}</span>}
                    </td>
                    <td>{c.teacher.name}</td>
                    <td>{classChip(c)}</td>
                    <td>{started ? `${c.presentCount} / ${c.course.enrolledCount}` : `${c.course.enrolledCount} enrolled`}</td>
                    <td className={styles.actionsCell}>
                      {open && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-md" aria-label={`Actions for ${c.title}`}>
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {started && (
                              <>
                                <DropdownMenuItem onSelect={() => setPending({ cls: c, kind: "held" })}>
                                  <CheckCircle2 size={14} /> Mark held
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPending({ cls: c, kind: "missed" })}>
                                  <XCircle size={14} /> Mark missed
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onSelect={() => setPending({ cls: c, kind: "cancel" })}>
                              <Ban size={14} /> Cancel class
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data?.truncated && <p className={styles.hint}>Showing the first 300 classes. Search to narrow the list.</p>}
      </State>

      <ConsoleConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && close()}
        tone={pending?.kind === "held" ? "default" : "destructive"}
        title={
          pending?.kind === "cancel"
            ? `Cancel "${pending.cls.title}"?`
            : pending
              ? `Mark "${pending.cls.title}" ${pending.kind}?`
              : ""
        }
        description={
          pending?.kind === "cancel"
            ? "Enrolled students are told by email and WhatsApp."
            : pending?.kind === "held"
              ? "The teacher held this class. Student attendance stays as it is; set it on the course's Students tab."
              : "The teacher did not hold this class. It drops out of the timetable. Students are not refunded automatically."
        }
        confirmLabel={pending?.kind === "cancel" ? "Cancel class" : pending?.kind === "held" ? "Mark held" : "Mark missed"}
        pendingLabel="Working..."
        isPending={action.isPending}
        note={{ label: pending?.kind === "cancel" ? "Reason" : "Note (optional)", value: reason, onChange: setReason, required: pending?.kind === "cancel" }}
        onConfirm={confirm}
      />
    </div>
  );
};

/* ---------------------------------------------------------- enrolments --- */

const enrollmentChip = (e: AdminLiveCourseEnrollmentRow) => {
  if (e.status === "enrolled") return <Chip tone="mint">Enrolled</Chip>;
  if (e.status === "removed") return <Chip tone="muted">Removed</Chip>;
  const status = e.refundStatus?.toUpperCase() ?? null;
  if (status === "SUCCESS") return <Chip tone="sage">Refunded</Chip>;
  if (status === "CANCELLED") return <Chip tone="peach">Refund cancelled - act</Chip>;
  if (status === "ONHOLD") return <Chip tone="peach">Refund on hold - act</Chip>;
  return <Chip tone="butter">Refund {status ? status.toLowerCase().replace(/_/g, " ") : "started"}</Chip>;
};

export const AdminLiveCourseEnrollmentsPanel: React.FC = () => {
  const [filter, setFilter] = useState<EnrollmentFilter>("all");
  const { search, setSearch, q } = useSearch();
  const { data, isLoading, error } = useAdminLiveCourseEnrollmentsQuery({ filter, q });
  const action = useAdminLiveCourseActionMutation();
  const [target, setTarget] = useState<AdminLiveCourseEnrollmentRow | null>(null);
  const [note, setNote] = useState("");

  const close = () => {
    setTarget(null);
    setNote("");
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <SegmentedControl
          aria-label="Which enrolments"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "enrolled", label: "Enrolled" },
            { value: "refund_open", label: "Refunds in progress" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, email, course or order" className={styles.search} />
      </div>
      {filter === "refund_open" && (
        <p className={styles.hint}>
          Refunds Cashfree has not paid out yet. The live course sweep re-reads them every 15 minutes. A cancelled or on-hold refund did not reach the
          student: check it in Cashfree and pay them back by hand.
        </p>
      )}
      <State
        loading={isLoading}
        error={error}
        empty={!data?.enrollments.length}
        emptyText={filter === "refund_open" ? "No refunds in progress." : "No enrolments here."}
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Course</th>
                <th scope="col">Paid</th>
                <th scope="col">Enrolled (IST)</th>
                <th scope="col">Status</th>
                <th scope="col">Order</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data?.enrollments.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className={styles.strong}>{e.student.name}</span>
                    {e.student.email && <span className={styles.sub}>{e.student.email}</span>}
                  </td>
                  <td>
                    <Link to={adminLiveCoursePath(e.course.id)} className={styles.title}>
                      {e.course.title}
                    </Link>
                    <span className={styles.sub}>{e.teacherName}</span>
                  </td>
                  <td>
                    {formatRupees(e.amountPaid)}
                    {e.refundAmount !== null && <span className={styles.sub}>{formatRupees(e.refundAmount)} back</span>}
                  </td>
                  <td className={styles.nowrap}>
                    {formatIstShort(e.enrolledAt)}
                    {e.refundRequestedAt && <span className={styles.sub}>Refund {formatIstShort(e.refundRequestedAt)}</span>}
                  </td>
                  <td>{enrollmentChip(e)}</td>
                  <td>{e.orderId ? `#${e.orderId}` : "-"}</td>
                  <td className={styles.actionsCell}>
                    {e.status === "enrolled" ? (
                      <Button variant="ghost" size="sm" onClick={() => setTarget(e)}>
                        <Undo2 size={14} /> Refund
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.truncated && <p className={styles.hint}>Showing the latest 300 enrolments. Search to narrow the list.</p>}
      </State>

      <ConsoleConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && close()}
        tone="destructive"
        title={`Refund ${target?.student.name ?? ""}?`}
        description={`${target ? formatRupees(target.amountPaid) : ""} goes back through Cashfree and the student loses their seat in "${target?.course.title ?? ""}", whatever the refund window says.`}
        confirmLabel="Refund"
        pendingLabel="Working..."
        isPending={action.isPending}
        note={{ label: "Note to the student (optional)", value: note, onChange: setNote, required: false }}
        onConfirm={() => {
          if (!target) return;
          action.mutate(
            { action: "refund", enrollmentId: target.id, reason: note.trim() || undefined },
            {
              onSuccess: (r) => {
                toast.success(r.message);
                close();
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Refund failed."),
            }
          );
        }}
      />
    </div>
  );
};
