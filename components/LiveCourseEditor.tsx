import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Ban, CalendarPlus, CheckCircle2, Edit2, MoreHorizontal, Plus, Repeat, Trash2, Video, XCircle } from "lucide-react";
import type { LiveCourseClass, LiveCourseDetail, LiveCourseModule } from "../helpers/liveCourseData";
import type { InputType as DetailsInput } from "../endpoints/teacher/live-courses/upsert_POST.schema";
import type { OutputType as RosterOutput } from "../endpoints/teacher/live-courses/students_GET.schema";
import type { LiveCourseEarningsPreview } from "../endpoints/teacher/live-courses/get_GET.schema";
import {
  LIVE_COURSE_SEAT_LIMIT_MAX,
  WEEKDAYS,
  classroomPath,
  dateToIst,
  formatIstShort,
  formatRupees,
  istToDate,
  liveCourseEarnings,
  liveCourseMinClasses,
} from "../helpers/liveCourseRules";
import {
  useAddClassesMutation,
  useCancelClassMutation,
  useSaveAttendanceMutation,
  useSaveSyllabusMutation,
  useUpdateClassMutation,
} from "../helpers/useLiveCourses";
import { useExamsQuery } from "../helpers/useExamsQuery";
import { handleClassroomLinkClick } from "../helpers/openClassroom";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { ImageUploader } from "./ImageUploader";
import { LanguageMultiPicker } from "./LanguageMultiPicker";
import { AutoComplete, type Option } from "./AutoComplete";
import { LiveSessionDateTile } from "./LiveSession";
import styles from "./LiveCourseEditor.module.css";

const TIME_ZONE = "Asia/Kolkata";

/* --------------------------------------------------------------- details --- */

export type LiveCourseDetailsValues = Omit<DetailsInput, "id">;

