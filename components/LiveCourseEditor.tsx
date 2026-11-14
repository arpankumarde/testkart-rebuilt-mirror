import React, { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  Edit2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Info,
  ListTree,
  MoreHorizontal,
  Plus,
  Repeat,
  RotateCcw,
  Tags,
  Trash2,
  Users,
  Wallet,
  Video,
  XCircle,
} from "lucide-react";
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
import { Skeleton } from "./Skeleton";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { SegmentedControl } from "./SegmentedControl";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { ImageUploader } from "./ImageUploader";
import { LanguageMultiPicker } from "./LanguageMultiPicker";
import { AutoComplete, type Option } from "./AutoComplete";
import { LiveSessionAvatar } from "./LiveSession";
import styles from "./LiveCourseEditor.module.css";

const TIME_ZONE = "Asia/Kolkata";
const DESCRIPTION_MAX = 20000;

/* ---------------------------------------------------------------- shared --- */

type CardTone = "peach" | "lavender" | "blue" | "mint" | "butter";

const FormCard: React.FC<{ title: string; helper?: string; icon: React.ReactNode; tone: CardTone; children: React.ReactNode }> = ({
  title,
  helper,
  icon,
  tone,
  children,
}) => {
  const id = useId();
  return (
    <section className={`${styles.card} ${styles.formCard}`} aria-labelledby={id}>
      <header className={styles.cardHead}>
        <span className={`${styles.cardIcon} ${styles[`icon_${tone}`]}`} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.cardHeadText}>
          <h2 id={id} className={styles.cardTitle}>
            {title}
          </h2>
          {helper && <p className={styles.cardHelper}>{helper}</p>}
        </div>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
};

const IconAction: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, danger, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`${styles.iconAction} ${danger ? styles.iconDanger : ""}`}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

/* --------------------------------------------------------------- details --- */

export type LiveCourseDetailsValues = Omit<DetailsInput, "id">;

type Level = "beginner" | "intermediate" | "advanced";

type DetailsDraft = {
  title: string;
  description: string;
  thumbnailUrl: string;
  thumbnailFileId: string;
  examId: number | null;
  examText: string;
  languages: string[];
  level: Level;
  price: string;
  originalPrice: string;
  seatLimit: string;
  deadlineDate: string;
  deadlineTime: string;
  defaultMinutes: string;
};

const draftFromCourse = (course: LiveCourseDetail | null): DetailsDraft => {
  const deadline = course?.registrationDeadline ? dateToIst(course.registrationDeadline) : null;
  return {
    title: course?.title ?? "",
    description: course?.description ?? "",
    thumbnailUrl: course?.thumbnailUrl ?? "",
    thumbnailFileId: course?.thumbnailFileId ?? "",
    examId: course?.examId ?? null,
    examText: course?.examName ?? "",
    languages: course?.languages ?? [],
    level: course?.level ?? "beginner",
    price: course ? String(course.price) : "",
    originalPrice: course?.originalPrice ? String(course.originalPrice) : "",
    seatLimit: course ? String(course.seatLimit) : "30",
    deadlineDate: deadline?.date ?? "",
    deadlineTime: deadline?.time ?? "23:59",
    defaultMinutes: course ? String(course.defaultClassMinutes) : "60",
  };
};

const detailsSnapshot = (d: DetailsDraft) =>
  JSON.stringify({ ...d, title: d.title.trim(), description: d.description.trim(), examText: d.examText.trim() });

