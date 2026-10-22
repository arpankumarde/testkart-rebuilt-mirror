import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  schema as saveSchema,
  ExamNewsValidationError,
  type InputType,
  type ValidationIssue,
} from "../endpoints/admin/exam-news/save_POST.schema";
import type { ExamNewsDetail } from "../endpoints/admin/exam-news/get_GET.schema";
import { getAdminExamNewsSlugCheck } from "../endpoints/admin/exam-news/slug-check_GET.schema";
import {
  useAdminExamNewsPost,
  useDeleteExamNewsMutation,
  useExamNewsStatusMutation,
  useSaveExamNewsMutation,
} from "../helpers/useAdminExamNews";
import { useAdminOptionsQuery } from "../helpers/useAdminOptions";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { examNewsMeta } from "../helpers/examNewsMeta";
import { EXAM_NEWS_TYPE_ICONS } from "../helpers/examNewsIcons";
import { validateExamNews } from "../helpers/examNewsValidation";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { slugify } from "../helpers/slugify";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { RadioGroup, RadioGroupItem } from "../components/RadioGroup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { ImageUploader } from "../components/ImageUploader";
import { RichTextEditor } from "../components/RichTextEditor";
import { CurrentAffairsStatusBadge } from "../components/CurrentAffairsStatusBadge";
import { CurrentAffairsSourcesEditor } from "../components/CurrentAffairsSourcesEditor";
import { ExamNewsExamPicker, type ExamNewsExamChoice } from "../components/ExamNewsExamPicker";
import { ExamNewsKeyDatesEditor } from "../components/ExamNewsKeyDatesEditor";
import { ExamNewsCorrectionsEditor } from "../components/ExamNewsCorrectionsEditor";
import { ExamNewsPreview } from "../components/ExamNewsPreview";
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from "../components/Form";
import styles from "./admin.news.e.$id.module.css";

type PublishMode = "now" | "schedule";
type ErrorTree = { [key: string]: string | ErrorTree };
type SavedMeta = Pick<
  ExamNewsDetail,
  "status" | "publishedAt" | "firstPublishedAt" | "updatedAt" | "createdAt" | "createdByName" | "updatedByName" | "previousSlugs"
>;
type SectionId = "en-basics" | "en-story" | "en-dates" | "en-sources" | "en-corrections" | "en-seo";

const SEO_TITLE_TARGET = 60;
const SEO_DESCRIPTION_TARGET = 160;
/* Matches the .sectionBody transition. */
const SECTION_ANIMATION_MS = 250;

const SOURCE_SUGGESTIONS = ["NTA", "UPSC", "SSC", "IBPS", "CBSE", "UGC", "NMC", "Press Information Bureau", "Official website"];

/** Which editor section each form path lives in, so errors and checklist rows can jump there. */
const SECTION_OF: Record<string, SectionId> = {
  title: "en-basics",
  slug: "en-basics",
  summary: "en-basics",
  newsType: "en-basics",
  examId: "en-basics",
  authorId: "en-basics",
  body: "en-story",
  heroImageUrl: "en-story",
  heroImageAlt: "en-story",
  heroImageCredit: "en-story",
  keyDates: "en-dates",
  officialSourceName: "en-sources",
  officialSourceUrl: "en-sources",
  sources: "en-sources",
  corrections: "en-corrections",
  seoTitle: "en-seo",
  seoDescription: "en-seo",
  ogTitle: "en-seo",
  ogDescription: "en-seo",
  ogImageUrl: "en-seo",
  canonicalUrl: "en-seo",
};

const rootOf = (path: string) => path.split(".")[0];
const sectionOf = (path: string): SectionId | undefined => SECTION_OF[rootOf(path)];

