import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, ChevronDown, Eye, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { GecEventsEditor, gecIsBlankEvent, gecStarterEvents } from "../components/GecEventsEditor";
import { GecExamPicker, type GecPickedExam } from "../components/GecExamPicker";
import { GecNewsPicker } from "../components/GecNewsPicker";
import { GecPublishDialog } from "../components/GecPublishDialog";
import { GovtExamsStatus } from "../components/GovtExamsTable";
import {
  GEC_ADMIN_PATH,
  GEC_CATEGORIES,
  GEC_CATEGORY_SECTION,
  GEC_RECORD_TYPES,
  GEC_STATUSES,
  GEC_TABLE_COLUMNS,
  GEC_VERIFICATIONS,
  gecBlock,
  gecLabel,
  type GecCategory,
  type GecNewsLink,
  type GecSectionId,
} from "../helpers/gecModel";
import { emptyGecExam, gecExamToInput, gecInputToExam, validateGecExam, type GecExamInput, type GecIssue } from "../helpers/gecExamInput";
import { buildGecView, gecApplicationOpen, gecDay, gecExamStatus } from "../helpers/gecView";
import { GecValidationError } from "../helpers/gecFetch";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { adminFormat } from "../helpers/adminFormat";
import { todayInIndia } from "../helpers/govtExamsCalendarFilter";
import { useAdminGecDraft, useAdminGecExam, useAdminGecMeta, useDeleteGecExam, useSaveGecExam } from "../helpers/useAdminGovtExamsCalendar";
import { toast } from "sonner";
import styles from "./admin.govt-exams-calendar.exam.$id.module.css";

const AUTO = "__auto";
type TableKey = keyof typeof GEC_TABLE_COLUMNS;
type SectionKey = "basic" | "dates" | "application" | "news" | "display" | "internal";

const DEFAULT_OPEN: Record<SectionKey, boolean> = { basic: true, dates: true, application: false, news: false, display: false, internal: false };

/** Which section holds the field an issue points at, so a save error opens it. */
const sectionOfPath = (path: string): SectionKey => {
  if (path.startsWith("events")) return "dates";
  if (["vacancies", "applyUrl", "notificationUrl", "noticeNumber", "postsDescription", "postName"].includes(path)) return "application";
  if (["newsPostId", "testkartExamId"].includes(path)) return "news";
  if (["statusOverride", "statusLabel", "tableName", "shortName", "keywords", "cellOverrides", "sortOrder"].some((key) => path.startsWith(key))) return "display";
  if (["sourceNote", "reviewNote"].includes(path)) return "internal";
  return "basic";
};

/** The date-like cell of each public table, for the compact preview. */
const DATE_CELL: Partial<Record<GecSectionId, number>> = {
  "next-30-days": 0,
  "upsc-2027": 3,
  "ssc-2026-27": 3,
  "banking-ibps": 1,
  "railway-rrb": 2,
  "state-exams": 2,
  "open-applications": 0,
  "recently-concluded": 2,
};

const Field: React.FC<{ label: string; htmlFor: string; hint?: string; error?: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  error,
  wide,
  children,
}) => (
  <div className={`${styles.field} ${wide ? styles.wide : ""}`}>
    <label htmlFor={htmlFor} className={styles.label}>
      {label}
    </label>
    {children}
    {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
  </div>
);

interface SectionProps {
  id: SectionKey;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  progress?: { done: number; total: number } | string;
  hasError?: boolean;
  children: React.ReactNode;
}

/** One accordion section. Collapsed sections stay mounted, so their values are kept and still saved. */
const Section: React.FC<SectionProps> = ({ id, title, description, open, onToggle, summary, progress, hasError, children }) => {
  const complete = typeof progress === "object" && progress.done === progress.total;
  return (
    <section className={`${styles.section} ${hasError ? styles.sectionError : ""}`}>
      <button type="button" className={styles.sectionHead} aria-expanded={open} aria-controls={`gec-section-${id}`} onClick={onToggle}>
        <span className={styles.sectionTitles}>
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionText}>{open || !summary ? description : summary}</span>
        </span>
        {hasError ? (
          <span className={`${styles.progress} ${styles.progressError}`}>Needs attention</span>
        ) : progress !== undefined ? (
          <span className={`${styles.progress} ${complete ? styles.progressDone : ""}`}>
            {complete && <Check size={12} aria-hidden="true" />}
            {typeof progress === "string" ? progress : `${progress.done}/${progress.total}`}
          </span>
        ) : null}
        <ChevronDown size={18} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true" />
      </button>
      <div id={`gec-section-${id}`} className={styles.sectionBody} hidden={!open}>
        {children}
      </div>
    </section>
  );
};