export const LiveCourseDetailsForm: React.FC<{
  course: LiveCourseDetail | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: (values: LiveCourseDetailsValues) => void;
  /** Teachers only: their platform fee, to show what they keep of the price. */
  platformFeePercentage?: number;
}> = ({ course, pending, submitLabel, onSubmit, platformFeePercentage }) => {
  const exams = useExamsQuery();
  const ids = useId();
  const [draft, setDraft] = useState<DetailsDraft>(() => draftFromCourse(course));
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof DetailsDraft>(key: K, value: DetailsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    setDraft(draftFromCourse(course));
    setAttempted(false);
  }, [course?.id]);

  const baseline = useMemo(() => detailsSnapshot(draftFromCourse(course)), [course]);
  const dirty = !!course && detailsSnapshot(draft) !== baseline;
  const canSubmit = !course || dirty;

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
  const selectedExam = examOptions.find((o) => o.metadata === draft.examId);

  const priceNum = Number(draft.price);
  const originalNum = Number(draft.originalPrice);
  const showDiscount = priceNum > 0 && originalNum > priceNum;
  const discountPct = showDiscount ? Math.round(((originalNum - priceNum) / originalNum) * 100) : 0;
  const titleError = attempted && !draft.title.trim() ? "Add a title." : null;
  const priceError = attempted && !(priceNum > 0) ? "Set a price. Live courses cannot be free." : null;
  const descriptionOver = draft.description.length > DESCRIPTION_MAX;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!draft.title.trim()) return toast.error("Add a title.");
    if (!(priceNum > 0)) return toast.error("Set a price. Live courses cannot be free.");
    onSubmit({
      title: draft.title.trim(),
      description: draft.description.trim(),
      thumbnailUrl: draft.thumbnailUrl || null,
      thumbnailFileId: draft.thumbnailFileId || null,
      examId: draft.examText.trim() ? draft.examId : null,
      languages: draft.languages,
      level: draft.level,
      price: priceNum,
      originalPrice: draft.originalPrice ? Number(draft.originalPrice) : null,
      seatLimit: Number(draft.seatLimit),
      registrationDeadline: draft.deadlineDate ? istToDate(draft.deadlineDate, draft.deadlineTime || "23:59") : null,
      defaultClassMinutes: Number(draft.defaultMinutes),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <FormCard title="Cover image" helper="Shown on your course page and wherever the course is listed." icon={<ImageIcon />} tone="peach">
        <div className={styles.coverLayout}>
          <div className={styles.cover}>
            <ImageUploader
              folder="live-courses"
              label="Upload cover image"
              aspectRatio="16 / 9"
              actions="toolbar"
              currentImageUrl={draft.thumbnailUrl || undefined}
              currentFileId={draft.thumbnailFileId || undefined}
              onSuccess={({ url, fileId }) => setDraft((d) => ({ ...d, thumbnailUrl: url, thumbnailFileId: fileId }))}
              onError={(err) => toast.error(err.message)}
            />
          </div>
          <div className={styles.coverGuide}>
            <h3 className={styles.guideTitle}>Image guidelines</h3>
            <ul className={styles.guideList}>
              <li>
                <CheckCircle2 aria-hidden="true" />
                1280 x 720 pixels (16:9)
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" />
                JPG or PNG, up to 5 MB
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" />
                Keep key text away from the edges so small cards do not crop it
              </li>
            </ul>
          </div>
        </div>
      </FormCard>

      <FormCard title="Basics" helper="The name and description students read before they enrol." icon={<FileText />} tone="lavender">
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids}-title`}>
            Title
          </label>
          <Input
            id={`${ids}-title`}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. SSC CGL Maths - 8 week live batch"
            maxLength={200}
            aria-invalid={!!titleError}
            aria-describedby={titleError ? `${ids}-title-error` : undefined}
          />
          {titleError && (
            <p id={`${ids}-title-error`} className={styles.error}>
              {titleError}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor={`${ids}-about`}>
              About this course
            </label>
            <span id={`${ids}-about-count`} className={`${styles.counter} ${descriptionOver ? styles.counterOver : ""}`}>
              {draft.description.length.toLocaleString("en-IN")} / {DESCRIPTION_MAX.toLocaleString("en-IN")}
            </span>
          </div>
          <Textarea
            id={`${ids}-about`}
            rows={6}
            className={styles.about}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What students learn, who it is for and how the classes run."
            aria-describedby={`${ids}-about-count`}
          />
        </div>
      </FormCard>

      <FormCard title="Classification" helper="Helps students find the course under the right exam and level." icon={<Tags />} tone="blue">
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label} id={`${ids}-exam`}>
              Exam
            </span>
            <div aria-labelledby={`${ids}-exam`} role="group">
              <AutoComplete
                options={examOptions}
                emptyMessage="No exam found"
                value={selectedExam}
                onValueChange={(o) => set("examId", o.metadata ?? null)}
                inputValue={draft.examText}
                onInputValueChange={(v) =>
                  setDraft((d) => ({ ...d, examText: v, examId: v.trim() ? d.examId : null }))
                }
                isLoading={exams.isLoading}
                placeholder="Search an exam"
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label} id={`${ids}-level`}>
              Level
            </span>
            <Select value={draft.level} onValueChange={(v) => set("level", v as Level)}>
              <SelectTrigger aria-labelledby={`${ids}-level`}>
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
          <div className={styles.languages}>
            <LanguageMultiPicker value={draft.languages} onChange={(v) => set("languages", v)} />
          </div>
        </div>
      </FormCard>

      <FormCard title="Pricing" helper="What students pay for the whole course. Live courses cannot be free." icon={<IndianRupee />} tone="mint">
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-price`}>
              Price
            </label>
            <div className={styles.money}>
              <span className={styles.moneyPrefix} aria-hidden="true">
                &#8377;
              </span>
              <Input
                id={`${ids}-price`}
                type="number"
                min="1"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => set("price", e.target.value)}
                aria-invalid={!!priceError}
                aria-describedby={priceError ? `${ids}-price-error` : undefined}
              />
            </div>
            {priceError && (
              <p id={`${ids}-price-error`} className={styles.error}>
                {priceError}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-original`}>
              Original price <span className={styles.labelNote}>(shown struck out)</span>
            </label>
            <div className={styles.money}>
              <span className={styles.moneyPrefix} aria-hidden="true">
                &#8377;
              </span>
              <Input
                id={`${ids}-original`}
                type="number"
                min="1"
                inputMode="decimal"
                value={draft.originalPrice}
                onChange={(e) => set("originalPrice", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
        {(showDiscount || (platformFeePercentage !== undefined && priceNum > 0)) && (
          <div className={styles.priceNotes} aria-live="polite">
            {showDiscount && (
              <p className={styles.pricePreview}>
                Students see <strong>{formatRupees(priceNum)}</strong>{" "}
                <span className={styles.struck}>{formatRupees(originalNum)}</span> ({discountPct}% off)
              </p>
            )}
            {platformFeePercentage !== undefined && priceNum > 0 && (
              <p className={styles.hint}>
                You keep {formatRupees(liveCourseEarnings(priceNum, 1, platformFeePercentage).perStudent)} of each student's{" "}
                {formatRupees(priceNum)} after Testkart's {platformFeePercentage}% fee, paid out class by class as you teach.
              </p>
            )}
          </div>
        )}
      </FormCard>

      <FormCard title="Enrolment" helper="Seats, the usual class length and when registration closes." icon={<Users />} tone="butter">
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-seats`}>
              Seats <span className={styles.labelNote}>(up to {LIVE_COURSE_SEAT_LIMIT_MAX})</span>
            </label>
            <Input
              id={`${ids}-seats`}
              type="number"
              min="1"
              max={LIVE_COURSE_SEAT_LIMIT_MAX}
              value={draft.seatLimit}
              onChange={(e) => set("seatLimit", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-minutes`}>
              Usual class length <span className={styles.labelNote}>(minutes)</span>
            </label>
            <Input
              id={`${ids}-minutes`}
              type="number"
              min="15"
              max="300"
              value={draft.defaultMinutes}
              onChange={(e) => set("defaultMinutes", e.target.value)}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-deadline`}>
              Registration closes on
            </label>
            <Input id={`${ids}-deadline`} type="date" value={draft.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-deadline-time`}>
              At <span className={styles.labelNote}>(IST)</span>
            </label>
            <Input id={`${ids}-deadline-time`} type="time" value={draft.deadlineTime} onChange={(e) => set("deadlineTime", e.target.value)} />
          </div>
        </div>
        <p className={styles.hint}>Registration can stay open after the first class. Students who join late see every earlier class too.</p>
      </FormCard>

      <div className={`${styles.saveBar} ${dirty ? styles.saveBarDirty : ""}`}>
        <span className={styles.saveStatus} aria-live="polite">
          {dirty ? (
            <>
              <span className={styles.dirtyDot} aria-hidden="true" />
              Unsaved changes
            </>
          ) : course ? (
            <>
              <CheckCircle2 size={16} aria-hidden="true" className={styles.savedIcon} />
              All changes saved
            </>
          ) : null}
        </span>
        <Button type="submit" disabled={pending || !canSubmit}>
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
const syllabusSnapshot = (modules: DraftModule[]) =>
  JSON.stringify(
    modules.map((m) => ({ id: m.id ?? null, title: m.title.trim(), topics: m.topics.map((t) => ({ id: t.id ?? null, title: t.title.trim() })) }))
  );

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const topicLabel = (n: number) => `${n} ${n === 1 ? "topic" : "topics"}`;

/* Short courses open every section; longer ones open only the first so the outline reads at a glance. */
const initialOpen = (list: { key: string }[]) => Object.fromEntries(list.map((m, i) => [m.key, list.length <= 2 || i === 0]));

const SyllabusBar: React.FC<{ sections: number; topics: number; allOpen: boolean; onToggleAll: () => void }> = ({
  sections,
  topics,
  allOpen,
  onToggleAll,
}) => (
  <div className={styles.syllabusBar}>
    <p className={styles.syllabusSummary}>
      <ListTree size={18} aria-hidden="true" className={styles.syllabusSummaryIcon} />
      <span>
        <strong>{sections}</strong> {sections === 1 ? "section" : "sections"}, <strong>{topics}</strong> {topics === 1 ? "topic" : "topics"}
      </span>
    </p>
    <Button type="button" variant="ghost" className={styles.toggleAll} onClick={onToggleAll}>
      {allOpen ? <ChevronsDownUp size={16} aria-hidden="true" /> : <ChevronsUpDown size={16} aria-hidden="true" />}
      {allOpen ? "Collapse all" : "Expand all"}
    </Button>
  </div>
);

const SectionToggle: React.FC<{ open: boolean; bodyId: string; label: string; onToggle: () => void }> = ({ open, bodyId, label, onToggle }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-lg"
    className={`${styles.iconAction} ${styles.chevron} ${open ? styles.chevronOpen : ""}`}
    aria-expanded={open}
    aria-controls={bodyId}
    aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
    onClick={onToggle}
  >
    <ChevronDown aria-hidden="true" />
  </Button>
);

const TopicPreview: React.FC<{ titles: string[] }> = ({ titles }) => {
  const named = titles.map((t) => t.trim()).filter(Boolean);
  if (named.length === 0) return null;
  const rest = named.length - 3;
  return (
    <p className={styles.topicPreview}>
      {named.slice(0, 3).join(", ")}
      {rest > 0 ? ` +${rest} more` : ""}
    </p>
  );
};

export const LiveCourseSyllabusEditor: React.FC<{ course: LiveCourseDetail; readOnly?: boolean }> = ({ course, readOnly }) => {
  const save = useSaveSyllabusMutation();
  const [modules, setModules] = useState<DraftModule[]>(() => toDraft(course.modules));
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  useEffect(() => setModules(toDraft(course.modules)), [course.id, JSON.stringify(course.modules)]);

  const baseline = useMemo(() => syllabusSnapshot(toDraft(course.modules)), [course.modules]);
  const dirty = syllabusSnapshot(modules) !== baseline;

  const update = (i: number, patch: Partial<DraftModule>) => setModules((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const addSection = () => setModules((ms) => [...ms, { key: newKey(), title: "", topics: [] }]);
  const dropSection = (i: number) => setModules((ms) => ms.filter((_, j) => j !== i));
  const removeSection = (i: number) => (modules[i].topics.length > 0 ? setConfirmRemove(i) : dropSection(i));

  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>(() => initialOpen(toDraft(course.modules)));
  const isOpen = (key: string) => openKeys[key] ?? true;
  const toggle = (key: string) => setOpenKeys((o) => ({ ...o, [key]: !(o[key] ?? true) }));
  const setAll = (keys: string[], open: boolean) => setOpenKeys(Object.fromEntries(keys.map((k) => [k, open])));

  const submit = () => {
    const unnamed = modules.filter((m) => !m.title.trim() || m.topics.some((t) => !t.title.trim()));
    if (unnamed.length > 0) {
      setOpenKeys((o) => ({ ...o, ...Object.fromEntries(unnamed.map((m) => [m.key, true])) }));
      toast.error("Every section and topic needs a name.");
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
    if (course.modules.length === 0) {
      return <ConsoleListEmpty title="No syllabus yet" />;
    }
    const keys = course.modules.map((m) => m.id);
    const allOpen = keys.every(isOpen);
    return (
      <div className={styles.stack}>
        <SyllabusBar
          sections={course.modules.length}
          topics={course.modules.reduce((n, m) => n + m.topics.length, 0)}
          allOpen={allOpen}
          onToggleAll={() => setAll(keys, !allOpen)}
        />
        <ol className={styles.sections}>
          {course.modules.map((m, i) => {
            const open = isOpen(m.id);
            const bodyId = `syllabus-${m.id}`;
            return (
              <li key={m.id} className={`${styles.section} ${open ? styles.sectionOpen : ""}`}>
                <div className={`${styles.sectionHeader} ${styles.sectionHeaderRead}`}>
                  <SectionToggle open={open} bodyId={bodyId} label={m.title} onToggle={() => toggle(m.id)} />
                  <span className={styles.sectionNo} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className={styles.sectionTitleWrap}>
                    <h2 className={styles.sectionName}>{m.title}</h2>
                    {!open && <TopicPreview titles={m.topics.map((t) => t.title)} />}
                  </div>
                  <span className={styles.topicCount}>{topicLabel(m.topics.length)}</span>
                </div>
                <div id={bodyId} className={styles.sectionBody} hidden={!open}>
                  <ol className={styles.topicList}>
                    {m.topics.length === 0 && <li className={styles.topicEmpty}>No topics in this section.</li>}
                    {m.topics.map((t, ti) => (
                      <li key={t.id} className={`${styles.topicItem} ${styles.topicItemRead}`}>
                        <span className={styles.topicIndex} aria-hidden="true">
                          {i + 1}.{ti + 1}
                        </span>
                        <span className={styles.topicName}>{t.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const pendingRemoval = confirmRemove !== null ? modules[confirmRemove] : null;

  return (
    <div className={styles.stack}>
      {modules.length === 0 ? (
        <ConsoleListEmpty title="No syllabus yet" description="Break the course into sections, then list the topics in each.">
          <Button type="button" variant="outline" onClick={addSection}>
            <Plus size={16} aria-hidden="true" /> Add section
          </Button>
        </ConsoleListEmpty>
      ) : (
        <>
          <SyllabusBar
            sections={modules.length}
            topics={modules.reduce((n, m) => n + m.topics.length, 0)}
            allOpen={modules.every((m) => isOpen(m.key))}
            onToggleAll={() => setAll(modules.map((m) => m.key), !modules.every((m) => isOpen(m.key)))}
          />
          <ol className={styles.sections}>
            {modules.map((m, i) => {
              const open = isOpen(m.key);
              const bodyId = `syllabus-${m.key}`;
              return (
                <li key={m.key} className={`${styles.section} ${open ? styles.sectionOpen : ""}`}>
                  <div className={styles.sectionHeader}>
                    <SectionToggle open={open} bodyId={bodyId} label={m.title.trim() || `Section ${i + 1}`} onToggle={() => toggle(m.key)} />
                    <span className={styles.sectionNo} aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className={styles.sectionTitleWrap}>
                      <Input
                        className={styles.sectionInput}
                        value={m.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="Section name"
                        aria-label={`Section ${i + 1} name`}
                      />
                      {!open && <TopicPreview titles={m.topics.map((t) => t.title)} />}
                    </div>
                    <span className={styles.topicCount}>{topicLabel(m.topics.length)}</span>
                    <div className={styles.rowActions}>
                      <IconAction label="Move section up" disabled={i === 0} onClick={() => setModules((ms) => move(ms, i, i - 1))}>
                        <ArrowUp aria-hidden="true" />
                      </IconAction>
                      <IconAction
                        label="Move section down"
                        disabled={i === modules.length - 1}
                        onClick={() => setModules((ms) => move(ms, i, i + 1))}
                      >
                        <ArrowDown aria-hidden="true" />
                      </IconAction>
                      <IconAction label="Delete section" danger onClick={() => removeSection(i)}>
                        <Trash2 aria-hidden="true" />
                      </IconAction>
                    </div>
                  </div>

                  <div id={bodyId} className={styles.sectionBody} hidden={!open}>
                    <ol className={styles.topicList} aria-label={`Topics in section ${i + 1}`}>
                      {m.topics.length === 0 && <li className={styles.topicEmpty}>No topics yet. Add the first one below.</li>}
                      {m.topics.map((t, ti) => (
                        <li key={t.key} className={styles.topicItem}>
                          <span className={styles.topicIndex} aria-hidden="true">
                            {i + 1}.{ti + 1}
                          </span>
                          <Input
                            value={t.title}
                            onChange={(e) => update(i, { topics: m.topics.map((x, k) => (k === ti ? { ...x, title: e.target.value } : x)) })}
                            placeholder="Topic name"
                            aria-label={`Topic ${ti + 1} of section ${i + 1}`}
                          />
                          <div className={styles.rowActions}>
                            <IconAction label="Move topic up" disabled={ti === 0} onClick={() => update(i, { topics: move(m.topics, ti, ti - 1) })}>
                              <ArrowUp aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label="Move topic down"
                              disabled={ti === m.topics.length - 1}
                              onClick={() => update(i, { topics: move(m.topics, ti, ti + 1) })}
                            >
                              <ArrowDown aria-hidden="true" />
                            </IconAction>
                            <IconAction label="Delete topic" danger onClick={() => update(i, { topics: m.topics.filter((_, k) => k !== ti) })}>
                              <Trash2 aria-hidden="true" />
                            </IconAction>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      className={styles.addTopicRow}
                      onClick={() => update(i, { topics: [...m.topics, { key: newKey(), title: "" }] })}
                    >
                      <Plus size={16} aria-hidden="true" /> Add topic
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" className={styles.addSectionRow} onClick={addSection}>
            <Plus size={18} aria-hidden="true" /> Add section
          </button>
        </>
      )}

      {(modules.length > 0 || dirty) && (
        <div className={`${styles.saveBar} ${dirty ? styles.saveBarDirty : ""}`}>
          <span className={styles.saveStatus} aria-live="polite">
            {dirty && (
              <>
                <span className={styles.dirtyDot} aria-hidden="true" />
                Unsaved changes
              </>
            )}
          </span>
          <Button type="button" onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save syllabus"}
          </Button>
        </div>
      )}

      <ConsoleConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
        title={`Delete "${pendingRemoval?.title.trim() || `Section ${(confirmRemove ?? 0) + 1}`}"?`}
        description={`Its ${pendingRemoval?.topics.length ?? 0} topic${pendingRemoval?.topics.length === 1 ? "" : "s"} go with it. Nothing changes for students until you save the syllabus.`}
        tone="destructive"
        confirmLabel="Delete section"
        onConfirm={() => {
          if (confirmRemove !== null) dropSection(confirmRemove);
          setConfirmRemove(null);
        }}
      />
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

const istPart = (date: Date | string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: TIME_ZONE }).format(new Date(date));

const groupByMonth = (classes: LiveCourseClass[]) => {
  const groups: { label: string; items: LiveCourseClass[] }[] = [];
  for (const c of classes) {
    const label = istPart(c.startTime, { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(c);
    else groups.push({ label, items: [c] });
  }
  return groups;
};

const dayLabel = (date: Date | string) => istPart(date, { weekday: "short", day: "numeric", month: "short" });

const DateBlock: React.FC<{ date: Date | string }> = ({ date }) => (
  <span className={styles.dateBlock} aria-hidden="true">
    <span className={styles.dateMonth}>{istPart(date, { month: "short" })}</span>
    <span className={styles.dateDay}>{istPart(date, { day: "numeric" })}</span>
    <span className={styles.dateWeekday}>{istPart(date, { weekday: "short" })}</span>
  </span>
);

/** What the teacher earns from this course, per held class and per student. */
export const LiveCourseEarningsCard: React.FC<{ earnings: LiveCourseEarningsPreview; enrolled: number }> = ({ earnings, enrolled }) => {
  if (earnings.perStudent <= 0) return null;
  return (
    <section className={`${styles.card} ${styles.formCard}`} aria-labelledby="live-course-earnings-title">
      <header className={styles.cardHead}>
        <span className={`${styles.cardIcon} ${styles.icon_mint}`} aria-hidden="true">
          <Wallet />
        </span>
        <div className={styles.cardHeadText}>
          <div className={styles.titleRow}>
            <h2 id="live-course-earnings-title" className={styles.cardTitle}>
              Your earnings
            </h2>
            <span className={`${styles.chip} ${earnings.fixed ? styles.tone_mint : styles.tone_butter}`}>{earnings.fixed ? "Fixed" : "Estimate"}</span>
          </div>
          <p className={styles.cardHelper}>{earnings.fixed ? "Paid to you after each class you hold." : "Fixed when you publish."}</p>
        </div>
      </header>
      <div className={styles.cardBody}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <strong className={styles.statValue}>{earnings.perClassPerStudent > 0 ? formatRupees(earnings.perClassPerStudent) : "-"}</strong>
          <span className={styles.statLabel}>per student for each class you hold</span>
        </div>
        <div className={styles.stat}>
          <strong className={styles.statValue}>{formatRupees(earnings.perStudent)}</strong>
          <span className={styles.statLabel}>per student for the whole course</span>
        </div>
        {enrolled > 0 && (
          <div className={styles.stat}>
            <strong className={styles.statValue}>{formatRupees(Math.round(earnings.perStudent * enrolled * 100) / 100)}</strong>
            <span className={styles.statLabel}>with {enrolled} enrolled</span>
          </div>
        )}
      </div>
      <p className={styles.earningsNote}>
        <Info size={16} aria-hidden="true" className={styles.earningsNoteIcon} />
        <span>
          {earnings.fixed
            ? "Fixed since you published. Paid after each class you hold. Classes added later earn nothing extra."
            : earnings.perClassPerStudent > 0
              ? "Based on the classes in your timetable now. It is fixed when you publish."
              : "Add classes to see what you earn for each one."}
          {earnings.platformFeePercentage > 0 ? ` Testkart's ${earnings.platformFeePercentage}% fee is already deducted.` : ""}
        </span>
      </p>
      </div>
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
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const cancel = useCancelClassMutation();
  const editable = mode === "teacher" && (course.status === "draft" || course.status === "published");
  const topics = topicOptions(course.modules);
  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.label ?? null;
  const now = Date.now();
  const upcoming = course.classes.filter((c) => c.status === "scheduled" && new Date(c.startTime).getTime() + c.durationMinutes * 60000 > now);
  const past = course.classes.filter((c) => !upcoming.includes(c));
  const shown = view === "upcoming" ? upcoming : past;
  const groups = groupByMonth(shown);
  const timetable = course.classes
    .filter((c) => c.status !== "cancelled")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  /* Only the first month starts open, so a long timetable reads as a list of months. */
  const [monthState, setMonthState] = useState<Record<string, boolean>>({});
  const monthKey = (label: string) => `${view}:${label}`;
  const monthOpen = (label: string, index: number) => monthState[monthKey(label)] ?? index === 0;
  const toggleMonth = (label: string, index: number) => setMonthState((s) => ({ ...s, [monthKey(label)]: !(s[monthKey(label)] ?? index === 0) }));
  const allMonthsOpen = groups.every((g, i) => monthOpen(g.label, i));
  const setAllMonths = (open: boolean) => setMonthState((s) => ({ ...s, ...Object.fromEntries(groups.map((g) => [monthKey(g.label), open])) }));

  const row = (c: LiveCourseClass) => {
    const state = classState(c);
    const open = c.status === "scheduled";
    const topic = topicName(c.topicId);
    return (
      <li key={c.id} className={`${styles.classRow} ${open ? "" : styles.classSettled}`}>
        <DateBlock date={c.startTime} />
        <div className={styles.classBody}>
          <div className={styles.classHead}>
            <h4 className={styles.classTitle}>{c.title}</h4>
            {state && <span className={`${styles.chip} ${styles[`tone_${state.tone}`]}`}>{state.label}</span>}
          </div>
          <p className={styles.classMeta}>
            {formatIstShort(c.startTime)} IST - {c.durationMinutes} min{topic ? ` - ${topic}` : ""}
          </p>
          {c.cancellationReason && <p className={styles.reason}>{c.cancellationReason}</p>}
        </div>
        {open && (course.status !== "draft" || editable || (mode === "admin" && onAdminCancel)) && (
          <div className={styles.classActions}>
            {course.status !== "draft" && (
              <Button variant="outline" asChild>
                <a href={classroomPath(c.id)} target="_blank" rel="noopener noreferrer" onClick={(e) => handleClassroomLinkClick(e, classroomPath(c.id))}>
                  <Video size={16} aria-hidden="true" /> Classroom
                </a>
              </Button>
            )}
            {(editable || (mode === "admin" && onAdminCancel)) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-lg" className={styles.iconAction} aria-label={`More options for ${c.title}`}>
                    <MoreHorizontal aria-hidden="true" />
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
      </li>
    );
  };

  return (
    <div className={styles.stack}>
      {earnings && <LiveCourseEarningsCard earnings={earnings} enrolled={course.enrolledCount} />}
      {(editable || course.status === "published") && (
        <section className={`${styles.card} ${styles.formCard}`} aria-labelledby="live-course-timetable-title">
          <header className={`${styles.cardHead} ${styles.cardHeadSplit} ${course.status === "published" ? "" : styles.cardHeadOnly}`}>
            <span className={`${styles.cardIcon} ${styles.icon_blue}`} aria-hidden="true">
              <CalendarDays />
            </span>
            <div className={styles.cardHeadText}>
              <h2 id="live-course-timetable-title" className={styles.cardTitle}>
                Timetable
              </h2>
              <p className={styles.cardHelper}>
                {timetable.length > 0
                  ? `${timetable.length} ${timetable.length === 1 ? "class" : "classes"} from ${dayLabel(timetable[0].startTime)} to ${dayLabel(timetable[timetable.length - 1].startTime)}. Times are in IST.`
                  : "No classes yet. Times are in IST."}
              </p>
            </div>
            {editable && (
              <div className={styles.headActions}>
                <Button onClick={() => setPattern(true)}>
                  <Repeat size={16} aria-hidden="true" /> Add weekly classes
                </Button>
                <Button variant="outline" onClick={() => setSingle("new")}>
                  <CalendarPlus size={16} aria-hidden="true" /> Add one class
                </Button>
              </div>
            )}
          </header>
          {course.status === "published" && (
            <div className={styles.cardBody}>
              <ul className={styles.policyList}>
                <li>
                  <Bell size={16} aria-hidden="true" />
                  <span>Students are told by email and WhatsApp whenever you add, move or cancel a class.</span>
                </li>
                <li>
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>
                    {refundClosesAt
                      ? `Full refunds stay open until ${formatIstShort(refundClosesAt)} IST, when the 3rd class starts.`
                      : "Full refunds stay open until the 3rd class starts."}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={styles.schedule} aria-labelledby="live-course-classes-heading">
        <div className={styles.listHead}>
          <h2 id="live-course-classes-heading" className={styles.listTitle}>
            {view === "upcoming" ? "Upcoming" : "Past"} ({shown.length})
          </h2>
          <div className={styles.listControls}>
            {groups.length > 1 && (
              <Button type="button" variant="ghost" className={styles.toggleAll} onClick={() => setAllMonths(!allMonthsOpen)}>
                {allMonthsOpen ? <ChevronsDownUp size={16} aria-hidden="true" /> : <ChevronsUpDown size={16} aria-hidden="true" />}
                {allMonthsOpen ? "Collapse all" : "Expand all"}
              </Button>
            )}
            <SegmentedControl
              aria-label="Show classes"
              value={view}
              onValueChange={setView}
              className={styles.viewToggle}
              options={[
                { value: "upcoming", label: "Upcoming" },
                { value: "past", label: "Past" },
              ]}
            />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className={styles.empty}>{view === "upcoming" ? "No upcoming classes." : "No past classes yet."}</p>
        ) : (
          <div className={styles.months}>
            {groups.map((g, gi) => {
              const open = monthOpen(g.label, gi);
              const bodyId = `live-course-month-${view}-${gi}`;
              const first = g.items[0].startTime;
              const last = g.items[g.items.length - 1].startTime;
              return (
                <section key={g.label} className={`${styles.monthCard} ${open ? styles.monthCardOpen : ""}`}>
                  <h3 className={styles.monthHeading}>
                    <button type="button" className={styles.monthToggle} aria-expanded={open} aria-controls={bodyId} onClick={() => toggleMonth(g.label, gi)}>
                      <span className={`${styles.cardIcon} ${styles.icon_blue}`} aria-hidden="true">
                        <CalendarDays />
                      </span>
                      <span className={styles.monthText}>
                        <span className={styles.monthName}>{g.label}</span>
                        <span className={styles.monthRange}>
                          {istPart(first, { day: "numeric", month: "short" })}
                          {g.items.length > 1 ? ` to ${istPart(last, { day: "numeric", month: "short" })}` : ""}
                        </span>
                      </span>
                      <span className={styles.topicCount}>
                        {g.items.length} {g.items.length === 1 ? "class" : "classes"}
                      </span>
                      <ChevronDown aria-hidden="true" className={`${styles.monthChevron} ${open ? styles.monthChevronOpen : ""}`} />
                    </button>
                  </h3>
                  <div id={bodyId} className={styles.monthBody} hidden={!open}>
                    <ul className={styles.classList}>{g.items.map(row)}</ul>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

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
  /** The public course page, offered from the empty state while the course is live. */
  viewPageHref?: string;
}> = ({ roster, loading, canMark, onRefund, onSaveMarks, savingMarks, viewPageHref }) => {
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

  if (loading && !roster) {
    return (
      <div className={styles.card} aria-busy="true" aria-label="Loading students">
        <Skeleton className={styles.skeletonRow} />
        <Skeleton className={styles.skeletonRow} />
        <Skeleton className={styles.skeletonRow} />
      </div>
    );
  }
  if (!roster || roster.students.length === 0) {
    return (
      <ConsoleListEmpty icon={<Users size={28} />} title="No students yet" description="Students appear here after they enrol in this course.">
        {viewPageHref && (
          <Button variant="outline" asChild>
            <a href={viewPageHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" /> View page
            </a>
          </Button>
        )}
      </ConsoleListEmpty>
    );
  }

  const attendedBy = (studentId: number) => roster.attendance.filter((a) => a.studentId === studentId && a.present).length;

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.tableCard}`} aria-label="Enrolled students">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Enrolled</th>
              <th scope="col">Paid</th>
              <th scope="col">Attendance</th>
              <th scope="col">Status</th>
              {onRefund && (
                <th scope="col">
                  <span className={styles.srOnly}>Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {roster.students.map((s) => (
              <tr key={s.enrollmentId}>
                <td className={styles.studentCell}>
                  <span className={styles.student}>
                    <LiveSessionAvatar name={s.name} />
                    <span className={styles.studentText}>
                      <span className={styles.studentName}>{s.name}</span>
                      {s.email && <span className={styles.studentSub}>{s.email}</span>}
                    </span>
                  </span>
                </td>
                <td data-label="Enrolled">{formatIstShort(s.enrolledAt)}</td>
                <td data-label="Paid">{formatRupees(s.amountPaid)}</td>
                <td data-label="Attendance">
                  {attendedBy(s.studentId)} / {classes.length}
                </td>
                <td data-label="Status">
                  {s.status === "enrolled" ? (
                    <span className={`${styles.chip} ${styles.tone_mint}`}>Enrolled</span>
                  ) : (
                    <span className={`${styles.chip} ${styles.tone_peach}`}>
                      {s.status === "refunded" ? `Refunded${s.refundStatus ? ` (${s.refundStatus.toLowerCase()})` : ""}` : "Removed"}
                    </span>
                  )}
                </td>
                {onRefund && (
                  <td className={styles.actionCell}>
                    {s.status === "enrolled" && (
                      <Button variant="outline" size="sm" onClick={() => onRefund(s.enrollmentId, s.name)}>
                        Refund
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <FormCard title="Attendance" helper="Students who join the classroom are marked present on their own." icon={<ClipboardCheck />} tone="blue">
        {classes.length === 0 ? (
          <p className={styles.empty}>Attendance opens once the first class starts.</p>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.label} id="live-course-attendance-class">
                Class
              </span>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger aria-labelledby="live-course-attendance-class" className={styles.classSelect}>
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
            <ul className={styles.attendanceList}>
              {enrolled.map((s) => (
                <li key={s.studentId}>
                  <label className={styles.attendanceRow}>
                    <Checkbox
                      checked={!!marks[s.studentId]}
                      disabled={!canMark}
                      onChange={(e) => setMarks((m) => ({ ...m, [s.studentId]: e.target.checked }))}
                    />
                    <span className={styles.attendanceName}>{s.name}</span>
                    <span className={styles.studentSub}>
                      {roster.attendance.find((a) => a.classId === classId && a.studentId === s.studentId)?.source === "auto" ? "Joined the classroom" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {canMark && enrolled.length > 0 && (
              <div className={styles.cardActions}>
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
      </FormCard>
    </div>
  );
};
