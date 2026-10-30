import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { GecEventsEditor } from "../components/GecEventsEditor";
import { GecExamPicker, type GecPickedExam } from "../components/GecExamPicker";
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
  type GecCategory,
} from "../helpers/gecModel";
import { emptyGecExam, gecExamToInput, gecInputToExam, validateGecExam, type GecExamInput, type GecIssue } from "../helpers/gecExamInput";
import { buildGecView, gecExamStatus } from "../helpers/gecView";
import { GecValidationError } from "../helpers/gecFetch";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { adminFormat } from "../helpers/adminFormat";
import { todayInIndia } from "../helpers/govtExamsCalendarFilter";
import { useAdminGecDraft, useAdminGecExam, useDeleteGecExam, useSaveGecExam } from "../helpers/useAdminGovtExamsCalendar";
import { toast } from "sonner";
import styles from "./admin.govt-exams-calendar.exam.$id.module.css";

const AUTO = "__auto";
type TableKey = keyof typeof GEC_TABLE_COLUMNS;

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

const Card: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {description && <p className={styles.cardText}>{description}</p>}
    </div>
    {children}
  </section>
);

const AdminGecExamEditorPage: React.FC = () => {
  const { id: idParam } = useParams<{ id: string }>();
  const isNew = idParam === "new";
  const id = !isNew && idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const navigate = useNavigate();

  const { data, isFetching, isError, error, refetch } = useAdminGecExam(id);
  const { data: draft } = useAdminGecDraft();
  const save = useSaveGecExam();
  const remove = useDeleteGecExam();

  const [form, setForm] = useState<GecExamInput | null>(isNew ? emptyGecExam() : null);
  const [linked, setLinked] = useState<GecPickedExam | null>(null);
  const [issues, setIssues] = useState<GecIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data?.exam && !dirty) {
      setForm(gecExamToInput(data.exam));
      setLinked(data.exam.testkartExam);
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
  const text = (key: keyof GecExamInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(key, event.target.value as never);
  const issue = (path: string) => issues.find((item) => item.path === path)?.message;

  /* Where the record lands on the page if saved and published as it stands. */
  const placement = useMemo(() => {
    if (!form || !draft) return null;
    const exam = gecInputToExam(form, linked);
    const others = draft.snapshot.exams.filter((item) => item.id !== exam.id);
    const view = buildGecView({ ...draft.snapshot, exams: [...others, exam] }, today, today);
    return {
      status: gecExamStatus(exam, today),
      rows: view.tableList.flatMap((table) =>
        table.rows.filter((row) => row.examId === exam.id).map((row) => ({ section: table.id, title: table.title, columns: table.columns, row }))
      ),
    };
  }, [form, linked, draft, today]);

  const submit = async (andPreview: boolean) => {
    if (!form) return;
    const local = validateGecExam(form);
    if (!form.name.trim()) local.push({ path: "name", message: "Name is required" });
    if (!form.conductingBody.trim()) local.push({ path: "conductingBody", message: "Conducting body is required" });
    if (local.length) {
      setIssues(local);
      toast.error(`${local.length} field${local.length === 1 ? " needs" : "s need"} attention`);
      return;
    }
    try {
      const result = await save.mutateAsync({ ...form, testkartExamId: linked?.id ?? null });
      setIssues([]);
      setDirty(false);
      setForm(gecExamToInput(result.exam));
      toast.success("Saved to the draft. Publish to update the public page.");
      if (andPreview) {
        const section = placement?.rows[0]?.section ?? GEC_CATEGORY_SECTION[result.exam.category] ?? "next-30-days";
        navigate(`${GEC_ADMIN_PATH}/preview?section=${section}`);
      } else if (isNew) {
        navigate(`${GEC_ADMIN_PATH}/exam/${result.exam.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof GecValidationError) {
        setIssues(err.issues);
        toast.error(err.message);
      } else {
        toast.error(parseErrorMessage(err));
      }
    }
  };

  if (!isNew && id === null) {
    return (
      <div className={styles.page}>
        <ConsoleListEmpty icon={<AlertCircle size={24} />} title="Record not found" description="The link is wrong." />
      </div>
    );
  }

  if (!form) {
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
            <Skeleton style={{ height: "24rem" }} />
          </div>
        )}
      </div>
    );
  }

  const tableKey = form.recordType === "exam" && form.category !== "central" ? (form.category as TableKey) : null;
  const record = data?.exam;

  return (
    <>
      <Helmet>
        <title>{`${isNew ? "Add exam" : form.name || "Edit record"} - Government Exams Calendar - Testkart Admin`}</title>
      </Helmet>

      <form
        className={styles.page}
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
      >
        <div className={styles.top}>
          <Button asChild variant="ghost" size="sm">
            <Link to={GEC_ADMIN_PATH}>
              <ArrowLeft size={16} /> Government Exams Calendar
            </Link>
          </Button>
          <h1 className={styles.title}>{isNew ? "Add exam or recruitment" : form.name || "Edit record"}</h1>
          {record?.updatedAt && <p className={styles.meta}>Last saved {adminFormat.relativeTime(record.updatedAt)}</p>}
        </div>

        {record?.reviewNote && (
          <div className={styles.review} role="note">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              <strong>Flagged for review:</strong> {record.reviewNote}
            </span>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.main}>
            <Card title="Exam details" description="One record per recruitment. Its dates below decide every public section it appears in.">
              <div className={styles.grid}>
                <Field label="Record type" htmlFor="gec-type" hint={GEC_RECORD_TYPES.find((t) => t.value === form.recordType)?.hint}>
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
                <Field label="Category" htmlFor="gec-category" hint={GEC_CATEGORY_SECTION[form.category] ? `Listed in ${gecBlock(GEC_CATEGORY_SECTION[form.category]!)?.label}` : "No category table; appears through its dates"}>
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
                <Field label="Conducting body / organisation" htmlFor="gec-body" error={issue("conductingBody")} hint="e.g. SSC, RRB, IBPS, SBI, UPPSC, WBPSC">
                  <Input id="gec-body" value={form.conductingBody} maxLength={80} onChange={text("conductingBody")} />
                </Field>
                <Field label="Full public name" htmlFor="gec-name" error={issue("name")} hint="Used in Next 30 days, e.g. SSC Combined Graduate Level (CGL) 2026" wide>
                  <Input id="gec-name" value={form.name} maxLength={200} onChange={text("name")} />
                </Field>
                <Field label="Name in its category table" htmlFor="gec-table-name" hint="Optional, e.g. Combined Graduate Level (CGL) 2026" wide>
                  <Input id="gec-table-name" value={form.tableName ?? ""} maxLength={200} onChange={text("tableName")} />
                </Field>
                <Field label="Short name" htmlFor="gec-short" hint="Optional, used in Recently concluded, e.g. SSC CGL 2026">
                  <Input id="gec-short" value={form.shortName ?? ""} maxLength={120} onChange={text("shortName")} />
                </Field>
                <Field label="Search keywords" htmlFor="gec-keywords" hint="Extra words readers type, e.g. cgl tier 1">
                  <Input id="gec-keywords" value={form.keywords ?? ""} maxLength={300} onChange={text("keywords")} />
                </Field>
                <Field label="Testkart exam page" htmlFor="gec-testkart" error={issue("testkartExamId")} hint="The exam name links here on the public page" wide>
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
            </Card>

            <Card title="Recruitment details" description="Notice number, vacancies and links. Railway rows always show the CEN number.">
              <div className={styles.grid}>
                <Field label="CEN / notification number" htmlFor="gec-notice" hint="e.g. CEN 01/2026">
                  <Input id="gec-notice" value={form.noticeNumber ?? ""} maxLength={60} onChange={text("noticeNumber")} />
                </Field>
                <Field label="Vacancies" htmlFor="gec-vacancies" error={issue("vacancies")}>
                  <Input
                    id="gec-vacancies"
                    type="number"
                    min={0}
                    value={form.vacancies ?? ""}
                    onChange={(e) => set("vacancies", e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))}
                  />
                </Field>
                <Field label="Post name (open applications)" htmlFor="gec-post" hint="e.g. Station Master">
                  <Input id="gec-post" value={form.postName ?? ""} maxLength={200} onChange={text("postName")} />
                </Field>
                <Field label="Posts covered" htmlFor="gec-posts" hint="Railway notice column, e.g. Non-technical popular categories" wide>
                  <Input id="gec-posts" value={form.postsDescription ?? ""} maxLength={300} onChange={text("postsDescription")} />
                </Field>
                <Field label="Official notification link" htmlFor="gec-notification-url" error={issue("notificationUrl")}>
                  <Input id="gec-notification-url" value={form.notificationUrl ?? ""} placeholder="https://" onChange={text("notificationUrl")} />
                </Field>
                <Field label="Application link" htmlFor="gec-apply-url" error={issue("applyUrl")}>
                  <Input id="gec-apply-url" value={form.applyUrl ?? ""} placeholder="https://" onChange={text("applyUrl")} />
                </Field>
                <Field label="Official website" htmlFor="gec-official-url" error={issue("officialUrl")}>
                  <Input id="gec-official-url" value={form.officialUrl ?? ""} placeholder="https://" onChange={text("officialUrl")} />
                </Field>
              </div>
            </Card>

            <Card title="Dates and events" description="Add every announced step. Leave dates that are not out as To be announced; tentative dates stay labelled tentative on the page.">
              <div className={styles.cardBody}>
                <GecEventsEditor
                  events={form.events}
                  issues={issues}
                  today={today}
                  onChange={(events) => {
                    set("events", events);
                  }}
                />
              </div>
            </Card>

            <Card title="Status and table cells" description="Both are worked out from the dates. Override only when the official wording needs it.">
              <div className={styles.grid}>
                <Field label="Record status" htmlFor="gec-status" error={issue("statusOverride")} hint={placement ? `Automatic: ${placement.status.label}` : undefined}>
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
                <Field label="Custom status text" htmlFor="gec-status-label" hint="e.g. Check ssc.gov.in. Needs a status above.">
                  <Input id="gec-status-label" value={form.statusLabel ?? ""} maxLength={60} disabled={!form.statusOverride} onChange={text("statusLabel")} />
                </Field>
                {tableKey &&
                  GEC_TABLE_COLUMNS[tableKey].map((column) => {
                    const derived = placement?.rows.find((item) => item.section === GEC_CATEGORY_SECTION[form.category]);
                    const index = derived?.columns.indexOf(column.label) ?? -1;
                    return (
                      <Field key={column.key} label={`${column.label} cell`} htmlFor={`gec-cell-${column.key}`} hint="Leave blank to use the automatic text">
                        <Input
                          id={`gec-cell-${column.key}`}
                          value={form.cellOverrides[column.key] ?? ""}
                          maxLength={300}
                          placeholder={index >= 0 ? derived?.row.cells[index] : ""}
                          onChange={(e) => set("cellOverrides", { ...form.cellOverrides, [column.key]: e.target.value })}
                        />
                      </Field>
                    );
                  })}
              </div>
            </Card>
          </div>

          <aside className={styles.rail}>
            <section className={styles.railCard}>
              <h2 className={styles.railTitle}>On the public page</h2>
              {placement && <GovtExamsStatus status={placement.status} />}
              {form.isHidden ? (
                <p className={styles.railText}>Hidden. It stays in the CMS but is left out when you publish.</p>
              ) : placement && placement.rows.length > 0 ? (
                <ul className={styles.placements}>
                  {placement.rows.map(({ section, row, columns }) => (
                    <li key={`${section}-${row.key}`} className={styles.placement}>
                      <span className={styles.placementSection}>{gecBlock(section)?.label ?? section}</span>
                      <dl className={styles.placementCells}>
                        {columns.slice(0, row.cells.length).map((column, index) => (
                          <div key={column}>
                            <dt>{column}</dt>
                            <dd>{row.cells[index]}</dd>
                          </div>
                        ))}
                        {row.status && (
                          <div>
                            <dt>Status</dt>
                            <dd>{row.status.label}</dd>
                          </div>
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.railText}>Not listed on any section today. Add dates or change the record type.</p>
              )}
              <p className={styles.railHint}>Worked out for {today} from the saved draft plus your unsaved edits.</p>
            </section>

            <section className={styles.railCard}>
              <h2 className={styles.railTitle}>Verification</h2>
              <Field label="Status" htmlFor="gec-verification">
                <Select value={form.verification} onValueChange={(value) => set("verification", value as GecExamInput["verification"])}>
                  <SelectTrigger id="gec-verification">
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
              </Field>
              {record?.verifiedAt && form.verification === "verified" && <p className={styles.railHint}>Verified {adminFormat.relativeTime(record.verifiedAt)}</p>}
              {form.verification !== "verified" && (
                <Button variant="outline" size="sm" onClick={() => set("verification", "verified")}>
                  <ShieldCheck size={15} /> I checked the official notice
                </Button>
              )}
              <Field label="Source checked" htmlFor="gec-source-note" hint="Where each date was confirmed">
                <Textarea id="gec-source-note" rows={3} value={form.sourceNote ?? ""} maxLength={1000} onChange={text("sourceNote")} />
              </Field>
              <Field label="Review note" htmlFor="gec-review-note" hint="Discrepancies to resolve. Clear it once resolved.">
                <Textarea id="gec-review-note" rows={3} value={form.reviewNote ?? ""} maxLength={1000} onChange={text("reviewNote")} />
              </Field>
            </section>

            <section className={styles.railCard}>
              <h2 className={styles.railTitle}>Visibility and order</h2>
              <label className={styles.switchRow}>
                <Switch checked={form.isHidden} onCheckedChange={(checked) => set("isHidden", checked)} />
                <span>Hide from the public page</span>
              </label>
              <Field label="Order in its table" htmlFor="gec-order" hint="Lower numbers come first">
                <Input id="gec-order" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </Field>
              {!isNew && (
                <Button variant="outline" size="sm" className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
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
          <Button variant="outline" disabled={save.isPending} onClick={() => submit(true)}>
            <Eye size={16} /> Save and preview
          </Button>
          <Button type="submit" disabled={save.isPending}>
            <Save size={16} /> {save.isPending ? "Saving..." : "Save draft"}
          </Button>
        </div>
      </form>

      <ConsoleConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this record?"
        description={
          <>
            <strong>{form.name}</strong> and its {form.events.length} dates will be removed from the draft. This cannot be undone.
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

export default AdminGecExamEditorPage;