const tomorrowNineIst = () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${examNewsMeta.toIstInput(tomorrow).slice(0, 10)}T09:00`;
};

const emptyValues = (authorId: number | null): InputType => ({
  title: "",
  slug: "",
  summary: "",
  newsType: "notification",
  examId: null,
  authorId,
  status: "draft",
  publishAt: "",
  body: "",
  heroImageUrl: "",
  heroImageFileId: "",
  heroImageAlt: "",
  heroImageCredit: "",
  keyDates: [],
  officialSourceName: "",
  officialSourceUrl: "",
  sources: [],
  corrections: [],
  seoTitle: "",
  seoDescription: "",
  ogTitle: "",
  ogDescription: "",
  ogImageUrl: "",
  ogImageFileId: "",
  canonicalUrl: "",
});

const toFormValues = (post: ExamNewsDetail): InputType => {
  const values = saveSchema.parse({ ...post, status: post.status === "archived" ? "draft" : post.status });
  return { ...values, id: post.id };
};

const toMeta = (post: ExamNewsDetail): SavedMeta => ({
  status: post.status,
  publishedAt: post.publishedAt,
  firstPublishedAt: post.firstPublishedAt,
  updatedAt: post.updatedAt,
  createdAt: post.createdAt,
  createdByName: post.createdByName,
  updatedByName: post.updatedByName,
  previousSlugs: post.previousSlugs,
});

const SUCCESS_COPY: Record<InputType["status"], string> = {
  draft: "Draft saved",
  scheduled: "Scheduled",
  published: "Published",
};

type SectionStatus = { ok: boolean; label: string };

interface EditorSectionProps {
  id: SectionId;
  step: number;
  title: string;
  tag?: string;
  hint?: string;
  status: SectionStatus | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/* A numbered form section. Its fields stay mounted while collapsed, so nothing typed or uploading is lost. */
const EditorSection: React.FC<EditorSectionProps> = ({ id, step, title, tag, hint, status, open, onToggle, children }) => {
  // Clipped only while it moves: a lasting overflow would stop the article toolbar sticking.
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), SECTION_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <section id={id} className={styles.card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionHeading}>
        <button type="button" className={styles.collapseToggle} aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span className={styles.cardTitle}>
            <span className={styles.step}>{step}</span> {title}
            {tag && <span className={styles.optional}>{tag}</span>}
          </span>
          {hint && <span className={styles.cardHint}>{hint}</span>}
          {status && (
            <span className={`${styles.sectionStatus} ${status.ok ? styles.sectionStatusOk : styles.sectionStatusTodo}`}>
              {status.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
              {status.label}
            </span>
          )}
          <ChevronDown size={18} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true" />
        </button>
      </h2>
      <div id={`${id}-body`} className={`${styles.sectionBody} ${open ? styles.sectionBodyOpen : ""}`}>
        <div className={`${styles.sectionClip} ${settled ? styles.sectionClipSettled : ""}`}>
          <div className={styles.collapseBody}>{children}</div>
        </div>
      </div>
    </section>
  );
};

const AdminExamNewsEditorPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNewRoute = idSegment === "new";
  const routeId = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;

  const { authState } = useAdminAuth();
  const currentAdminId = authState.type === "authenticated" ? authState.admin.id : null;

  const detailQuery = useAdminExamNewsPost(routeId);
  const adminsQuery = useAdminOptionsQuery();
  const saveMutation = useSaveExamNewsMutation();
  const statusMutation = useExamNewsStatusMutation();
  const deleteMutation = useDeleteExamNewsMutation();

  const [initialValues] = useState(() => emptyValues(currentAdminId));
  const form = useForm({ schema: saveSchema, defaultValues: initialValues });
  const values = form.values as InputType;
  const setValues = form.setValues as React.Dispatch<React.SetStateAction<InputType>>;
  const errors = form.errors as ErrorTree;

  const [saved, setSaved] = useState<InputType | null>(isNewRoute ? initialValues : null);
  const [meta, setMeta] = useState<SavedMeta | null>(null);
  const [examChoice, setExamChoice] = useState<ExamNewsExamChoice | null>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(() => new Set<SectionId>(["en-seo"]));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { setHeaderHidden } = useAdminLayout();
  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  const [headerHeight, setHeaderHeight] = useState(0);
  const headerObserverRef = useRef<ResizeObserver | null>(null);
  const headerRef = useCallback((el: HTMLElement | null) => {
    headerObserverRef.current?.disconnect();
    headerObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    headerObserverRef.current = observer;
  }, []);

  // The new-story form starts before the session has loaded, so pick up the author once it has.
  useEffect(() => {
    if (!isNewRoute || !currentAdminId) return;
    setValues((prev) => (prev.authorId ? prev : { ...prev, authorId: currentAdminId }));
    setSaved((prev) => (prev && !prev.authorId ? { ...prev, authorId: currentAdminId } : prev));
  }, [isNewRoute, currentAdminId, setValues]);

  // Load once, from a fetch made by this page, so later refetches never overwrite edits.
  const loadedPost = detailQuery.isFetchedAfterMount ? detailQuery.data?.post : undefined;
  useEffect(() => {
    if (saved || !loadedPost) return;
    const next = toFormValues(loadedPost);
    form.setValues(next);
    setSaved(next);
    setMeta(toMeta(loadedPost));
    setExamChoice(loadedPost.examId ? { id: loadedPost.examId, name: loadedPost.examName ?? "Exam" } : null);
    setPublishMode(loadedPost.status === "scheduled" ? "schedule" : "now");
  }, [saved, loadedPost, form.setValues]);

  const isDirty = !!saved && JSON.stringify(values) !== JSON.stringify(saved);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const slugToCheck = slugify(values.slug || values.title);
  const [debouncedSlug, setDebouncedSlug] = useState(slugToCheck);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slugToCheck), 400);
    return () => clearTimeout(timer);
  }, [slugToCheck]);
  const slugCheck = useQuery({
    queryKey: ["admin", "exam-news", "slug-check", debouncedSlug, values.id ?? null],
    queryFn: () => getAdminExamNewsSlugCheck({ slug: debouncedSlug, excludeId: values.id }),
    enabled: !!debouncedSlug,
    staleTime: 10_000,
  });

  const readinessIssues = useMemo(() => validateExamNews({ ...values, status: "published", publishAt: "" }), [values]);

  const admins = (adminsQuery.data?.admins ?? []).filter((a) => a.isActive || a.id === values.authorId);
  const authorName = admins.find((a) => a.id === values.authorId)?.fullName ?? null;

  const set = <K extends keyof InputType>(key: K, value: InputType[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const expandSections = (ids: SectionId[]) => setCollapsed((prev) => new Set([...prev].filter((id) => !ids.includes(id))));

  const toggleSection = (id: SectionId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const scrollToFirstError = () =>
    setTimeout(() => {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, SECTION_ANIMATION_MS + 50);

  const applyIssues = (issues: ValidationIssue[], headline?: string) => {
    form.validateForm();
    for (const issue of issues) form.setFieldError(issue.path, issue.message);
    expandSections(issues.flatMap((issue) => sectionOf(issue.path) ?? []));
    toast.error(headline ?? `${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, {
      description: issues[0]?.message,
    });
    scrollToFirstError();
  };

  const isLive = meta?.status === "published";
  const isScheduled = meta?.status === "scheduled";
  const isArchived = meta?.status === "archived";

  const submit = (target: InputType["status"]) => {
    if (saveMutation.isPending) return;
    const payload: InputType = {
      ...values,
      slug: slugify(values.slug || values.title),
      status: target,
      publishAt: target === "published" && publishMode === "now" && !isLive ? "" : values.publishAt,
    };
    const issues = validateExamNews(payload);
    if (issues.length > 0) {
      applyIssues(issues, target === "draft" ? undefined : `Not ready to ${target === "scheduled" ? "schedule" : "publish"}`);
      return;
    }
    form.validateForm();

    saveMutation.mutate(payload, {
      onSuccess: ({ post }) => {
        const settled = toFormValues(post);
        const patch = { id: post.id, slug: settled.slug, status: settled.status, publishAt: settled.publishAt };
        setSaved({ ...payload, ...patch });
        setValues((prev) => ({ ...prev, ...patch }));
        setMeta(toMeta(post));
        setPublishMode(post.status === "scheduled" ? "schedule" : "now");
        toast.success(
          post.status === "scheduled"
            ? `Scheduled for ${examNewsMeta.formatIst(examNewsMeta.fromIstInput(post.publishAt))}`
            : SUCCESS_COPY[target]
        );
        if (!values.id) navigate(examNewsMeta.editPath(post.id), { replace: true });
      },
      onError: (error) => {
        if (error instanceof ExamNewsValidationError) applyIssues(error.issues, error.message);
        else toast.error(parseErrorMessage(error) || "Could not save");
      },
    });
  };

  const runStatus = (action: "archive" | "restore") => {
    if (!values.id) return;
    statusMutation.mutate(
      { id: values.id, action },
      {
        onSuccess: ({ status }) => {
          setMeta((prev) => (prev ? { ...prev, status, publishedAt: status === "archived" ? null : prev.publishedAt } : prev));
          setConfirmArchive(false);
        },
        onError: (error) => toast.error(parseErrorMessage(error)),
      }
    );
  };

  if (!saved) {
    const notFound = routeId === null || (detailQuery.isError && /not found/i.test(String(detailQuery.error)));
    if (detailQuery.isError && !notFound) {
      return (
        <div className={styles.notFound}>
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load this story"
            description={parseErrorMessage(detailQuery.error)}
          >
            <Button variant="outline" onClick={() => detailQuery.refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        </div>
      );
    }
    if (notFound) {
      return (
        <div className={styles.notFound}>
          <Helmet>
            <title>Story not found - Testkart Admin</title>
          </Helmet>
          <ConsoleListEmpty icon={<BellRing size={24} />} title="Story not found" description="It may have been deleted, or the link is wrong.">
            <Button asChild variant="outline">
              <Link to="/admin/news">Back to News</Link>
            </Button>
          </ConsoleListEmpty>
        </div>
      );
    }
    return (
      <div className={styles.pageContainer} aria-busy="true">
        <Skeleton style={{ height: "64px", borderRadius: 0 }} />
        <div className={styles.contentArea}>
          <div className={styles.layout}>
            <Skeleton style={{ height: "560px", borderRadius: "var(--radius-md)" }} />
            <Skeleton style={{ height: "320px", borderRadius: "var(--radius-md)" }} />
          </div>
        </div>
      </div>
    );
  }

  const isSaved = !!values.id;
  const slugChanged = !!meta?.firstPublishedAt && !!saved.slug && saved.slug !== slugToCheck;
  const slugTaken =
    slugCheck.data && slugCheck.data.slug === slugToCheck && !slugCheck.data.available ? slugCheck.data.usedBy : null;

  const primaryLabel =
    publishMode === "schedule" && !isLive ? (isScheduled ? "Update schedule" : "Schedule") : isLive ? "Update" : "Publish";
  const primaryTarget: InputType["status"] = publishMode === "schedule" && !isLive ? "scheduled" : "published";

  const statusLine = (() => {
    if (!meta) return "Not saved yet";
    if (meta.status === "published" && meta.publishedAt) return `Live since ${examNewsMeta.formatIst(meta.publishedAt)}`;
    if (meta.status === "scheduled") return `Goes live ${examNewsMeta.formatIst(examNewsMeta.fromIstInput(saved.publishAt))}`;
    if (meta.status === "archived") return "Archived - hidden from the site";
    return "Draft - not on the site";
  })();

  const issuesIn = (match: (path: string) => boolean) => readinessIssues.filter((issue) => match(issue.path)).length;
  const rootIssues = (...roots: string[]) => issuesIn((path) => roots.includes(rootOf(path)));
  const filledDates = values.keyDates.filter((row) => row.eventName.trim()).length;
  const filledSources = values.sources.filter((s) => s.url.trim()).length;
  const corrections = values.corrections.filter((c) => c.note.trim()).length;
  const seoIssues = issuesIn((path) => sectionOf(path) === "en-seo");
  const seoCustomised = [values.seoTitle, values.seoDescription, values.ogTitle, values.ogDescription, values.ogImageUrl, values.canonicalUrl].some(Boolean);
  // Advisory only: a typed title or description past its target never blocks publishing.
  const seoTooLong = values.seoTitle.length > SEO_TITLE_TARGET || values.seoDescription.length > SEO_DESCRIPTION_TARGET;

  type CheckRow = { label: string; state: "ok" | "todo" | "optional"; detail?: string; target: SectionId };
  const checklist: CheckRow[] = [
    { label: "Headline and URL", state: rootIssues("title", "slug") === 0 && !slugTaken ? "ok" : "todo", target: "en-basics" },
    { label: "Standfirst", state: rootIssues("summary") === 0 ? "ok" : "todo", target: "en-basics" },
    {
      label: "Exam",
      state: rootIssues("examId") === 0 ? "ok" : "todo",
      detail: examChoice?.name,
      target: "en-basics",
    },
    { label: "Author", state: rootIssues("authorId") === 0 ? "ok" : "todo", target: "en-basics" },
    { label: "Story", state: rootIssues("body", "heroImageAlt") === 0 ? "ok" : "todo", target: "en-story" },
    {
      label: "Hero image",
      state: values.heroImageUrl ? "ok" : "optional",
      detail: values.heroImageUrl ? undefined : "Optional",
      target: "en-story",
    },
    {
      label: "Key dates",
      state: rootIssues("keyDates") > 0 ? "todo" : filledDates > 0 ? "ok" : "optional",
      detail: rootIssues("keyDates") > 0 ? `${rootIssues("keyDates")} to fix` : filledDates > 0 ? `${filledDates} added` : "Optional",
      target: "en-dates",
    },
    {
      label: "Official source",
      state: rootIssues("officialSourceName", "officialSourceUrl", "sources") > 0 ? "todo" : values.officialSourceUrl.trim() ? "ok" : "optional",
      detail: values.officialSourceUrl.trim() ? (filledSources > 0 ? `+${filledSources} more` : undefined) : "Recommended",
      target: "en-sources",
    },
    ...(rootIssues("corrections") > 0
      ? [{ label: "Corrections", state: "todo" as const, detail: `${rootIssues("corrections")} to fix`, target: "en-corrections" as const }]
      : []),
    {
      label: "SEO & sharing",
      state: seoIssues > 0 || seoTooLong ? "todo" : seoCustomised ? "ok" : "optional",
      detail: seoIssues > 0 ? `${seoIssues} to fix` : seoTooLong ? "Too long" : seoCustomised ? undefined : "Optional",
      target: "en-seo",
    },
  ];
  const required = checklist.filter((row) => row.state !== "optional");
  const readyCount = required.filter((row) => row.state === "ok").length;

  const goTo = (id: SectionId) => {
    const delay = collapsed.has(id) ? SECTION_ANIMATION_MS : 50;
    expandSections([id]);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }), delay);
  };

  const sectionProps = (id: SectionId) => ({ id, open: !collapsed.has(id), onToggle: () => toggleSection(id) });

  /** What a collapsed section shows: anything to fix first, then what has been filled in. */
  const sectionStatus = (id: SectionId, filledLabel: string | null): SectionStatus | null => {
    const toFix = issuesIn((path) => sectionOf(path) === id) + (id === "en-basics" && slugTaken ? 1 : 0);
    if (toFix > 0) return { ok: false, label: `${toFix} to fix` };
    return filledLabel ? { ok: true, label: filledLabel } : null;
  };

  const seoTitle = values.seoTitle || values.title;
  const seoDescription = values.seoDescription || values.summary;
  const TypeIcon = EXAM_NEWS_TYPE_ICONS[values.newsType];

  return (
    <>
      <Helmet>
        <title>{`${isSaved ? "Edit" : "New"} news story - Testkart Admin`}</title>
      </Helmet>

      <Form {...form}>
        <form
          className={styles.pageContainer}
          onSubmit={(e) => {
            e.preventDefault();
            // React passes submits up through portals; only this form's own submit publishes.
            if (e.target !== e.currentTarget) return;
            submit(primaryTarget);
          }}
          noValidate
          style={{ "--rte-toolbar-top": `${headerHeight}px`, "--editor-header": `${headerHeight}px` } as React.CSSProperties}
        >
          <header ref={headerRef} className={styles.header}>
            <div className={styles.headerLeft}>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to="/admin/news" aria-label="Back to News">
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <div className={styles.headingBlock}>
                <h1 className={styles.heading}>{isSaved ? "Edit news story" : "New news story"}</h1>
                <div className={styles.saveStatus} aria-live="polite">
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 size={14} className={styles.spinIcon} /> Saving...
                    </>
                  ) : isDirty ? (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusDotYellow}`} /> Unsaved changes
                    </>
                  ) : isSaved ? (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusDotGreen}`} /> All changes saved
                    </>
                  ) : (
                    "Not saved yet"
                  )}
                </div>
              </div>
            </div>

            <div className={styles.headerRight}>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye size={16} /> <span className={styles.hideSmall}>Preview</span>
              </Button>
              {isLive || isScheduled ? (
                <Button variant="outline" onClick={() => setConfirmUnpublish(true)} disabled={saveMutation.isPending}>
                  Unpublish
                </Button>
              ) : (
                <Button variant="outline" onClick={() => submit("draft")} disabled={saveMutation.isPending}>
                  Save draft
                </Button>
              )}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : primaryLabel}
              </Button>
            </div>
          </header>

          <div className={styles.contentArea}>
            <div className={styles.layout}>
              <div className={styles.mainColumn}>
                <EditorSection {...sectionProps("en-basics")} step={1} title="Basic information" status={sectionStatus("en-basics", "Complete")}>
                  <FormItem name="title">
                    <FormLabel>Headline</FormLabel>
                    <FormControl>
                      <Input
                        className={styles.titleInput}
                        value={values.title}
                        placeholder="e.g. NEET UG 2026 result declared at neet.nta.nic.in"
                        onChange={(e) => {
                          const title = e.target.value;
                          setValues((prev) => ({
                            ...prev,
                            title,
                            slug:
                              !meta?.firstPublishedAt && (prev.slug === "" || prev.slug === slugify(prev.title))
                                ? slugify(title)
                                : prev.slug,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="slug">
                    <FormLabel>URL slug</FormLabel>
                    <div className={styles.slugRow}>
                      <span className={styles.slugPrefix}>testkart.in/exam-news/</span>
                      <FormControl>
                        <Input
                          className={styles.slugInput}
                          value={values.slug}
                          placeholder="made-from-the-headline"
                          onChange={(e) => set("slug", e.target.value)}
                          onBlur={() => setValues((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
                        />
                      </FormControl>
                    </div>
                    {slugTaken ? (
                      <p className={styles.inlineError} role="alert">
                        Already used by "{slugTaken.title}". Pick another slug before saving.
                      </p>
                    ) : (
                      <p className={styles.hint}>Follows the headline until you edit it.</p>
                    )}
                    {slugChanged && <p className={styles.warning}>The old URL /exam-news/{saved.slug} keeps redirecting to the new one.</p>}
                    <FormMessage />
                  </FormItem>

                  <FormItem name="summary">
                    <FormLabel>Standfirst</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        value={values.summary}
                        placeholder="One or two lines summarising the update, shown under the headline and in listings."
                        onChange={(e) => set("summary", e.target.value)}
                      />
                    </FormControl>
                    <p className={`${styles.hint} ${values.summary.length > 280 ? styles.over : ""}`}>{values.summary.length} / 280</p>
                    <FormMessage />
                  </FormItem>

                  <div className={styles.grid3}>
                    <FormItem name="newsType">
                      <FormLabel>News type</FormLabel>
                      <Select value={values.newsType} onValueChange={(v) => set("newsType", v as InputType["newsType"])}>
                        <FormControl>
                          <SelectTrigger>
                            <span className={styles.typeValue}>
                              <TypeIcon size={15} aria-hidden="true" />
                              <SelectValue />
                            </span>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {examNewsMeta.NEWS_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="examId">
                      <FormLabel>Exam</FormLabel>
                      <ExamNewsExamPicker
                        value={examChoice}
                        invalid={typeof errors.examId === "string"}
                        onChange={(choice) => {
                          setExamChoice(choice);
                          set("examId", choice?.id ?? null);
                        }}
                      />
                      <FormMessage />
                    </FormItem>

                    <FormItem name="authorId">
                      <FormLabel>Author</FormLabel>
                      <Select
                        value={values.authorId ? String(values.authorId) : "__none"}
                        onValueChange={(v) => set("authorId", v === "__none" ? null : Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an author" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none">No author</SelectItem>
                          {admins.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  </div>
                </EditorSection>

                <EditorSection
                  {...sectionProps("en-story")}
                  step={2}
                  title="Story"
                  hint="Use Heading 2 and 3 for subheads"
                  status={sectionStatus("en-story", "Complete")}
                >
                  <div className={styles.coverBlock}>
                    <FormItem name="heroImageUrl" className={styles.coverUpload}>
                      <FormLabel>Hero image</FormLabel>
                      <ImageUploader
                        folder="exam-news"
                        currentImageUrl={values.heroImageUrl || undefined}
                        currentFileId={values.heroImageFileId || undefined}
                        aspectRatio="16 / 9"
                        label="Upload hero image"
                        onSuccess={({ url, fileId }) => setValues((prev) => ({ ...prev, heroImageUrl: url, heroImageFileId: fileId }))}
                      />
                      <FormMessage />
                    </FormItem>
                    <div className={styles.coverMeta}>
                      <FormItem name="heroImageAlt">
                        <FormLabel>Alt text</FormLabel>
                        <FormControl>
                          <Input
                            value={values.heroImageAlt}
                            placeholder="What the image shows"
                            onChange={(e) => set("heroImageAlt", e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="heroImageCredit">
                        <FormLabel>Credit / caption</FormLabel>
                        <FormControl>
                          <Input
                            value={values.heroImageCredit}
                            placeholder="e.g. Photo: NTA"
                            onChange={(e) => set("heroImageCredit", e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                  </div>

                  <FormItem name="body">
                    <FormLabel>Article</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={values.body}
                        onChange={(body) => set("body", body)}
                        placeholder="What changed, who it affects, and what students should do next..."
                        minHeight={340}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </EditorSection>

                <EditorSection
                  {...sectionProps("en-dates")}
                  step={3}
                  title="Key dates"
                  tag="Optional"
                  hint="Shown as a table on the story and feeds upcoming dates"
                  status={sectionStatus("en-dates", filledDates > 0 ? `${filledDates} added` : null)}
                >
                  <ExamNewsKeyDatesEditor value={values.keyDates} onChange={(keyDates) => set("keyDates", keyDates)} />
                </EditorSection>

                <EditorSection
                  {...sectionProps("en-sources")}
                  step={4}
                  title="Official sources"
                  tag="Recommended"
                  status={sectionStatus("en-sources", values.officialSourceUrl.trim() ? "Complete" : null)}
                >
                  <div className={styles.sourceGrid}>
                    <FormItem name="officialSourceName">
                      <FormLabel>Source name</FormLabel>
                      <FormControl>
                        <Input
                          value={values.officialSourceName}
                          placeholder="e.g. NTA public notice"
                          onChange={(e) => set("officialSourceName", e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="officialSourceUrl">
                      <FormLabel>Official notice URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          inputMode="url"
                          value={values.officialSourceUrl}
                          placeholder="https://"
                          onChange={(e) => set("officialSourceUrl", e.target.value)}
                          onBlur={(e) => {
                            const url = e.target.value.trim();
                            if (url && !/^https?:\/\//i.test(url) && /^[\w-]+\.[\w.-]+/.test(url)) set("officialSourceUrl", `https://${url}`);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </div>
                  <div className={styles.subBlock}>
                    <h3 className={styles.subTitle}>Additional links</h3>
                    <CurrentAffairsSourcesEditor
                      name="sources"
                      value={values.sources}
                      onChange={(sources) => set("sources", sources)}
                      suggestions={SOURCE_SUGGESTIONS}
                      addLabel="Add link"
                    />
                  </div>
                </EditorSection>

                <EditorSection
                  {...sectionProps("en-corrections")}
                  step={5}
                  title="Corrections"
                  tag="Optional"
                  hint="Shown on the story only when there is one"
                  status={sectionStatus("en-corrections", corrections > 0 ? `${corrections} added` : null)}
                >
                  <ExamNewsCorrectionsEditor value={values.corrections} onChange={(next) => set("corrections", next)} />
                </EditorSection>

                <EditorSection
                  {...sectionProps("en-seo")}
                  step={6}
                  title="SEO & sharing"
                  hint="Falls back to the headline, standfirst and hero image"
                  status={seoTooLong && seoIssues === 0 ? { ok: false, label: "Too long" } : sectionStatus("en-seo", seoCustomised ? "Customised" : null)}
                >
                  <div className={styles.snippet} aria-label="Search result preview">
                    <span className={styles.snippetUrl}>testkart.in/exam-news/{slugToCheck || "..."}</span>
                    <span className={styles.snippetTitle}>{seoTitle || "SEO title"}</span>
                    <span className={styles.snippetText}>{seoDescription || "The meta description shows here."}</span>
                  </div>

                  <div className={styles.grid2}>
                    <FormItem name="seoTitle">
                      <FormLabel>SEO title</FormLabel>
                      <FormControl>
                        <Input value={values.seoTitle} placeholder={values.title} onChange={(e) => set("seoTitle", e.target.value)} />
                      </FormControl>
                      <p className={`${styles.hint} ${seoTitle.length > SEO_TITLE_TARGET ? styles.over : ""}`}>
                        {seoTitle.length} / {SEO_TITLE_TARGET}
                      </p>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="seoDescription">
                      <FormLabel>Meta description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          value={values.seoDescription}
                          placeholder={values.summary || "Shown under the title in search results"}
                          onChange={(e) => set("seoDescription", e.target.value)}
                        />
                      </FormControl>
                      <p className={`${styles.hint} ${seoDescription.length > SEO_DESCRIPTION_TARGET ? styles.over : ""}`}>
                        {seoDescription.length} / {SEO_DESCRIPTION_TARGET}
                      </p>
                      <FormMessage />
                    </FormItem>
                  </div>

                  <h3 className={styles.subTitle}>Social sharing</h3>
                  <div className={styles.shareBlock}>
                    <FormItem name="ogImageUrl" className={styles.ogField}>
                      <FormLabel>Sharing image</FormLabel>
                      <ImageUploader
                        folder="exam-news"
                        currentImageUrl={values.ogImageUrl || undefined}
                        currentFileId={values.ogImageFileId || undefined}
                        aspectRatio="1200 / 630"
                        label="Upload sharing image"
                        onSuccess={({ url, fileId }) => setValues((prev) => ({ ...prev, ogImageUrl: url, ogImageFileId: fileId }))}
                      />
                      <p className={styles.hint}>1200x630. Left blank, the hero image is shared.</p>
                      <FormMessage />
                    </FormItem>
                    <div className={styles.coverMeta}>
                      <FormItem name="ogTitle">
                        <FormLabel>Sharing title</FormLabel>
                        <FormControl>
                          <Input value={values.ogTitle} placeholder={seoTitle} onChange={(e) => set("ogTitle", e.target.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="ogDescription">
                        <FormLabel>Sharing description</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            value={values.ogDescription}
                            placeholder={seoDescription || "Shown in WhatsApp, Telegram and social previews"}
                            onChange={(e) => set("ogDescription", e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                  </div>

                  <FormItem name="canonicalUrl">
                    <FormLabel>Canonical URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        inputMode="url"
                        value={values.canonicalUrl}
                        placeholder={`https://testkart.in/exam-news/${slugToCheck || "..."}`}
                        onChange={(e) => set("canonicalUrl", e.target.value)}
                      />
                    </FormControl>
                    <p className={styles.hint}>Leave blank unless this story is a copy of a page that should rank instead.</p>
                    <FormMessage />
                  </FormItem>
                </EditorSection>
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.sideCard}>
                  <div className={styles.sideHead}>
                    <h2 className={styles.sideTitle}>Publication</h2>
                    {meta && <CurrentAffairsStatusBadge status={meta.status} />}
                  </div>
                  <p className={styles.statusLine}>{statusLine}</p>

                  {isArchived && (
                    <Button variant="outline" size="sm" onClick={() => runStatus("restore")} disabled={statusMutation.isPending}>
                      <ArchiveRestore size={14} /> Restore as draft
                    </Button>
                  )}

                  {!isLive && (
                    <RadioGroup
                      value={publishMode}
                      onValueChange={(mode) => {
                        setPublishMode(mode as PublishMode);
                        if (mode === "schedule" && !values.publishAt) set("publishAt", tomorrowNineIst());
                      }}
                      className={styles.modeGroup}
                      aria-label="When to publish"
                    >
                      <label className={styles.modeOption}>
                        <RadioGroupItem value="now" /> Publish immediately
                      </label>
                      <label className={styles.modeOption}>
                        <RadioGroupItem value="schedule" /> Schedule for later
                      </label>
                    </RadioGroup>
                  )}

                  {(publishMode === "schedule" || isLive) && (
                    <FormItem name="publishAt">
                      <FormLabel>{isLive ? "Published at (IST)" : "Goes live at (IST)"}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" value={values.publishAt} onChange={(e) => set("publishAt", e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                </section>

                <section className={styles.sideCard}>
                  <div className={styles.sideHead}>
                    <h2 className={styles.sideTitle}>Ready to publish</h2>
                    <span className={readyCount === required.length ? styles.readyAll : styles.readyCount}>
                      {readyCount}/{required.length}
                    </span>
                  </div>
                  <ul className={styles.checklist}>
                    {checklist.map((row) => (
                      <li key={row.label}>
                        <button type="button" className={styles.checkRow} onClick={() => goTo(row.target)}>
                          {row.state === "ok" ? (
                            <CheckCircle2 size={15} className={styles.readyIcon} aria-label="Done" />
                          ) : row.state === "todo" ? (
                            <AlertCircle size={15} className={styles.notReadyIcon} aria-label="Needs attention" />
                          ) : (
                            <Circle size={15} className={styles.optionalIcon} aria-label="Optional" />
                          )}
                          <span className={styles.checkLabel}>{row.label}</span>
                          {row.detail && <span className={styles.checkDetail}>{row.detail}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {corrections > 0 && (
                    <p className={styles.recordLine}>
                      {corrections} correction{corrections === 1 ? "" : "s"} will show on the story.
                    </p>
                  )}
                </section>

                {meta && (
                  <section className={styles.sideCard}>
                    <p className={styles.recordLine}>
                      Last saved {examNewsMeta.formatIst(meta.updatedAt)}
                      {meta.updatedByName && ` by ${meta.updatedByName}`}
                    </p>
                    <div className={styles.recordActions}>
                      {isLive && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={examNewsMeta.publicPath(saved.slug)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={14} /> Live page
                          </a>
                        </Button>
                      )}
                      {values.id && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={examNewsMeta.previewPath(values.id)} target="_blank" rel="noopener noreferrer">
                            <Eye size={14} /> Saved version
                          </Link>
                        </Button>
                      )}
                      {!isArchived && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmArchive(true)}>
                          <Archive size={14} /> Archive
                        </Button>
                      )}
                      {(meta.status === "draft" || isArchived) && (
                        <Button variant="ghost" size="sm" className={styles.danger} onClick={() => setConfirmDelete(true)}>
                          <Trash2 size={14} /> Delete
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </div>
        </form>
      </Form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <ConsoleDialogContent size="xl">
          <ConsoleDialogHeader title="Preview" description="Built from what is in the editor now, saved or not." />
          <ConsoleDialogBody>
            <ExamNewsPreview
              post={{ ...values, status: meta?.status ?? "draft" }}
              examName={examChoice?.name ?? null}
              authorName={authorName}
              publishedAt={isLive ? meta?.publishedAt : null}
              updatedAt={meta?.updatedAt}
            />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish and save as draft?"
        description="The story comes off the site and your current edits are saved with it as a draft."
        confirmLabel="Unpublish"
        isPending={saveMutation.isPending}
        onConfirm={() => {
          setConfirmUnpublish(false);
          setPublishMode("now");
          submit("draft");
        }}
      />

      <ConsoleConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        tone="destructive"
        icon={<Archive size={20} />}
        title="Archive this story?"
        description={
          isDirty
            ? "It is hidden from the site. Unsaved edits stay in this editor only - save a draft first to keep them."
            : "It is hidden from the site and the default list. You can restore it later."
        }
        confirmLabel="Archive"
        isPending={statusMutation.isPending}
        onConfirm={() => runStatus("archive")}
      />

      <DeleteConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!values.id) return;
          deleteMutation.mutate(values.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              setSaved(null);
              navigate("/admin/news");
            },
          });
        }}
        isPending={deleteMutation.isPending}
        itemName={values.title}
        itemType="news story"
      />
    </>
  );
};

export default AdminExamNewsEditorPage;