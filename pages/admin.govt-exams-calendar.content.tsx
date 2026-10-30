import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, Info, Save } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { GecAdminHeader } from "../components/GecAdminHeader";
import { GecListEditor } from "../components/GecListEditor";
import { GecUpdateLogPanel } from "../components/GecUpdateLogPanel";
import { GecPagePicker } from "../components/GecPagePicker";
import { GovtExamsStatus } from "../components/GovtExamsTable";
import {
  GEC_ADMIN_PATH,
  GEC_BLOCKS,
  GEC_SECTION_IDS,
  GEC_TOKENS,
  gecBlock,
  gecNewId,
  gecPageSchema,
  type GecBlockKey,
  type GecPageContent,
  type GecSectionId,
  type GecSectionSettings,
} from "../helpers/gecModel";
import { buildGecView, type GecTable } from "../helpers/gecView";
import { GecValidationError } from "../helpers/gecFetch";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useAdminGecContent, useAdminGecDraft, useSaveGecContent } from "../helpers/useAdminGovtExamsCalendar";
import { toast } from "sonner";
import styles from "./admin.govt-exams-calendar.content.module.css";

type Issue = { path: string; message: string };

const RECORD_TABS: Partial<Record<GecBlockKey, string>> = {
  "next-30-days": "next30",
  "upsc-2027": "upsc",
  "ssc-2026-27": "ssc",
  "banking-ibps": "banking",
  "railway-rrb": "railway",
  "state-exams": "state",
  "open-applications": "open",
  "recently-concluded": "concluded",
};

const TABLE_FOR: Partial<Record<GecBlockKey, keyof ReturnType<typeof buildGecView>["tables"]>> = {
  "next-30-days": "next30",
  "upsc-2027": "upsc",
  "ssc-2026-27": "ssc",
  "banking-ibps": "banking",
  "railway-rrb": "railway",
  "state-exams": "state",
  "open-applications": "open",
  "recently-concluded": "concluded",
};

const BLOCK_HELP: Partial<Record<GecBlockKey, string>> = {
  header: "The breadcrumb above the H1. The BreadcrumbList schema is generated from these labels.",
  hero: "The H1, overview, search box and SEO tags. Last updated is set automatically each time you publish.",
  chips: "The sticky jump links under the hero. Each points at a section heading. Hidden chips are left out.",
  "next-30-days": "Rows come from exam dates (prelims, mains, CBT, tiers, interviews) that have not ended and start in the window, sorted by date. Finished sittings drop out on their own.",
  "upsc-2027": "One row per UPSC exam record. Notification, last date and exam date come from each record's dates.",
  "ssc-2026-27": "One row per SSC exam record, with the tier, application window, exam date and status from its dates.",
  "banking-ibps": "IBPS and SBI exam records, with prelims and mains dates and a status. The conducting body keeps IBPS and SBI apart.",
  "railway-rrb": "RRB records with their CEN number and vacancies, the current stage and status.",
  "state-exams": "State commission records. Add any commission as a record with the State category.",
  "open-applications": "Every record whose application window is open, nearest last date first. Expired dates drop out; an extended date shows as extended.",
  "recently-concluded": "Each record's latest finished sitting, kept for the retention window unless archived on the record.",
  "exam-bodies": "Cards for the main exam-conducting bodies.",
  "exam-cycle": "The steps of a recruitment, shown as a timeline.",
  cta: "The one mid-page call to action and the sidebar mock-test card. Point both at the Testkart test series most readers need.",
  faqs: "Questions shown in an accordion with every answer in the HTML. Unpublished questions are kept but not shown.",
  sources: "Official sources, the disclaimer and the update log.",
  related: "Four cards linking to existing Testkart pages. Use the picker so no duplicate pages are needed.",
  footer: "The standard Testkart site footer from the shared layout. It is not edited here.",
};