const AdminGecExamEditorPage: React.FC = () => {
  const { id: idParam } = useParams<{ id: string }>();
  const isNew = idParam === "new";
  const id = !isNew && idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const navigate = useNavigate();

  const { data, isFetching, isError, error, refetch } = useAdminGecExam(id);
  const { data: draft } = useAdminGecDraft();
  const { data: meta } = useAdminGecMeta();
  const save = useSaveGecExam();
  const remove = useDeleteGecExam();

  const [form, setForm] = useState<GecExamInput | null>(isNew ? { ...emptyGecExam(), events: gecStarterEvents("exam") } : null);
  const [linked, setLinked] = useState<GecPickedExam | null>(null);
  const [news, setNews] = useState<GecNewsLink | null>(null);
  const [issues, setIssues] = useState<GecIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(DEFAULT_OPEN);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (data?.exam && !dirty) {
      setForm(gecExamToInput(data.exam));
      setLinked(data.exam.testkartExam);
      setNews(data.exam.newsPost ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const today = draft?.today ?? todayInIndia();

  const set = <K extends keyof GecExamInput>(key: K, value: GecExamInput[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };
  const text = (key: keyof GecExamInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, event.target.value as never);
  const issue = (path: string) => issues.find((item) => item.path === path)?.message;
  const sectionHasError = (key: SectionKey) => issues.some((item) => sectionOfPath(item.path) === key);
  const toggle = (key: SectionKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const record = useMemo(() => (form ? gecInputToExam({ ...form, newsPostId: news?.id ?? null }, linked, news) : null), [form, linked, news]);

  /* Where the record lands on the page if saved and published as it stands. */
  const placement = useMemo(() => {
    if (!record || !draft) return null;
    const others = draft.snapshot.exams.filter((item) => item.id !== record.id);
    const view = buildGecView({ ...draft.snapshot, exams: [...others, record] }, today, today);
    return {
      status: gecExamStatus(record, today),
      rows: view.tableList.flatMap((table) =>
        table.rows.filter((row) => row.examId === record.id).map((row) => ({ section: table.id, columns: table.columns, row }))
      ),
    };
  }, [record, draft, today]);

  const saveRecord = async (): Promise<number | null> => {
    if (!form) return null;
    const cleaned: GecExamInput = { ...form, events: form.events.filter((event) => !gecIsBlankEvent(event)), testkartExamId: linked?.id ?? null, newsPostId: news?.id ?? null };
    const local = validateGecExam(cleaned);
    if (!cleaned.name.trim()) local.push({ path: "name", message: "Exam name is required" });
    if (!cleaned.conductingBody.trim()) local.push({ path: "conductingBody", message: "Conducting body is required" });
    const fail = (found: GecIssue[], message: string) => {
      setForm(cleaned);
      setIssues(found);
      setOpen((prev) => ({ ...prev, ...Object.fromEntries(found.map((item) => [sectionOfPath(item.path), true])) }));
      toast.error(message);
    };
    if (local.length) {
      fail(local, `${local.length} field${local.length === 1 ? " needs" : "s need"} attention`);
      return null;
    }
    try {
      const result = await save.mutateAsync(cleaned);
      setIssues([]);
      setDirty(false);
      setForm(gecExamToInput(result.exam));
      setNews(result.exam.newsPost ?? null);
      if (isNew) navigate(`${GEC_ADMIN_PATH}/exam/${result.exam.id}`, { replace: true });
      return result.exam.id;
    } catch (err) {
      if (err instanceof GecValidationError) fail(err.issues, err.message);
      else toast.error(parseErrorMessage(err));
      return null;
    }
  };

  const onSaveDraft = async () => {
    if (await saveRecord()) toast.success("Saved to the draft. Publish to update the public page.");
  };

  const onSavePreview = async () => {
    if (!(await saveRecord())) return;
    const section = placement?.rows[0]?.section ?? (form ? GEC_CATEGORY_SECTION[form.category] : null) ?? "next-30-days";
    navigate(`${GEC_ADMIN_PATH}/preview?section=${section}`);
  };

  const onPublish = async () => {
    if (dirty || isNew) {
      if (!(await saveRecord())) return;
    }
    setPublishing(true);
  };

  if (!isNew && id === null) {
    return (
      <div className={styles.page}>
        <ConsoleListEmpty icon={<AlertCircle size={24} />} title="Record not found" description="The link is wrong." />
      </div>
    );
  }

  if (!form || !record) {
    return (
      <div className={styles.page}>
        {isError && !isFetching ? (
          <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load this record" description={parseErrorMessage(error)}>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        ) : (
          <div className={styles.loading}>
            <Skeleton style={{ height: "3rem" }} />
            <Skeleton style={{ height: "18rem" }} />
            <Skeleton style={{ height: "14rem" }} />
          </div>
        )}
      </div>
    );
  }

  const saved = data?.exam;
  const isRecruitment = form.recordType === "recruitment";
  const tableKey = !isRecruitment && form.category !== "central" ? (form.category as TableKey) : null;
  const hasDeadline = form.events.some((event) => event.type === "application_deadline");
  const showRailway = form.category === "railway" || !!form.noticeNumber || !!form.postsDescription;
  const showPost = isRecruitment || hasDeadline || !!form.postName;

  const deadline = record.events
    .filter((event) => event.type === "application_deadline" && event.startDate)
    .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
    .pop();
  const applicationStatus = gecApplicationOpen(record, today)
    ? `Open until ${gecDay(deadline!.startDate!)}`
    : deadline?.startDate
      ? deadline.startDate < today
        ? `Closed on ${gecDay(deadline.startDate)}`
        : `Opens before ${gecDay(deadline.startDate)}`
      : "No last date yet";

  const datedCount = record.events.filter((event) => event.startDate).length;
  const appFilled = [form.applyUrl, form.notificationUrl, form.vacancies !== null ? "x" : null].filter(Boolean).length;
  const overrideCount =
    [form.tableName, form.shortName, form.keywords, form.statusOverride].filter(Boolean).length +
    Object.values(form.cellOverrides).filter((value) => value.trim()).length;

  const publishedAt = meta?.publication?.publishedAt ?? null;
  const publishState = form.isHidden
    ? { label: "Archived", hint: "Hidden from the public page", tone: styles.stateArchived, live: false }
    : isNew || !saved
      ? { label: "Draft", hint: "Not saved yet", tone: styles.stateDraft, live: false }
      : dirty || (saved.updatedAt && publishedAt && saved.updatedAt > publishedAt)
        ? { label: "Draft changes", hint: "Publish to update the public page", tone: styles.stateDraft, live: false }
        : { label: "Published", hint: publishedAt ? `Live since ${adminFormat.relativeTime(publishedAt)}` : "Live", tone: styles.statePublished, live: true };

  return (
    <>
      <Helmet>
        <title>{`${isNew ? "Add exam" : form.name || "Edit exam"} - Exam Calendar - Testkart Admin`}</title>
      </Helmet>

      <form
        className={styles.page}
        onSubmit={(event) => {
          event.preventDefault();
          onSaveDraft();
        }}
      >
        <div className={styles.top}>
          <Link to={GEC_ADMIN_PATH} className={styles.back}>
            <ArrowLeft size={15} /> Exam Calendar
          </Link>
          <h1 className={styles.title}>{isNew ? "Add exam" : form.name || "Edit exam"}</h1>
        </div>

        {saved?.reviewNote && (
          <div className={styles.review} role="note">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              <strong>Flagged for review:</strong> {saved.reviewNote}
            </span>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.main}>
            <Section
              id="basic"
              title="Basic information"
              description="What the exam is called and who conducts it."
              open={open.basic}
              onToggle={() => toggle("basic")}
              summary={`${form.name || "Unnamed"} - ${form.conductingBody || "no body"} - ${gecLabel(GEC_CATEGORIES, form.category)}`}
              progress={{ done: [form.name.trim(), form.conductingBody.trim(), form.category].filter(Boolean).length, total: 3 }}
              hasError={sectionHasError("basic")}
            >
              <div className={styles.grid}>
                <Field label="Exam name" htmlFor="gec-name" error={issue("name")} hint="As shown in Next 30 days, e.g. SSC Combined Graduate Level (CGL) 2026" wide>
                  <Input id="gec-name" value={form.name} maxLength={200} onChange={text("name")} />
                </Field>
                <Field label="Conducting body / organisation" htmlFor="gec-body" error={issue("conductingBody")}>
                  <Input id="gec-body" value={form.conductingBody} maxLength={80} placeholder="e.g. SSC, RRB, IBPS, UPPSC" onChange={text("conductingBody")} />
                </Field>
                <Field
                  label="Category"
                  htmlFor="gec-category"
                  hint={GEC_CATEGORY_SECTION[form.category] ? `Listed in ${gecBlock(GEC_CATEGORY_SECTION[form.category]!)?.label}` : "No category table of its own"}
                >
                  <Select value={form.category} onValueChange={(value) => set("category", value as GecCategory)}>
                    <SelectTrigger id="gec-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GEC_CATEGORIES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Record type" htmlFor="gec-type" hint={GEC_RECORD_TYPES.find((item) => item.value === form.recordType)?.hint}>
                  <Select value={form.recordType} onValueChange={(value) => set("recordType", value as GecExamInput["recordType"])}>
                    <SelectTrigger id="gec-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GEC_RECORD_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section
              id="dates"
              title="Important dates"
              description="Notification, application window, exam and any other dates. Sections on the page follow these."
              open={open.dates}
              onToggle={() => toggle("dates")}
              summary={`${datedCount} dated, ${record.events.length - datedCount} to be announced`}
              progress={`${record.events.length} date${record.events.length === 1 ? "" : "s"}`}
              hasError={sectionHasError("dates")}
            >
              <GecEventsEditor events={form.events} issues={issues} today={today} onChange={(events) => set("events", events)} />
            </Section>

            <Section
              id="application"
              title="Application and recruitment details"
              description="Links, vacancies and notice details for applicants."
              open={open.application}
              onToggle={() => toggle("application")}
              summary={[applicationStatus, form.vacancies !== null ? `${adminFormat.count(form.vacancies)} posts` : null].filter(Boolean).join(" - ")}
              progress={{ done: appFilled, total: 3 }}
              hasError={sectionHasError("application")}
            >
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.wide}`}>
                  <span className={styles.label}>Application status</span>
                  <span className={styles.readout}>{applicationStatus}</span>
                  <span className={styles.hint}>Worked out from the application dates. To extend, set the last date's status to Extended.</span>
                </div>
                <Field label="Application link" htmlFor="gec-apply-url" error={issue("applyUrl")}>
                  <Input id="gec-apply-url" value={form.applyUrl ?? ""} placeholder="https://" onChange={text("applyUrl")} />
                </Field>
                <Field label="Official notification link" htmlFor="gec-notification-url" error={issue("notificationUrl")}>
                  <Input id="gec-notification-url" value={form.notificationUrl ?? ""} placeholder="https://" onChange={text("notificationUrl")} />
                </Field>
                <Field label="Vacancies" htmlFor="gec-vacancies" error={issue("vacancies")} hint="Optional">
                  <Input
                    id="gec-vacancies"
                    type="number"
                    min={0}
                    value={form.vacancies ?? ""}
                    onChange={(e) => set("vacancies", e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))}
                  />
                </Field>
                {showPost && (
                  <Field label="Post name in Open applications" htmlFor="gec-post" hint="Defaults to the exam name, e.g. Station Master">
                    <Input id="gec-post" value={form.postName ?? ""} maxLength={200} onChange={text("postName")} />
                  </Field>
                )}
                {showRailway && (
                  <>
                    <Field label="CEN / notice number" htmlFor="gec-notice" hint="Always shown in the Railway table">
                      <Input id="gec-notice" value={form.noticeNumber ?? ""} maxLength={60} placeholder="e.g. CEN 01/2026" onChange={text("noticeNumber")} />
                    </Field>
                    <Field label="Posts covered" htmlFor="gec-posts" hint="Railway notice column">
                      <Input id="gec-posts" value={form.postsDescription ?? ""} maxLength={300} onChange={text("postsDescription")} />
                    </Field>
                  </>
                )}
              </div>
            </Section>

            <Section
              id="news"
              title="Linked Exam News"
              description="The article the exam name links to on the public page."
              open={open.news}
              onToggle={() => toggle("news")}
              summary={news ? news.title : "Not linked - the name shows as plain text"}
              progress={news ? (news.status === "published" ? "Linked" : "Unpublished") : "Not linked"}
              hasError={sectionHasError("news")}
            >
              <div className={styles.grid}>
                <Field label="Exam News article" htmlFor="gec-news" error={issue("newsPostId")} wide>
                  <GecNewsPicker
                    id="gec-news"
                    value={news}
                    suggestForExamId={linked?.id ?? null}
                    onChange={(post) => {
                      setNews(post);
                      set("newsPostId", post?.id ?? null);
                    }}
                  />
                </Field>
                <Field
                  label="Suggest articles for this Testkart exam"
                  htmlFor="gec-testkart"
                  error={issue("testkartExamId")}
                  hint="Optional. Puts that exam's articles first in the picker; not linked on the page."
                  wide
                >
                  <GecExamPicker
                    id="gec-testkart"
                    value={linked}
                    onChange={(exam) => {
                      setLinked(exam);
                      setDirty(true);
                    }}
                  />
                </Field>
              </div>
            </Section>

            <Section
              id="display"
              title="Public display settings"
              description="Optional overrides. Leave blank to use the exam name and the automatic status and cells."
              open={open.display}
              onToggle={() => toggle("display")}
              summary={`${form.isHidden ? "Hidden" : "Visible"} - ${overrideCount ? `${overrideCount} override${overrideCount === 1 ? "" : "s"}` : "defaults"}`}
              progress={form.isHidden ? "Hidden" : overrideCount ? `${overrideCount} set` : "Defaults"}
              hasError={sectionHasError("display")}
            >
              <div className={styles.grid}>
                <label className={`${styles.switchRow} ${styles.wide}`}>
                  <Switch checked={form.isHidden} onCheckedChange={(checked) => set("isHidden", checked)} />
                  <span>Hide from the public page (archive)</span>
                </label>
                {tableKey && (
                  <Field label="Name in its category table" htmlFor="gec-table-name" hint="Defaults to the exam name, e.g. Combined Graduate Level (CGL) 2026">
                    <Input id="gec-table-name" value={form.tableName ?? ""} maxLength={200} onChange={text("tableName")} />
                  </Field>
                )}
                <Field label="Short name" htmlFor="gec-short" hint="Used in Recently concluded, e.g. SSC CGL 2026">
                  <Input id="gec-short" value={form.shortName ?? ""} maxLength={120} onChange={text("shortName")} />
                </Field>
                <Field label="Status shown" htmlFor="gec-status" error={issue("statusOverride")} hint={`Automatic: ${placement?.status.label ?? "-"}`}>
                  <Select
                    value={form.statusOverride ?? AUTO}
                    onValueChange={(value) => {
                      set("statusOverride", value === AUTO ? null : (value as GecExamInput["statusOverride"]));
                      if (value === AUTO) set("statusLabel", null);
                    }}
                  >
                    <SelectTrigger id="gec-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Automatic from dates</SelectItem>
                      {GEC_STATUSES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.statusOverride && (
                  <Field label="Status wording" htmlFor="gec-status-label" hint="Optional, e.g. Check ssc.gov.in">
                    <Input id="gec-status-label" value={form.statusLabel ?? ""} maxLength={60} onChange={text("statusLabel")} />
                  </Field>
                )}
                <Field label="Extra search words" htmlFor="gec-keywords" hint="Only words not already in the name or body, e.g. ias for Civil Services">
                  <Input id="gec-keywords" value={form.keywords ?? ""} maxLength={300} onChange={text("keywords")} />
                </Field>
                <Field label="Order in its table" htmlFor="gec-order" hint="Lower numbers come first">
                  <Input id="gec-order" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                </Field>
                {tableKey && (
                  <div className={`${styles.field} ${styles.wide}`}>
                    <span className={styles.label}>Table cell overrides</span>
                    <div className={styles.cells}>
                      {GEC_TABLE_COLUMNS[tableKey].map((column) => {
                        const derived = placement?.rows.find((item) => item.section === GEC_CATEGORY_SECTION[form.category]);
                        const index = derived?.columns.indexOf(column.label) ?? -1;
                        return (
                          <Input
                            key={column.key}
                            aria-label={`${column.label} cell`}
                            title={`${column.label} cell`}
                            value={form.cellOverrides[column.key] ?? ""}
                            maxLength={300}
                            placeholder={`${column.label}: ${index >= 0 ? derived?.row.cells[index] : "automatic"}`}
                            onChange={(e) => set("cellOverrides", { ...form.cellOverrides, [column.key]: e.target.value })}
                          />
                        );
                      })}
                    </div>
                    <span className={styles.hint}>Blank cells use the automatic text shown as the placeholder.</span>
                  </div>
                )}
              </div>
            </Section>

            <Section
              id="internal"
              title="Verification and internal notes"
              description="Admin-only notes on sources and open questions. Never shown on the page."
              open={open.internal}
              onToggle={() => toggle("internal")}
              summary={form.reviewNote ? `Review note: ${form.reviewNote}` : form.sourceNote ? `Source: ${form.sourceNote}` : "No notes"}
              progress={form.reviewNote ? "Review open" : undefined}
              hasError={sectionHasError("internal")}
            >
              <div className={styles.grid}>
                <Field label="Sources checked" htmlFor="gec-source-note" hint="Where each date was confirmed">
                  <Textarea id="gec-source-note" rows={3} value={form.sourceNote ?? ""} maxLength={1000} onChange={text("sourceNote")} />
                </Field>
                <Field label="Review note" htmlFor="gec-review-note" hint="Open questions. Clear it once resolved.">
                  <Textarea id="gec-review-note" rows={3} value={form.reviewNote ?? ""} maxLength={1000} onChange={text("reviewNote")} />
                </Field>
              </div>
            </Section>
          </div>

          <aside className={styles.rail}>
            <section className={styles.panel} aria-labelledby="gec-panel-preview">
              <div className={styles.panelHead}>
                <h2 id="gec-panel-preview" className={styles.panelTitle}>
                  Public preview
                </h2>
                {placement && <GovtExamsStatus status={placement.status} />}
              </div>
              {form.isHidden ? (
                <p className={styles.panelText}>Hidden. Not listed on the page.</p>
              ) : placement && placement.rows.length > 0 ? (
                <ul className={styles.placements}>
                  {placement.rows.map(({ section, row }) => (
                    <li key={`${section}-${row.key}`}>
                      <span>{gecBlock(section)?.label ?? section}</span>
                      <strong>{row.cells[DATE_CELL[section] ?? 0]}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.panelText}>Not listed today. Add dates or change the record type.</p>
              )}
              <p className={styles.panelHint}>{news?.status === "published" ? "Name links to its Exam News article." : "Name shows as plain text (no article linked)."}</p>
            </section>

            <section className={styles.panel} aria-labelledby="gec-panel-verify">
              <h2 id="gec-panel-verify" className={styles.panelTitle}>
                Verification
              </h2>
              <Select value={form.verification} onValueChange={(value) => set("verification", value as GecExamInput["verification"])}>
                <SelectTrigger aria-label="Verification status" className={styles.compact}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEC_VERIFICATIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label="Official source URL" className={styles.compact} value={form.officialUrl ?? ""} placeholder="Official source URL" onChange={text("officialUrl")} />
              {issue("officialUrl") && <span className={styles.error}>{issue("officialUrl")}</span>}
              <p className={styles.panelHint}>
                {saved?.verifiedAt && form.verification === "verified" ? `Last verified ${adminFormat.relativeTime(saved.verifiedAt)}` : "Not verified yet"}
              </p>
              {form.verification !== "verified" && (
                <Button variant="outline" size="sm" onClick={() => set("verification", "verified")}>
                  <ShieldCheck size={15} /> Mark verified
                </Button>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="gec-panel-publish">
              <h2 id="gec-panel-publish" className={styles.panelTitle}>
                Publishing
              </h2>
              <span className={`${styles.state} ${publishState.tone}`}>{publishState.label}</span>
              <p className={styles.panelHint}>{publishState.hint}</p>
              <p className={styles.panelHint}>{saved?.updatedAt ? `Last saved ${adminFormat.relativeTime(saved.updatedAt)}` : "Not saved yet"}</p>
              {!isNew && (
                <Button variant="ghost" size="sm" className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} /> Delete record
                </Button>
              )}
            </section>
          </aside>
        </div>

        <div className={styles.actionBar}>
          <span className={styles.actionNote}>{dirty ? "Unsaved changes" : "All changes saved to the draft"}</span>
          <Button asChild variant="ghost">
            <Link to={GEC_ADMIN_PATH}>Cancel</Link>
          </Button>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            <Save size={16} /> {save.isPending ? "Saving..." : "Save draft"}
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={onSavePreview}>
            <Eye size={16} /> Save and preview
          </Button>
          <Button disabled={save.isPending} onClick={onPublish}>
            <Send size={16} /> {publishState.live ? "Update" : "Publish"}
          </Button>
        </div>
      </form>

      <GecPublishDialog open={publishing} onOpenChange={setPublishing} />

      <ConsoleConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this record?"
        description={
          <>
            <strong>{form.name}</strong> and its {form.events.length} dates will be removed from the draft. This cannot be undone. To take it off the page but keep
            it, hide it in Public display settings instead.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={remove.isPending}
        onConfirm={() => {
          if (id)
            remove.mutate(id, {
              onSuccess: () => {
                setDirty(false);
                navigate(GEC_ADMIN_PATH);
              },
            });
        }}
      />
    </>
  );
};

/** Remounts per record, so moving between records or to Add exam never carries one form's state into another. */
const AdminGecExamEditorRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <AdminGecExamEditorPage key={id} />;
};

export default AdminGecExamEditorRoute;