export const LiveCourseDetailsForm: React.FC<{
  course: LiveCourseDetail | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: (values: LiveCourseDetailsValues) => void;
  /** Teachers only: their platform fee, to show what they keep of the price. */
  platformFeePercentage?: number;
}> = ({ course, pending, submitLabel, onSubmit, platformFeePercentage }) => {
  const exams = useExamsQuery();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFileId, setThumbnailFileId] = useState("");
  const [examId, setExamId] = useState<number | null>(null);
  const [examText, setExamText] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [seatLimit, setSeatLimit] = useState("30");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [defaultMinutes, setDefaultMinutes] = useState("60");

  useEffect(() => {
    setTitle(course?.title ?? "");
    setDescription(course?.description ?? "");
    setThumbnailUrl(course?.thumbnailUrl ?? "");
    setThumbnailFileId(course?.thumbnailFileId ?? "");
    setExamId(course?.examId ?? null);
    setExamText(course?.examName ?? "");
    setLanguages(course?.languages ?? []);
    setLevel(course?.level ?? "beginner");
    setPrice(course ? String(course.price) : "");
    setOriginalPrice(course?.originalPrice ? String(course.originalPrice) : "");
    setSeatLimit(course ? String(course.seatLimit) : "30");
    if (course?.registrationDeadline) {
      const ist = dateToIst(course.registrationDeadline);
      setDeadlineDate(ist.date);
      setDeadlineTime(ist.time);
    } else {
      setDeadlineDate("");
      setDeadlineTime("23:59");
    }
    setDefaultMinutes(course ? String(course.defaultClassMinutes) : "60");
  }, [course?.id]);

  const examOptions: Option<number>[] = useMemo(
    () =>
      (exams.data?.exams ?? []).map((e) => ({
        value: String(e.id),
        displayText: e.examName,
        label: <span>{e.examName}</span>,
        metadata: e.id,
      })),
    [exams.data]
  );
  const selectedExam = examOptions.find((o) => o.metadata === examId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(price);
    if (!title.trim()) return toast.error("Add a title.");
    if (!(priceNum > 0)) return toast.error("Set a price. Live courses cannot be free.");
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl: thumbnailUrl || null,
      thumbnailFileId: thumbnailFileId || null,
      examId: examText.trim() ? examId : null,
      languages,
      level,
      price: priceNum,
      originalPrice: originalPrice ? Number(originalPrice) : null,
      seatLimit: Number(seatLimit),
      registrationDeadline: deadlineDate ? istToDate(deadlineDate, deadlineTime || "23:59") : null,
      defaultClassMinutes: Number(defaultMinutes),
    });
  };

  return (
    <form className={styles.panel} onSubmit={submit}>
      <div className={`${styles.field} ${styles.coverField}`}>
        <span className={styles.label}>Cover image</span>
        <ImageUploader
          folder="live-courses"
          label="Upload cover image"
          aspectRatio="16 / 9"
          currentImageUrl={thumbnailUrl || undefined}
          currentFileId={thumbnailFileId || undefined}
          onSuccess={({ url, fileId }) => {
            setThumbnailUrl(url);
            setThumbnailFileId(fileId);
          }}
          onError={(err) => toast.error(err.message)}
        />
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SSC CGL Maths - 8 week live batch" maxLength={200} />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>About this course</span>
        <Textarea
          rows={7}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What students learn, who it is for and how the classes run."
        />
      </label>
      <div className={styles.row}>
        <div className={styles.field}>
          <span className={styles.label}>Exam</span>
          <AutoComplete
            options={examOptions}
            emptyMessage="No exam found"
            value={selectedExam}
            onValueChange={(o) => setExamId(o.metadata ?? null)}
            inputValue={examText}
            onInputValueChange={(v) => {
              setExamText(v);
              if (!v.trim()) setExamId(null);
            }}
            isLoading={exams.isLoading}
            placeholder="Search an exam"
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Level</span>
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Teaching languages</span>
        <LanguageMultiPicker value={languages} onChange={setLanguages} />
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Price (&#8377;)</span>
          <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Original price (&#8377;, shown struck out)</span>
          <Input type="number" min="1" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      {platformFeePercentage !== undefined && Number(price) > 0 && (
        <p className={styles.hint}>
          You keep {formatRupees(liveCourseEarnings(Number(price), 1, platformFeePercentage).perStudent)} of each student's{" "}
          {formatRupees(Number(price))} after Testkart's {platformFeePercentage}% fee, paid out class by class as you teach.
        </p>
      )}
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Seats (up to {LIVE_COURSE_SEAT_LIMIT_MAX})</span>
          <Input type="number" min="1" max={LIVE_COURSE_SEAT_LIMIT_MAX} value={seatLimit} onChange={(e) => setSeatLimit(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Usual class length (minutes)</span>
          <Input type="number" min="15" max="300" value={defaultMinutes} onChange={(e) => setDefaultMinutes(e.target.value)} />
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Registration closes on</span>
          <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>at (IST)</span>
          <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
        </label>
      </div>
      <p className={styles.hint}>Registration can stay open after the first class. Students who join late see every earlier class too.</p>
      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

/* -------------------------------------------------------------- syllabus --- */

type DraftModule = { key: string; id?: string; title: string; topics: { key: string; id?: string; title: string }[] };
const newKey = () => Math.random().toString(36).slice(2, 10);
const toDraft = (modules: LiveCourseModule[]): DraftModule[] =>
  modules.map((m) => ({ key: m.id, id: m.id, title: m.title, topics: m.topics.map((t) => ({ key: t.id, id: t.id, title: t.title })) }));

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const LiveCourseSyllabusEditor: React.FC<{ course: LiveCourseDetail; readOnly?: boolean }> = ({ course, readOnly }) => {
  const save = useSaveSyllabusMutation();
  const [modules, setModules] = useState<DraftModule[]>(() => toDraft(course.modules));
  useEffect(() => setModules(toDraft(course.modules)), [course.id, JSON.stringify(course.modules)]);

  const update = (i: number, patch: Partial<DraftModule>) => setModules((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const submit = () => {
    if (modules.some((m) => !m.title.trim() || m.topics.some((t) => !t.title.trim()))) {
      toast.error("Every module and topic needs a name.");
      return;
    }
    save.mutate(
      {
        liveCourseId: course.id,
        modules: modules.map((m) => ({ id: m.id, title: m.title.trim(), topics: m.topics.map((t) => ({ id: t.id, title: t.title.trim() })) })),
      },
      {
        onSuccess: () => toast.success("Syllabus saved."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the syllabus."),
      }
    );
  };

  if (readOnly) {
    return (
      <div className={styles.panel}>
        {course.modules.length === 0 ? (
          <p className={styles.empty}>No syllabus yet.</p>
        ) : (
          course.modules.map((m, i) => (
            <div key={m.id} className={styles.module}>
              <strong>
                {i + 1}. {m.title}
              </strong>
              <ul className={styles.topicList}>
                {m.topics.map((t) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {modules.length === 0 && <p className={styles.empty}>Break the course into modules, then list the topics in each.</p>}
      {modules.map((m, i) => (
        <div key={m.key} className={styles.module}>
          <div className={styles.moduleHead}>
            <span className={styles.moduleNo}>{i + 1}</span>
            <Input value={m.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Module name" aria-label={`Module ${i + 1} name`} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move module up" onClick={() => setModules((ms) => move(ms, i, i - 1))}>
              <ArrowUp size={14} />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move module down" onClick={() => setModules((ms) => move(ms, i, i + 1))}>
              <ArrowDown size={14} />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove module" onClick={() => setModules((ms) => ms.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </Button>
          </div>
          <div className={styles.topics}>
            {m.topics.map((t, ti) => (
              <div key={t.key} className={styles.topicRow}>
                <Input
                  value={t.title}
                  onChange={(e) => update(i, { topics: m.topics.map((x, k) => (k === ti ? { ...x, title: e.target.value } : x)) })}
                  placeholder="Topic"
                  aria-label={`Topic ${ti + 1} of module ${i + 1}`}
                />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Move topic up" onClick={() => update(i, { topics: move(m.topics, ti, ti - 1) })}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove topic"
                  onClick={() => update(i, { topics: m.topics.filter((_, k) => k !== ti) })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { topics: [...m.topics, { key: newKey(), title: "" }] })}>
              <Plus size={14} /> Add topic
            </Button>
          </div>
        </div>
      ))}
      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={() => setModules((ms) => [...ms, { key: newKey(), title: "", topics: [] }])}>
          <Plus size={14} /> Add module
        </Button>
        <Button type="button" onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Saving..." : "Save syllabus"}
        </Button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- schedule --- */

const classState = (c: LiveCourseClass): { label: string; tone: string } | null => {
  if (c.missed) return { label: "Missed", tone: "peach" };
  if (c.status === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (c.status === "completed") return { label: "Held", tone: "sage" };
  const start = new Date(c.startTime).getTime();
  if (start <= Date.now() && start + c.durationMinutes * 60000 > Date.now()) return { label: "Live now", tone: "mint" };
  return null;
};

const topicOptions = (modules: LiveCourseModule[]) => modules.flatMap((m) => m.topics.map((t) => ({ id: t.id, label: `${m.title}: ${t.title}` })));

const plannedClasses = (course: LiveCourseDetail) => course.classes.filter((c) => c.status !== "cancelled").length;

/** What the teacher earns from this course, per held class and per student. */
export const LiveCourseEarningsCard: React.FC<{ earnings: LiveCourseEarningsPreview; enrolled: number }> = ({ earnings, enrolled }) => {
  if (earnings.perStudent <= 0) return null;
  return (
    <section className={styles.earnings} aria-label="Your earnings">
      <div className={styles.earningsFigures}>
        <div>
          <strong className={styles.earningsValue}>{earnings.perClassPerStudent > 0 ? formatRupees(earnings.perClassPerStudent) : "-"}</strong>
          <span className={styles.earningsLabel}>per student for each class you hold</span>
        </div>
        <div>
          <strong className={styles.earningsValue}>{formatRupees(earnings.perStudent)}</strong>
          <span className={styles.earningsLabel}>per student for the whole course</span>
        </div>
        {enrolled > 0 && (
          <div>
            <strong className={styles.earningsValue}>{formatRupees(Math.round(earnings.perStudent * enrolled * 100) / 100)}</strong>
            <span className={styles.earningsLabel}>with {enrolled} enrolled</span>
          </div>
        )}
      </div>
      <p className={styles.earningsNote}>
        {earnings.fixed
          ? "Fixed since you published. It reaches your earnings right after each class you hold. Classes added later earn nothing extra."
          : earnings.perClassPerStudent > 0
            ? "Based on the classes in your timetable now. It is fixed when you publish."
            : "Add classes to see what you earn for each one."}
        {earnings.platformFeePercentage > 0 ? ` Testkart's ${earnings.platformFeePercentage}% fee is already taken off.` : ""}
      </p>
    </section>
  );
};

export const LiveCourseSchedule: React.FC<{
  course: LiveCourseDetail;
  refundClosesAt: Date | null;
  /** Admins cancel classes through their own action; teachers get the full editor. */
  mode: "teacher" | "admin";
  onAdminCancel?: (c: LiveCourseClass) => void;
  /** Admins only: record whether the teacher held a class that has started. */
  onAdminOutcome?: (c: LiveCourseClass, outcome: "held" | "missed") => void;
  /** Teachers only: pay per class, shown above the timetable and in the add dialogs. */
  earnings?: LiveCourseEarningsPreview;
}> = ({ course, refundClosesAt, mode, onAdminCancel, onAdminOutcome, earnings }) => {
  const [single, setSingle] = useState<LiveCourseClass | "new" | null>(null);
  const [pattern, setPattern] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LiveCourseClass | null>(null);
  const [reason, setReason] = useState("");
  const cancel = useCancelClassMutation();
  const editable = mode === "teacher" && (course.status === "draft" || course.status === "published");
  const topics = topicOptions(course.modules);
  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.label ?? null;
  const now = Date.now();
  const upcoming = course.classes.filter((c) => c.status === "scheduled" && new Date(c.startTime).getTime() + c.durationMinutes * 60000 > now);
  const past = course.classes.filter((c) => !upcoming.includes(c));

  const row = (c: LiveCourseClass, i: number) => {
    const state = classState(c);
    const open = c.status === "scheduled";
    return (
      <div key={c.id} className={`${styles.classRow} ${open ? "" : styles.classMuted}`}>
        <LiveSessionDateTile date={c.startTime} tone={open ? (["blue", "lavender", "sage", "butter", "mint"] as const)[i % 5] : "muted"} timeZone={TIME_ZONE} />
        <div className={styles.classBody}>
          <div className={styles.chips}>{state && <span className={`${styles.chip} ${styles[`tone_${state.tone}`]}`}>{state.label}</span>}</div>
          <strong className={styles.classTitle}>{c.title}</strong>
          <span className={styles.classMeta}>
            {formatIstShort(c.startTime)} IST &middot; {c.durationMinutes} min
            {topicName(c.topicId) ? ` · ${topicName(c.topicId)}` : ""}
          </span>
          {c.cancellationReason && <span className={styles.reason}>{c.cancellationReason}</span>}
        </div>
        {open && (
          <div className={styles.classActions}>
            {course.status !== "draft" && (
              <Button variant="outline" size="sm" asChild>
                <a href={classroomPath(c.id)} target="_blank" rel="noopener noreferrer" onClick={(e) => handleClassroomLinkClick(e, classroomPath(c.id))}>
                  <Video size={14} /> Classroom
                </a>
              </Button>
            )}
            {(editable || (mode === "admin" && onAdminCancel)) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-md" aria-label={`More options for ${c.title}`}>
                    <MoreHorizontal size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editable && (
                    <DropdownMenuItem onSelect={() => setSingle(c)}>
                      <Edit2 size={14} /> Edit or reschedule
                    </DropdownMenuItem>
                  )}
                  {mode === "admin" && onAdminOutcome && new Date(c.startTime).getTime() <= now && (
                    <>
                      <DropdownMenuItem onSelect={() => onAdminOutcome(c, "held")}>
                        <CheckCircle2 size={14} /> Mark held
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onAdminOutcome(c, "missed")}>
                        <XCircle size={14} /> Mark missed
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => (mode === "admin" ? onAdminCancel?.(c) : setCancelTarget(c))}>
                    <Ban size={14} /> {course.status === "draft" ? "Remove class" : "Cancel class"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      {earnings && <LiveCourseEarningsCard earnings={earnings} enrolled={course.enrolledCount} />}
      {editable && (
        <div className={styles.toolbar}>
          <Button onClick={() => setPattern(true)}>
            <Repeat size={14} /> Add weekly classes
          </Button>
          <Button variant="outline" onClick={() => setSingle("new")}>
            <CalendarPlus size={14} /> Add one class
          </Button>
        </div>
      )}
      {course.status === "published" && (
        <p className={styles.hint}>
          Students are told by email and WhatsApp whenever you add, move or cancel a class.
          {refundClosesAt
            ? ` Full refunds stay open until ${formatIstShort(refundClosesAt)} IST, when the 3rd class starts.`
            : " Full refunds stay open until the 3rd class starts."}
        </p>
      )}
      <h3 className={styles.subhead}>Upcoming ({upcoming.length})</h3>
      {upcoming.length ? <div className={styles.classList}>{upcoming.map(row)}</div> : <p className={styles.empty}>No upcoming classes.</p>}
      {past.length > 0 && (
        <>
          <h3 className={styles.subhead}>Earlier ({past.length})</h3>
          <div className={styles.classList}>{past.map(row)}</div>
        </>
      )}

      {editable && (
        <>
          <ClassDialog course={course} target={single} topics={topics} onClose={() => setSingle(null)} earnings={earnings} />
          <PatternDialog course={course} open={pattern} onClose={() => setPattern(false)} earnings={earnings} />
          <ConsoleConfirmDialog
            open={!!cancelTarget}
            onOpenChange={(o) => {
              if (!o) {
                setCancelTarget(null);
                setReason("");
              }
            }}
            title={course.status === "draft" ? `Remove "${cancelTarget?.title ?? ""}"?` : `Cancel "${cancelTarget?.title ?? ""}"?`}
            description={
              course.status === "draft"
                ? "The class is removed from the timetable."
                : earnings && earnings.cancelRefundPerStudent > 0
                  ? `Enrolled students are told by email and WhatsApp. If you don't add a replacement class within an hour, each enrolled student gets ${formatRupees(earnings.cancelRefundPerStudent)} back.`
                  : "Enrolled students are told by email and WhatsApp."
            }
            tone="destructive"
            confirmLabel={course.status === "draft" ? "Remove" : "Cancel class"}
            pendingLabel="Saving..."
            isPending={cancel.isPending}
            note={course.status === "draft" ? undefined : { label: "Reason for students", value: reason, onChange: setReason, required: false }}
            onConfirm={() => {
              if (!cancelTarget) return;
              cancel.mutate(
                { classId: cancelTarget.id, reason: reason.trim() || undefined },
                {
                  onSuccess: (r) => {
                    toast.success(r.result === "deleted" ? "Class removed." : "Class cancelled.");
                    setCancelTarget(null);
                    setReason("");
                  },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel the class."),
                }
              );
            }}
          />
        </>
      )}
    </div>
  );
};

const ClassDialog: React.FC<{
  course: LiveCourseDetail;
  target: LiveCourseClass | "new" | null;
  topics: { id: string; label: string }[];
  onClose: () => void;
  earnings?: LiveCourseEarningsPreview;
}> = ({ course, target, topics, onClose, earnings }) => {
  const add = useAddClassesMutation();
  const update = useUpdateClassMutation();
  const editing = target && target !== "new" ? target : null;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [minutes, setMinutes] = useState("60");
  const [topicId, setTopicId] = useState("none");

  useEffect(() => {
    if (!target) return;
    if (editing) {
      const ist = dateToIst(editing.startTime);
      setTitle(editing.title);
      setDate(ist.date);
      setTime(ist.time);
      setMinutes(String(editing.durationMinutes));
      setTopicId(editing.topicId ?? "none");
    } else {
      setTitle(`Class ${course.classes.filter((c) => c.status !== "cancelled").length + 1}`);
      setDate("");
      setTime("19:00");
      setMinutes(String(course.defaultClassMinutes));
      setTopicId("none");
    }
  }, [target]);

  const pending = add.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return toast.error("Pick a date and time.");
    const startTime = istToDate(date, time);
    const done = {
      onSuccess: () => {
        toast.success(editing ? "Class saved." : "Class added.");
        onClose();
      },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Could not save the class."),
    };
    const topic = topicId === "none" ? null : topicId;
    if (editing) {
      update.mutate({ classId: editing.id, title: title.trim(), startTime, durationMinutes: Number(minutes), topicId: topic }, done);
    } else {
      add.mutate({ mode: "single", liveCourseId: course.id, title: title.trim(), startTime, durationMinutes: Number(minutes), topicId: topic }, done);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={editing ? "Edit class" : "Add a class"} description="Times are in IST." />
        <form onSubmit={submit}>
          <ConsoleDialogBody className={styles.dialogFields}>
            <label className={styles.field}>
              <span className={styles.label}>Class name</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Date</span>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Starts at</span>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Minutes</span>
                <Input type="number" min="15" max="300" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </label>
            </div>
            {topics.length > 0 && (
              <div className={styles.field}>
                <span className={styles.label}>Topic (optional)</span>
                <Select value={topicId} onValueChange={setTopicId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">No topic</SelectItem>
                      {topics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editing && earnings && <AddClassesPay course={course} earnings={earnings} adding={1} />}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save class" : "Add class"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

/** Pay per class once these classes are added: it follows the timetable until publish, then stays fixed. */
const AddClassesPay: React.FC<{ course: LiveCourseDetail; earnings: LiveCourseEarningsPreview; adding: number }> = ({
  course,
  earnings,
  adding,
}) => {
  if (earnings.perStudent <= 0 || adding <= 0) return null;
  const price = Number(course.price);
  if (earnings.fixed) {
    return (
      <p className={styles.earningsInline}>
        Your pay stays {formatRupees(earnings.perClassPerStudent)} per student for each class you hold. Classes added after
        publishing earn nothing extra.
      </p>
    );
  }
  const total = plannedClasses(course) + adding;
  const pay = liveCourseEarnings(price, liveCourseMinClasses(total), earnings.platformFeePercentage);
  return (
    <p className={styles.earningsInline}>
      With {total} class{total === 1 ? "" : "es"} in the course you earn <strong>{formatRupees(pay.perClassPerStudent)}</strong> per
      student for each class you hold, up to {formatRupees(pay.perStudent)} per student.
    </p>
  );
};

const PatternDialog: React.FC<{ course: LiveCourseDetail; open: boolean; onClose: () => void; earnings?: LiveCourseEarningsPreview }> = ({
  course,
  open,
  onClose,
  earnings,
}) => {
  const add = useAddClassesMutation();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("19:00");
  const [minutes, setMinutes] = useState("60");
  const [prefix, setPrefix] = useState("Class");

  useEffect(() => {
    if (open) setMinutes(String(course.defaultClassMinutes));
  }, [open]);

  const count = useMemo(() => {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    let n = 0;
    const start = new Date(`${fromDate}T00:00:00Z`);
    const end = new Date(`${toDate}T00:00:00Z`);
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      if (weekdays.includes(wd)) n++;
    }
    return n;
  }, [fromDate, toDate, weekdays]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return toast.error("Pick the first and last date.");
    add.mutate(
      { mode: "pattern", liveCourseId: course.id, titlePrefix: prefix.trim() || "Class", fromDate, toDate, weekdays, time, durationMinutes: Number(minutes) },
      {
        onSuccess: (r) => {
          toast.success(`${r.added} classes added.`);
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add the classes."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title="Add weekly classes" description="Creates a class on every chosen day. You can edit or cancel any of them later." />
        <form onSubmit={submit}>
          <ConsoleDialogBody className={styles.dialogFields}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>From</span>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>To</span>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Days</span>
              <div className={styles.weekdays}>
                {WEEKDAYS.map((d) => (
                  <label key={d.value} className={styles.weekday}>
                    <Checkbox
                      checked={weekdays.includes(d.value)}
                      onChange={(e) =>
                        setWeekdays((w) => (e.target.checked ? [...w, d.value].sort() : w.filter((x) => x !== d.value)))
                      }
                    />
                    {d.short}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Starts at (IST)</span>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Minutes</span>
                <Input type="number" min="15" max="300" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Name classes</span>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={150} />
              </label>
            </div>
            <p className={styles.hint}>{count > 0 ? `${count} classes will be added.` : "Pick dates and days to see how many classes this makes."}</p>
            {earnings && <AddClassesPay course={course} earnings={earnings} adding={count} />}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending || count === 0}>
              {add.isPending ? "Adding..." : "Add classes"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

/* -------------------------------------------------------------- students --- */

export const LiveCourseStudents: React.FC<{
  roster: RosterOutput | undefined;
  loading: boolean;
  canMark: boolean;
  onRefund?: (enrollmentId: string, name: string) => void;
  /** Admins save marks through their own action instead of the teacher endpoint. */
  onSaveMarks?: (classId: string, marks: { studentId: number; present: boolean }[]) => void;
  savingMarks?: boolean;
}> = ({ roster, loading, canMark, onRefund, onSaveMarks, savingMarks }) => {
  const save = useSaveAttendanceMutation();
  const saving = onSaveMarks ? !!savingMarks : save.isPending;
  const classes = roster?.classes ?? [];
  const [classId, setClassId] = useState<string>("");
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const enrolled = (roster?.students ?? []).filter((s) => s.status === "enrolled");

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[classes.length - 1].id);
  }, [classes.length]);

  useEffect(() => {
    const next: Record<number, boolean> = {};
    for (const a of roster?.attendance ?? []) if (a.classId === classId) next[a.studentId] = a.present;
    setMarks(next);
  }, [classId, roster]);

  if (loading && !roster) return <p className={styles.empty}>Loading students...</p>;
  if (!roster || roster.students.length === 0) return <p className={styles.empty}>No students yet.</p>;

  const attendedBy = (studentId: number) => roster.attendance.filter((a) => a.studentId === studentId && a.present).length;

  return (
    <div className={styles.panel}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Joined</th>
              <th scope="col">Paid</th>
              <th scope="col">Attended</th>
              <th scope="col">Status</th>
              {onRefund && <th scope="col" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {roster.students.map((s) => (
              <tr key={s.enrollmentId}>
                <td>
                  <span className={styles.studentName}>{s.name}</span>
                  {s.email && <span className={styles.studentSub}>{s.email}</span>}
                </td>
                <td>{formatIstShort(s.enrolledAt)}</td>
                <td>{formatRupees(s.amountPaid)}</td>
                <td>
                  {attendedBy(s.studentId)} / {classes.length}
                </td>
                <td>
                  {s.status === "enrolled" ? (
                    <span className={`${styles.chip} ${styles.tone_mint}`}>Enrolled</span>
                  ) : (
                    <span className={`${styles.chip} ${styles.tone_peach}`}>
                      {s.status === "refunded" ? `Refunded${s.refundStatus ? ` (${s.refundStatus.toLowerCase()})` : ""}` : "Removed"}
                    </span>
                  )}
                </td>
                {onRefund && (
                  <td>
                    {s.status === "enrolled" && (
                      <Button variant="ghost" size="sm" onClick={() => onRefund(s.enrollmentId, s.name)}>
                        Refund
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.subhead}>Attendance</h3>
      {classes.length === 0 ? (
        <p className={styles.empty}>Attendance opens once the first class starts. Students who join the classroom are marked present on their own.</p>
      ) : (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Class</span>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} - {formatIstShort(c.startTime)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className={styles.attendanceList}>
            {enrolled.map((s) => (
              <label key={s.studentId} className={styles.attendanceRow}>
                <Checkbox
                  checked={!!marks[s.studentId]}
                  disabled={!canMark}
                  onChange={(e) => setMarks((m) => ({ ...m, [s.studentId]: e.target.checked }))}
                />
                <span>{s.name}</span>
                <span className={styles.studentSub}>
                  {roster.attendance.find((a) => a.classId === classId && a.studentId === s.studentId)?.source === "auto" ? "joined the classroom" : ""}
                </span>
              </label>
            ))}
          </div>
          {canMark && enrolled.length > 0 && (
            <div className={styles.actions}>
              <Button
                disabled={saving}
                onClick={() => {
                  const list = enrolled.map((s) => ({ studentId: s.studentId, present: !!marks[s.studentId] }));
                  if (onSaveMarks) return onSaveMarks(classId, list);
                  save.mutate(
                    { classId, marks: list },
                    {
                      onSuccess: () => toast.success("Attendance saved."),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save attendance."),
                    }
                  );
                }}
              >
                {saving ? "Saving..." : "Save attendance"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