const Field: React.FC<{ label: string; htmlFor: string; hint?: React.ReactNode; error?: string; wide?: boolean; children: React.ReactNode }> = ({
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

const Counter: React.FC<{ value: string; ideal: number }> = ({ value, ideal }) => (
  <span className={value.length > ideal ? styles.over : undefined}>
    {value.length} characters, aim for {ideal} or fewer
  </span>
);

/** Rows the public page would show today for a date-driven block, from the saved records and these unsaved headings. */
const DerivedRows: React.FC<{ table: GecTable | undefined; block: GecBlockKey }> = ({ table, block }) => {
  if (!table) return <Skeleton style={{ height: "10rem" }} />;
  return (
    <div className={styles.derived}>
      <div className={styles.derivedHead}>
        <span>
          <strong>{table.rows.length}</strong> row{table.rows.length === 1 ? "" : "s"} on the page today
        </span>
        <Button asChild variant="outline" size="sm">
          <Link to={`${GEC_ADMIN_PATH}?tab=${RECORD_TABS[block]}`}>
            Manage these records <ArrowRight size={15} />
          </Link>
        </Button>
      </div>
      {table.rows.length === 0 ? (
        <p className={styles.muted}>Nothing qualifies today. The public page shows a short note in place of the table.</p>
      ) : (
        <div className={styles.derivedScroll}>
          <table className={styles.derivedTable}>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                  {table.statusColumn && <td>{row.status && <GovtExamsStatus status={row.status} />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AdminGecContentPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const block = (gecBlock(params.get("block"))?.key ?? "hero") as GecBlockKey;
  const { data, isFetching, isError, error, refetch } = useAdminGecContent();
  const { data: draft } = useAdminGecDraft();
  const save = useSaveGecContent();

  const [page, setPage] = useState<GecPageContent | null>(null);
  const [dirty, setDirty] = useState<Set<GecBlockKey>>(new Set());
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);

  useEffect(() => {
    if (data && dirty.size === 0) setPage(data.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (dirty.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const localIssues = useMemo<Issue[]>(() => {
    if (!page) return [];
    const parsed = gecPageSchema.safeParse(page);
    return parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  }, [page]);
  const issues = [...localIssues, ...serverIssues];
  const err = (path: string) => issues.find((issue) => issue.path === path)?.message;
  const blockHasIssues = (key: GecBlockKey) =>
    issues.some((issue) => gecBlock(key)?.keys.some((owned) => issue.path === owned || issue.path.startsWith(`${owned}.`)));

  const view = useMemo(() => (page && draft ? buildGecView({ ...draft.snapshot, page }, draft.today, draft.today) : null), [page, draft]);

  const edit = (key: GecBlockKey, next: GecPageContent) => {
    setPage(next);
    setDirty((prev) => new Set(prev).add(key));
    setServerIssues([]);
  };
  const patch = <K extends keyof GecPageContent>(key: K, value: GecPageContent[K]) => page && edit(block, { ...page, [key]: value });
  const patchSection = (id: GecSectionId, value: Partial<GecSectionSettings>) =>
    page && edit(block, { ...page, sections: { ...page.sections, [id]: { ...page.sections[id], ...value } } });

  const saveAll = async () => {
    if (!page || dirty.size === 0) return;
    const pending = [...dirty];
    if (pending.some(blockHasIssues)) {
      throw new Error("Fix the highlighted fields before saving.");
    }
    for (const key of pending) {
      try {
        await save.mutateAsync({ block: key, page });
      } catch (saveError) {
        if (saveError instanceof GecValidationError) setServerIssues(saveError.issues);
        throw saveError;
      }
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const onSave = async () => {
    try {
      await saveAll();
      toast.success("Saved to the draft. Publish to update the public page.");
    } catch (saveError) {
      toast.error(parseErrorMessage(saveError));
    }
  };

  const onPreview = async () => {
    try {
      await saveAll();
      navigate(`${GEC_ADMIN_PATH}/preview?section=${block}`);
    } catch (saveError) {
      toast.error(parseErrorMessage(saveError));
    }
  };

  const settingsForm = (id: GecSectionId, extras: { tokens?: boolean } = {}) => {
    if (!page) return null;
    const settings = page.sections[id];
    const at = `sections.${id}`;
    return (
      <div className={styles.grid}>
        <Field label="Section heading (H2)" htmlFor={`${id}-title`} error={err(`${at}.title`)} wide>
          <Input id={`${id}-title`} value={settings.title} maxLength={200} onChange={(e) => patchSection(id, { title: e.target.value })} />
        </Field>
        <Field label="Sidebar label (On this page)" htmlFor={`${id}-nav`} error={err(`${at}.navLabel`)}>
          <Input id={`${id}-nav`} value={settings.navLabel} maxLength={60} onChange={(e) => patchSection(id, { navLabel: e.target.value })} />
        </Field>
        {settings.windowDays !== undefined && (
          <Field label="Window (days)" htmlFor={`${id}-window`} error={err(`${at}.windowDays`)}>
            <Input id={`${id}-window`} type="number" min={7} max={90} value={settings.windowDays} onChange={(e) => patchSection(id, { windowDays: Number(e.target.value) || 30 })} />
          </Field>
        )}
        {settings.maxRows !== undefined && (
          <Field label="Most rows shown" htmlFor={`${id}-rows`} hint="The brief asks for 8 to 12" error={err(`${at}.maxRows`)}>
            <Input id={`${id}-rows`} type="number" min={1} max={40} value={settings.maxRows} onChange={(e) => patchSection(id, { maxRows: Number(e.target.value) || 12 })} />
          </Field>
        )}
        {settings.urgentDays !== undefined && (
          <Field label="Red when this many days or fewer remain" htmlFor={`${id}-urgent`} error={err(`${at}.urgentDays`)}>
            <Input id={`${id}-urgent`} type="number" min={1} max={14} value={settings.urgentDays} onChange={(e) => patchSection(id, { urgentDays: Number(e.target.value) || 3 })} />
          </Field>
        )}
        {settings.retentionDays !== undefined && (
          <Field label="Keep concluded rows for (days)" htmlFor={`${id}-retention`} error={err(`${at}.retentionDays`)}>
            <Input id={`${id}-retention`} type="number" min={7} max={365} value={settings.retentionDays} onChange={(e) => patchSection(id, { retentionDays: Number(e.target.value) || 60 })} />
          </Field>
        )}
        <Field label="Intro paragraph" htmlFor={`${id}-intro`} error={err(`${at}.intro`)} wide>
          <Textarea id={`${id}-intro`} rows={3} value={settings.intro} maxLength={1500} onChange={(e) => patchSection(id, { intro: e.target.value })} />
        </Field>
        {id !== "exam-bodies" && id !== "exam-cycle" && id !== "faqs" && id !== "related" && (
          <Field label={id === "open-applications" ? "Legend under the table" : "Note under the table"} htmlFor={`${id}-note`} error={err(`${at}.note`)} wide>
            <Textarea id={`${id}-note`} rows={2} value={settings.note} maxLength={600} onChange={(e) => patchSection(id, { note: e.target.value })} />
          </Field>
        )}
        {extras.tokens !== false && (
          <p className={`${styles.tokens} ${styles.wide}`}>
            <Info size={14} aria-hidden="true" /> Placeholders filled on the page:{" "}
            {GEC_TOKENS.map((token) => (
              <code key={token.token} title={token.meaning}>
                {token.token}
              </code>
            ))}
          </p>
        )}
        {view && (
          <p className={`${styles.renders} ${styles.wide}`}>
            Shows as: <strong>{view.headings[id].title}</strong>
            {view.headings[id].note && <> - note: {view.headings[id].note}</>}
          </p>
        )}
      </div>
    );
  };

  const renderEditor = () => {
    if (!page) return null;
    switch (block) {
      case "header":
        return (
          <div className={styles.grid}>
            <Field label="Home label" htmlFor="crumb-home" error={err("breadcrumb.homeLabel")}>
              <Input id="crumb-home" value={page.breadcrumb.homeLabel} onChange={(e) => patch("breadcrumb", { ...page.breadcrumb, homeLabel: e.target.value })} />
            </Field>
            <Field label="This page's label" htmlFor="crumb-current" error={err("breadcrumb.currentLabel")}>
              <Input id="crumb-current" value={page.breadcrumb.currentLabel} onChange={(e) => patch("breadcrumb", { ...page.breadcrumb, currentLabel: e.target.value })} />
            </Field>
            <p className={`${styles.muted} ${styles.wide}`}>The URL stays /govt-exams-calendar. The site header comes from the shared layout.</p>
          </div>
        );
      case "hero":
        return (
          <div className={styles.grid}>
            <Field label="H1" htmlFor="hero-h1" error={err("hero.h1")} hint="Change the year here each January; the URL stays the same." wide>
              <Input id="hero-h1" value={page.hero.h1} maxLength={160} onChange={(e) => patch("hero", { ...page.hero, h1: e.target.value })} />
            </Field>
            {page.hero.overview.map((paragraph, index) => (
              <Field key={index} label={`Overview paragraph ${index + 1}`} htmlFor={`hero-p-${index}`} wide>
                <Textarea
                  id={`hero-p-${index}`}
                  rows={3}
                  value={paragraph}
                  maxLength={1200}
                  onChange={(e) => patch("hero", { ...page.hero, overview: page.hero.overview.map((p, i) => (i === index ? e.target.value : p)) })}
                />
              </Field>
            ))}
            <div className={`${styles.inline} ${styles.wide}`}>
              {page.hero.overview.length < 4 && (
                <Button variant="outline" size="sm" onClick={() => patch("hero", { ...page.hero, overview: [...page.hero.overview, ""] })}>
                  Add paragraph
                </Button>
              )}
              {page.hero.overview.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => patch("hero", { ...page.hero, overview: page.hero.overview.slice(0, -1) })}>
                  Remove last paragraph
                </Button>
              )}
            </div>
            <Field label="Tags beside Last updated" htmlFor="hero-tags" hint="Comma separated, e.g. UPSC, SSC, IBPS, RRB, State" error={err("hero.tags")}>
              <Input
                id="hero-tags"
                value={page.hero.tags.join(", ")}
                onChange={(e) =>
                  patch("hero", {
                    ...page.hero,
                    tags: e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .slice(0, 8),
                  })
                }
              />
            </Field>
            <Field label="Search box placeholder" htmlFor="hero-search" error={err("hero.searchPlaceholder")}>
              <Input id="hero-search" value={page.hero.searchPlaceholder} maxLength={120} onChange={(e) => patch("hero", { ...page.hero, searchPlaceholder: e.target.value })} />
            </Field>
            <Field label="SEO title" htmlFor="hero-seo-title" error={err("hero.seoTitle")} hint={<Counter value={page.hero.seoTitle} ideal={60} />} wide>
              <Input id="hero-seo-title" value={page.hero.seoTitle} maxLength={70} onChange={(e) => patch("hero", { ...page.hero, seoTitle: e.target.value })} />
            </Field>
            <Field
              label="Meta description"
              htmlFor="hero-meta"
              error={err("hero.metaDescription")}
              hint={
                <>
                  <Counter value={view?.seo.description ?? page.hero.metaDescription} ideal={160} />. {"{updated}"} becomes the publish date.
                </>
              }
              wide
            >
              <Textarea id="hero-meta" rows={3} value={page.hero.metaDescription} maxLength={320} onChange={(e) => patch("hero", { ...page.hero, metaDescription: e.target.value })} />
            </Field>
            <Field label="First published" htmlFor="hero-published" hint="Sent as WebPage datePublished" error={err("hero.datePublished")}>
              <Input id="hero-published" type="date" value={page.hero.datePublished} onChange={(e) => patch("hero", { ...page.hero, datePublished: e.target.value })} />
            </Field>
            <Field label="Last updated" htmlFor="hero-updated" hint="Set automatically to the day you publish">
              <Input id="hero-updated" value="Automatic on publish" disabled />
            </Field>
          </div>
        );
      case "chips":
        return (
          <GecListEditor
            items={page.chips}
            onChange={(chips) => patch("chips", chips)}
            itemTitle={(chip) => chip.label || "New chip"}
            newItem={() => ({ section: "faqs" as GecSectionId, label: "FAQs", visible: true })}
            addLabel="Add chip"
            max={13}
            headerExtra={(chip, update) => (
              <label className={styles.switchLabel}>
                <Switch checked={chip.visible} onCheckedChange={(visible) => update({ visible })} aria-label={`Show ${chip.label}`} />
                {chip.visible ? "Shown" : "Hidden"}
              </label>
            )}
            renderItem={(chip, update, index) => (
              <>
                <Field label="Label" htmlFor={`chip-${index}-label`} error={err(`chips.${index}.label`)}>
                  <Input id={`chip-${index}-label`} value={chip.label} maxLength={40} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Jumps to" htmlFor={`chip-${index}-section`}>
                  <Select value={chip.section} onValueChange={(value) => update({ section: value as GecSectionId })}>
                    <SelectTrigger id={`chip-${index}-section`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GEC_SECTION_IDS.filter((id) => id !== "related").map((id) => (
                        <SelectItem key={id} value={id}>
                          {gecBlock(id)?.label ?? id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
          />
        );
      case "exam-bodies":
        return (
          <>
            {settingsForm("exam-bodies", { tokens: false })}
            <GecListEditor
              items={page.bodies}
              onChange={(bodies) => patch("bodies", bodies)}
              itemTitle={(body) => body.name || "New body"}
              newItem={() => ({ id: gecNewId("body"), name: "", exams: "", stages: "", website: "", url: "" })}
              addLabel="Add exam body"
              max={20}
              renderItem={(body, update, index) => (
                <>
                  <Field label="Body name" htmlFor={`body-${index}-name`} error={err(`bodies.${index}.name`)}>
                    <Input id={`body-${index}-name`} value={body.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Website text" htmlFor={`body-${index}-site`} hint="e.g. upsc.gov.in">
                    <Input id={`body-${index}-site`} value={body.website} maxLength={120} onChange={(e) => update({ website: e.target.value })} />
                  </Field>
                  <Field label="Official website URL" htmlFor={`body-${index}-url`} error={err(`bodies.${index}.url`)}>
                    <Input id={`body-${index}-url`} value={body.url} placeholder="https://" onChange={(e) => update({ url: e.target.value })} />
                  </Field>
                  <Field label="Major exams" htmlFor={`body-${index}-exams`} wide>
                    <Textarea id={`body-${index}-exams`} rows={2} value={body.exams} maxLength={400} onChange={(e) => update({ exams: e.target.value })} />
                  </Field>
                  <Field label="Typical stages" htmlFor={`body-${index}-stages`} wide>
                    <Textarea id={`body-${index}-stages`} rows={2} value={body.stages} maxLength={400} onChange={(e) => update({ stages: e.target.value })} />
                  </Field>
                </>
              )}
            />
          </>
        );
      case "exam-cycle":
        return (
          <>
            {settingsForm("exam-cycle", { tokens: false })}
            <GecListEditor
              items={page.cycle}
              onChange={(cycle) => patch("cycle", cycle)}
              itemTitle={(step) => step.title || "New step"}
              newItem={() => ({ id: gecNewId("step"), title: "", text: "" })}
              addLabel="Add step"
              min={1}
              max={8}
              renderItem={(step, update, index) => (
                <>
                  <Field label="Step title" htmlFor={`step-${index}-title`} error={err(`cycle.${index}.title`)} wide>
                    <Input id={`step-${index}-title`} value={step.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label="Description" htmlFor={`step-${index}-text`} wide>
                    <Textarea id={`step-${index}-text`} rows={3} value={step.text} maxLength={600} onChange={(e) => update({ text: e.target.value })} />
                  </Field>
                </>
              )}
            />
          </>
        );
      case "cta":
        return (
          <>
            <h3 className={styles.subhead}>CTA band</h3>
            <div className={styles.grid}>
              <Field label="Heading" htmlFor="cta-title" error={err("cta.title")}>
                <Input id="cta-title" value={page.cta.title} maxLength={120} onChange={(e) => patch("cta", { ...page.cta, title: e.target.value })} />
              </Field>
              <Field label="Small label above" htmlFor="cta-eyebrow">
                <Input id="cta-eyebrow" value={page.cta.eyebrow} maxLength={40} onChange={(e) => patch("cta", { ...page.cta, eyebrow: e.target.value })} />
              </Field>
              <Field label="Description" htmlFor="cta-text" wide>
                <Textarea id="cta-text" rows={2} value={page.cta.text} maxLength={400} onChange={(e) => patch("cta", { ...page.cta, text: e.target.value })} />
              </Field>
              <Field label="Button text" htmlFor="cta-button" error={err("cta.buttonLabel")}>
                <Input id="cta-button" value={page.cta.buttonLabel} maxLength={60} onChange={(e) => patch("cta", { ...page.cta, buttonLabel: e.target.value })} />
              </Field>
              <Field label="Destination URL" htmlFor="cta-url" error={err("cta.url")} hint="A Testkart path such as /mock-test">
                <Input id="cta-url" value={page.cta.url} onChange={(e) => patch("cta", { ...page.cta, url: e.target.value })} />
              </Field>
              <div className={styles.field}>
                <span className={styles.label}>&nbsp;</span>
                <GecPagePicker onPick={(href) => patch("cta", { ...page.cta, url: href })} />
              </div>
            </div>
            <h3 className={styles.subhead}>Sidebar card</h3>
            <div className={styles.grid}>
              <Field label="Card title" htmlFor="side-title" error={err("sidebar.title")}>
                <Input id="side-title" value={page.sidebar.title} maxLength={60} onChange={(e) => patch("sidebar", { ...page.sidebar, title: e.target.value })} />
              </Field>
              <Field label="Button text" htmlFor="side-button" error={err("sidebar.buttonLabel")}>
                <Input id="side-button" value={page.sidebar.buttonLabel} maxLength={60} onChange={(e) => patch("sidebar", { ...page.sidebar, buttonLabel: e.target.value })} />
              </Field>
              <Field label="Text" htmlFor="side-text" wide>
                <Input id="side-text" value={page.sidebar.text} maxLength={240} onChange={(e) => patch("sidebar", { ...page.sidebar, text: e.target.value })} />
              </Field>
              <Field label="Destination URL" htmlFor="side-url" error={err("sidebar.url")}>
                <Input id="side-url" value={page.sidebar.url} onChange={(e) => patch("sidebar", { ...page.sidebar, url: e.target.value })} />
              </Field>
              <div className={styles.field}>
                <span className={styles.label}>&nbsp;</span>
                <GecPagePicker onPick={(href) => patch("sidebar", { ...page.sidebar, url: href })} />
              </div>
            </div>
          </>
        );
      case "faqs":
        return (
          <>
            {settingsForm("faqs", { tokens: false })}
            <GecListEditor
              items={page.faqs}
              onChange={(faqs) => patch("faqs", faqs)}
              itemTitle={(faq) => faq.question || "New question"}
              newItem={() => ({ id: gecNewId("faq"), question: "", answer: "", published: false })}
              addLabel="Add FAQ"
              max={40}
              headerExtra={(faq, update) => (
                <label className={styles.switchLabel}>
                  <Switch checked={faq.published} onCheckedChange={(published) => update({ published })} aria-label="Published" />
                  {faq.published ? "Published" : "Unpublished"}
                </label>
              )}
              renderItem={(faq, update, index) => (
                <>
                  <Field label="Question" htmlFor={`faq-${index}-q`} error={err(`faqs.${index}.question`)} wide>
                    <Input id={`faq-${index}-q`} value={faq.question} maxLength={300} onChange={(e) => update({ question: e.target.value })} />
                  </Field>
                  <Field label="Answer" htmlFor={`faq-${index}-a`} error={err(`faqs.${index}.answer`)} wide>
                    <Textarea id={`faq-${index}-a`} rows={4} value={faq.answer} maxLength={3000} onChange={(e) => update({ answer: e.target.value })} />
                  </Field>
                </>
              )}
            />
          </>
        );
      case "sources":
        return (
          <>
            {settingsForm("sources", { tokens: false })}
            <h3 className={styles.subhead}>Official sources</h3>
            <GecListEditor
              items={page.sources.items}
              onChange={(items) => patch("sources", { ...page.sources, items })}
              itemTitle={(source) => source.name || "New source"}
              newItem={() => ({ id: gecNewId("src"), name: "", url: "", description: "" })}
              addLabel="Add source"
              max={30}
              renderItem={(source, update, index) => (
                <>
                  <Field label="Source name" htmlFor={`src-${index}-name`} error={err(`sources.items.${index}.name`)}>
                    <Input id={`src-${index}-name`} value={source.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Official website URL" htmlFor={`src-${index}-url`} error={err(`sources.items.${index}.url`)}>
                    <Input id={`src-${index}-url`} value={source.url} placeholder="https://" onChange={(e) => update({ url: e.target.value })} />
                  </Field>
                  <Field label="Description (optional)" htmlFor={`src-${index}-desc`} wide>
                    <Input id={`src-${index}-desc`} value={source.description} maxLength={300} onChange={(e) => update({ description: e.target.value })} />
                  </Field>
                </>
              )}
            />
            <div className={styles.grid}>
              <Field label="Closing text after the list" htmlFor="src-tail" wide>
                <Textarea id="src-tail" rows={2} value={page.sources.tail} maxLength={400} onChange={(e) => patch("sources", { ...page.sources, tail: e.target.value })} />
              </Field>
              <Field label="Disclaimer" htmlFor="src-disclaimer" error={err("sources.disclaimer")} wide>
                <Textarea id="src-disclaimer" rows={3} value={page.sources.disclaimer} maxLength={1000} onChange={(e) => patch("sources", { ...page.sources, disclaimer: e.target.value })} />
              </Field>
            </div>
            <h3 className={styles.subhead}>Update log</h3>
            <p className={styles.muted}>Saved immediately. Public lines reach the page on the next publish.</p>
            <GecUpdateLogPanel />
          </>
        );
      case "related":
        return (
          <>
            {settingsForm("related", { tokens: false })}
            <GecListEditor
              items={page.related}
              onChange={(related) => patch("related", related)}
              itemTitle={(card) => card.title || "New card"}
              newItem={() => ({ id: gecNewId("rel"), title: "", text: "", href: "" })}
              addLabel="Add card"
              max={8}
              renderItem={(card, update, index) => (
                <>
                  <Field label="Title" htmlFor={`rel-${index}-title`} error={err(`related.${index}.title`)}>
                    <Input id={`rel-${index}-title`} value={card.title} maxLength={60} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label="Text" htmlFor={`rel-${index}-text`}>
                    <Input id={`rel-${index}-text`} value={card.text} maxLength={200} onChange={(e) => update({ text: e.target.value })} />
                  </Field>
                  <Field label="Links to" htmlFor={`rel-${index}-href`} error={err(`related.${index}.href`)} hint={card.href ? undefined : "No link yet: the card shows without one"}>
                    <Input id={`rel-${index}-href`} value={card.href} placeholder="/exams/ssc-cgl/syllabus" onChange={(e) => update({ href: e.target.value })} />
                  </Field>
                  <div className={styles.field}>
                    <span className={styles.label}>&nbsp;</span>
                    <GecPagePicker onPick={(href) => update({ href })} />
                  </div>
                </>
              )}
            />
          </>
        );
      case "footer":
        return <p className={styles.muted}>Nothing to edit here. The page keeps the standard Testkart footer.</p>;
      default: {
        const id = block as GecSectionId;
        const tableKey = TABLE_FOR[block];
        return (
          <>
            {settingsForm(id)}
            <h3 className={styles.subhead}>Rows on the page</h3>
            <DerivedRows table={tableKey && view ? view.tables[tableKey] : undefined} block={block} />
          </>
        );
      }
    }
  };

  const current = gecBlock(block)!;

  return (
    <>
      <Helmet>
        <title>Page content - Government Exams Calendar - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <GecAdminHeader beforePublish={saveAll} />

        {!page ? (
          isError && !isFetching ? (
            <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load the page content" description={parseErrorMessage(error)}>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </ConsoleListEmpty>
          ) : (
            <Skeleton style={{ height: "30rem" }} />
          )
        ) : (
          <div className={styles.layout}>
            <nav className={styles.blocks} aria-label="Page blocks">
              <ol>
                {GEC_BLOCKS.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`${styles.blockLink} ${block === item.key ? styles.blockActive : ""}`}
                      aria-current={block === item.key ? "page" : undefined}
                      onClick={() => setParams({ block: item.key }, { replace: true })}
                    >
                      <span className={styles.blockNumber}>{item.n}</span>
                      <span className={styles.blockLabel}>{item.label}</span>
                      {blockHasIssues(item.key) ? (
                        <span className={`${styles.dot} ${styles.dotError}`} title="Has errors" />
                      ) : dirty.has(item.key) ? (
                        <span className={styles.dot} title="Unsaved changes" />
                      ) : "derived" in item ? (
                        <span className={styles.auto} title="Rows come from exam records">
                          auto
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <section className={styles.editor} aria-labelledby="gec-block-title">
              <div className={styles.editorHead}>
                <span className={styles.editorNumber}>Block {current.n}</span>
                <h2 id="gec-block-title" className={styles.editorTitle}>
                  {current.label}
                </h2>
                {BLOCK_HELP[block] && <p className={styles.editorHelp}>{BLOCK_HELP[block]}</p>}
              </div>
              <div className={styles.editorBody}>{renderEditor()}</div>
            </section>
          </div>
        )}

        <div className={styles.actionBar}>
          <span className={styles.actionNote}>
            {dirty.size > 0 ? `Unsaved changes in ${[...dirty].map((key) => gecBlock(key)?.label).join(", ")}` : "All changes saved to the draft"}
          </span>
          <Button variant="outline" onClick={onPreview} disabled={save.isPending}>
            <Eye size={16} /> Preview
          </Button>
          <Button onClick={onSave} disabled={dirty.size === 0 || save.isPending}>
            <Save size={16} /> {save.isPending ? "Saving..." : "Save draft"}
          </Button>
        </div>
      </div>
    </>
  );
};

export default AdminGecContentPage;
