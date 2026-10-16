import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  schema as saveSchema,
  CurrentAffairsValidationError,
  type InputType,
  type ValidationIssue,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsPostDetail } from "../endpoints/admin/current-affairs/get_GET.schema";
import { getAdminCurrentAffairsSlugCheck } from "../endpoints/admin/current-affairs/slug-check_GET.schema";
import {
  useAdminCurrentAffairsPost,
  useAdminCurrentAffairsTags,
  useCurrentAffairsStatusMutation,
  useDeleteCurrentAffairsMutation,
  useSaveCurrentAffairsMutation,
} from "../helpers/useAdminCurrentAffairs";
import { useAdminOptionsQuery } from "../helpers/useAdminOptions";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { validateCurrentAffairs } from "../helpers/currentAffairsValidation";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { slugify } from "../helpers/slugify";
import type { CurrentAffairsContentType } from "../helpers/schema";
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
import { CurrentAffairsTagPicker } from "../components/CurrentAffairsTagPicker";
import { CurrentAffairsItemsEditor, emptyCurrentAffairsItem } from "../components/CurrentAffairsItemsEditor";
import { CurrentAffairsQuizEditor } from "../components/CurrentAffairsQuizEditor";
import { CurrentAffairsPreview } from "../components/CurrentAffairsPreview";
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from "../components/Form";
import styles from "./admin.current-affairs.e.$id.module.css";

type PublishMode = "now" | "schedule";
type ErrorTree = { [key: string]: string | ErrorTree };
type SavedMeta = Pick<
  CurrentAffairsPostDetail,
  "status" | "publishedAt" | "firstPublishedAt" | "updatedAt" | "createdAt" | "createdByName" | "updatedByName" | "previousSlugs" | "related"
>;

const SEO_TITLE_TARGET = 60;
const SEO_DESCRIPTION_TARGET = 160;

const DIGEST_ICONS = {
  daily_digest: CalendarDays,
  weekly_digest: CalendarRange,
  monthly_digest: Calendar,
} as const;

/** Fields that live under Advanced settings, so an error there opens it. */
const ADVANCED_ROOTS = ["summary", "coverImageUrl", "coverImageAlt", "coverImageCredit", "slug", "seoTitle", "seoDescription", "ogImageUrl", "quiz"];

const rootOf = (path: string) => path.split(".")[0];

const isContentType = (value: string | null): value is CurrentAffairsContentType =>
  currentAffairsMeta.CONTENT_TYPES.some((t) => t.value === value);

const tomorrowSevenIst = () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${currentAffairsMeta.toIstInput(tomorrow).slice(0, 10)}T07:00`;
};

const emptyValues = (contentType: CurrentAffairsContentType, authorId: number | null): InputType => {
  const digestDate = currentAffairsMeta.periodStart(contentType, currentAffairsMeta.istToday());
  const title = currentAffairsMeta.autoTitle(contentType, digestDate);
  return {
    contentType,
    title,
    slug: slugify(title),
    summary: "",
    coverImageUrl: "",
    coverImageFileId: "",
    coverImageAlt: "",
    coverImageCredit: "",
    authorId,
    language: "en",
    status: "draft",
    publishAt: "",
    digestDate,
    atAGlance: [],
    body: "",
    readingTimeMinutes: 1,
    readingTimeIsManual: false,
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    ogImageFileId: "",
    tags: [],
    sources: [],
    items: [emptyCurrentAffairsItem()],
    relatedIds: [],
    corrections: [],
    quiz: null,
  };
};

const toFormValues = (post: CurrentAffairsPostDetail): InputType => {
  const values = saveSchema.parse({ ...post, status: post.status === "archived" ? "draft" : post.status });
  return { ...values, id: post.id };
};

const toMeta = (post: CurrentAffairsPostDetail): SavedMeta => ({
  status: post.status,
  publishedAt: post.publishedAt,
  firstPublishedAt: post.firstPublishedAt,
  updatedAt: post.updatedAt,
  createdAt: post.createdAt,
  createdByName: post.createdByName,
  updatedByName: post.updatedByName,
  previousSlugs: post.previousSlugs,
  related: post.related,
});

const SUCCESS_COPY: Record<InputType["status"], string> = {
  draft: "Draft saved",
  scheduled: "Scheduled",
  published: "Published",
};

const periodFieldLabel = (type: CurrentAffairsContentType) =>
  type === "weekly_digest" ? "Week starting (Monday)" : type === "monthly_digest" ? "Month" : "Date";

const AdminCurrentAffairsEditorPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNewRoute = idSegment === "new";
  const routeId = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;

  const { authState } = useAdminAuth();
  const currentAdminId = authState.type === "authenticated" ? authState.admin.id : null;

  const detailQuery = useAdminCurrentAffairsPost(routeId);
  const tagsQuery = useAdminCurrentAffairsTags();
  const adminsQuery = useAdminOptionsQuery();
  const saveMutation = useSaveCurrentAffairsMutation();
  const statusMutation = useCurrentAffairsStatusMutation();
  const deleteMutation = useDeleteCurrentAffairsMutation();

  const [initialValues] = useState(() => {
    const type = searchParams.get("type");
    return emptyValues(isContentType(type) && currentAffairsMeta.isDigest(type) ? type : "daily_digest", currentAdminId);
  });
  const form = useForm({ schema: saveSchema, defaultValues: initialValues });
  const values = form.values as InputType;
  const setValues = form.setValues as React.Dispatch<React.SetStateAction<InputType>>;

  const [saved, setSaved] = useState<InputType | null>(isNewRoute ? initialValues : null);
  const [meta, setMeta] = useState<SavedMeta | null>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  // Load once, from a fetch made by this page, so later refetches never overwrite edits.
  const loadedPost = detailQuery.isFetchedAfterMount ? detailQuery.data?.post : undefined;
  useEffect(() => {
    if (saved || !loadedPost) return;
    const next = toFormValues(loadedPost);
    form.setValues(next);
    setSaved(next);
    setMeta(toMeta(loadedPost));
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

  const slugToCheck = slugify(values.slug);
  const [debouncedSlug, setDebouncedSlug] = useState(slugToCheck);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slugToCheck), 400);
    return () => clearTimeout(timer);
  }, [slugToCheck]);
  const slugCheck = useQuery({
    queryKey: ["admin", "current-affairs", "slug-check", debouncedSlug, values.id ?? null],
    queryFn: () => getAdminCurrentAffairsSlugCheck({ slug: debouncedSlug, excludeId: values.id }),
    enabled: !!debouncedSlug,
    staleTime: 10_000,
  });

  const readinessIssues = useMemo(() => validateCurrentAffairs({ ...values, status: "published", publishAt: "" }), [values]);

  const tagOptions = tagsQuery.data?.tags ?? [];
  const admins = (adminsQuery.data?.admins ?? []).filter((a) => a.isActive || a.id === values.authorId);
  const authorName = admins.find((a) => a.id === values.authorId)?.fullName ?? null;

  const set = <K extends keyof InputType>(key: K, value: InputType[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const scrollToFirstError = () =>
    setTimeout(() => {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 150);

  const applyIssues = (issues: ValidationIssue[], headline?: string) => {
    form.validateForm();
    for (const issue of issues) form.setFieldError(issue.path, issue.message);
    if (issues.some((issue) => ADVANCED_ROOTS.includes(rootOf(issue.path)))) setAdvancedOpen(true);
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
      status: target,
      publishAt: target === "published" && publishMode === "now" && !isLive ? "" : values.publishAt,
    };
    const issues = validateCurrentAffairs(payload);
    if (issues.length > 0) {
      applyIssues(issues, target === "draft" ? undefined : `Not ready to ${target === "scheduled" ? "schedule" : "publish"}`);
      return;
    }
    form.validateForm();

    saveMutation.mutate(payload, {
      onSuccess: ({ post }) => {
        const settled = toFormValues(post);
        const patch = {
          id: post.id,
          slug: settled.slug,
          status: settled.status,
          publishAt: settled.publishAt,
          digestDate: settled.digestDate,
          readingTimeMinutes: settled.readingTimeMinutes,
        };
        setSaved({ ...payload, ...patch });
        setValues((prev) => ({ ...prev, ...patch }));
        setMeta(toMeta(post));
        setPublishMode(post.status === "scheduled" ? "schedule" : "now");
        toast.success(
          post.status === "scheduled"
            ? `Scheduled for ${currentAffairsMeta.formatIst(currentAffairsMeta.fromIstInput(post.publishAt))}`
            : SUCCESS_COPY[target]
        );
        if (!values.id) navigate(`/admin/current-affairs/e/${post.id}`, { replace: true });
      },
      onError: (error) => {
        if (error instanceof CurrentAffairsValidationError) applyIssues(error.issues, error.message);
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

  // Type and period drive the headline until the admin writes their own; the slug follows the
  // headline while it has never been hand-edited and the post has never gone live.
  const setPeriod = (contentType: CurrentAffairsContentType, day: string) =>
    setValues((prev) => {
      const digestDate = day ? currentAffairsMeta.periodStart(contentType, day) : "";
      const next: InputType = { ...prev, contentType, digestDate };
      const previousAuto = prev.digestDate ? currentAffairsMeta.autoTitle(prev.contentType, prev.digestDate) : "";
      if (digestDate && (!prev.title.trim() || prev.title === previousAuto)) {
        next.title = currentAffairsMeta.autoTitle(contentType, digestDate);
        if (!meta?.firstPublishedAt && prev.slug === slugify(prev.title)) next.slug = slugify(next.title);
      }
      if (next.items.length === 0) next.items = [emptyCurrentAffairsItem()];
      return next;
    });

  if (!saved) {
    const notFound = routeId === null || (detailQuery.isError && /not found/i.test(String(detailQuery.error)));
    if (detailQuery.isError && !notFound) {
      return (
        <div className={styles.notFound}>
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load this digest"
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
            <title>Digest not found - Testkart Admin</title>
          </Helmet>
          <ConsoleListEmpty
            icon={<CalendarDays size={24} />}
            title="Digest not found"
            description="It may have been deleted, or the link is wrong."
          >
            <Button asChild variant="outline">
              <Link to="/admin/current-affairs">Back to Current Affairs</Link>
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
  const isDigestType = currentAffairsMeta.isDigest(values.contentType);
  const slugChanged = !!meta?.firstPublishedAt && !!saved.slug && saved.slug !== slugToCheck;
  const slugTaken = slugCheck.data && slugCheck.data.slug === slugToCheck && !slugCheck.data.available ? slugCheck.data.usedBy : null;
  const period = currentAffairsMeta.periodLabel(values.contentType, values.digestDate);
  const quizDefaultTitle = period
    ? `${currentAffairsMeta.contentTypeShort(values.contentType)} quiz: ${period}`
    : "Current affairs quiz";

  const primaryLabel =
    publishMode === "schedule" && !isLive ? (isScheduled ? "Update schedule" : "Schedule") : isLive ? "Update" : "Publish";
  const primaryTarget: InputType["status"] = publishMode === "schedule" && !isLive ? "scheduled" : "published";

  const statusLine = (() => {
    if (!meta) return "Not saved yet";
    if (meta.status === "published" && meta.publishedAt) return `Live since ${currentAffairsMeta.formatIst(meta.publishedAt)}`;
    if (meta.status === "scheduled") return `Goes live ${currentAffairsMeta.formatIst(currentAffairsMeta.fromIstInput(saved.publishAt))}`;
    if (meta.status === "archived") return "Archived - hidden from the site";
    return "Draft - not on the site";
  })();

  const issueCount = (match: (root: string, path: string) => boolean) =>
    readinessIssues.filter((issue) => match(rootOf(issue.path), issue.path)).length;
  const itemIssueCount = issueCount((root) => root === "items");
  const advancedIssueCount = issueCount((root) => ADVANCED_ROOTS.includes(root));
  const checklist: { label: string; ok: boolean; detail?: string; target: string }[] = [
    { label: "Title", ok: issueCount((root) => root === "title") === 0, target: "ca-details" },
    {
      label: values.contentType === "weekly_digest" ? "Week" : values.contentType === "monthly_digest" ? "Month" : "Date",
      ok: issueCount((root) => root === "digestDate") === 0,
      target: "ca-details",
    },
    { label: "Author", ok: issueCount((root) => root === "authorId") === 0, target: "ca-details" },
    {
      label: "News items",
      ok: issueCount((root) => root === "itemCount") === 0 && itemIssueCount === 0,
      detail: values.items.length === 0 ? "None yet" : itemIssueCount > 0 ? `${itemIssueCount} to fix` : `${values.items.length} ready`,
      target: "ca-items",
    },
    ...(advancedIssueCount > 0
      ? [{ label: "Advanced settings", ok: false, detail: `${advancedIssueCount} to fix`, target: "ca-advanced" }]
      : []),
  ];
  const readyCount = checklist.filter((row) => row.ok).length;

  const goTo = (id: string) => {
    if (id === "ca-advanced") setAdvancedOpen(true);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
  };

  const renderPeriodField = () => {
    if (!isDigestType) return null;
    return (
      <FormItem name="digestDate">
        <FormLabel>{periodFieldLabel(values.contentType)}</FormLabel>
        <FormControl>
          {values.contentType === "monthly_digest" ? (
            <Input
              type="month"
              value={values.digestDate.slice(0, 7)}
              onChange={(e) => setPeriod(values.contentType, e.target.value ? `${e.target.value}-01` : "")}
            />
          ) : (
            <Input type="date" value={values.digestDate} onChange={(e) => setPeriod(values.contentType, e.target.value)} />
          )}
        </FormControl>
        {values.contentType === "weekly_digest" && period && <p className={styles.hint}>Covers {period}</p>}
        <FormMessage />
      </FormItem>
    );
  };

  const renderContent = () => {
    // Editorials and single items can no longer be created; older ones stay editable here.
    if (values.contentType === "editorial_analysis") {
      return (
        <FormItem name="body">
          <FormControl>
            <RichTextEditor value={values.body} onChange={(body) => set("body", body)} placeholder="Analysis..." minHeight={360} />
          </FormControl>
          <FormMessage />
        </FormItem>
      );
    }
    return (
      <CurrentAffairsItemsEditor
        mode={values.contentType === "individual_item" ? "single" : "list"}
        items={values.items}
        onChange={(items) => set("items", items)}
        tagOptions={tagOptions}
        postTags={values.tags}
        errors={form.errors as ErrorTree}
      />
    );
  };

  const seoTitle = values.seoTitle || values.title;
  const seoDescription = values.seoDescription || values.summary;

  return (
    <>
      <Helmet>
        <title>{`${isSaved ? "Edit" : "New"} digest - Testkart Admin`}</title>
      </Helmet>

      <Form {...form}>
        <form
          className={styles.pageContainer}
          onSubmit={(e) => {
            e.preventDefault();
            // React passes submits up through portals, so a confirm dialog's own form (delete item,
            // remove quiz) would otherwise land here and publish.
            if (e.target !== e.currentTarget) return;
            submit(primaryTarget);
          }}
          noValidate
          style={{ "--rte-toolbar-top": `${headerHeight}px`, "--editor-header": `${headerHeight}px` } as React.CSSProperties}
        >
          <header ref={headerRef} className={styles.header}>
            <div className={styles.headerLeft}>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to="/admin/current-affairs" aria-label="Back to Current Affairs">
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <div className={styles.headingBlock}>
                <h1 className={styles.heading}>{isSaved ? "Edit digest" : "New digest"}</h1>
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
                <section className={styles.card} aria-labelledby="ca-type-heading">
                  <h2 id="ca-type-heading" className={styles.cardTitle}>
                    Digest type
                  </h2>
                  <div role="radiogroup" aria-labelledby="ca-type-heading" className={styles.typeCards}>
                    {currentAffairsMeta.DIGEST_OPTIONS.map((option) => {
                      const Icon = DIGEST_ICONS[option.value];
                      const selected = values.contentType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`${styles.typeCard} ${styles[`type_${option.value}`]} ${selected ? styles.typeCardOn : ""}`}
                          onClick={() => {
                            // Start from today while the current period still covers it, so switching
                            // types back and forth never drifts to the start of a month or week.
                            const today = currentAffairsMeta.istToday();
                            const keep =
                              values.digestDate && !currentAffairsMeta.periodContains(values.contentType, values.digestDate, today);
                            setPeriod(option.value, keep ? values.digestDate : today);
                          }}
                        >
                          <span className={styles.typeIcon} aria-hidden="true">
                            <Icon size={20} />
                          </span>
                          <span className={styles.typeText}>
                            <span className={styles.typeLabel}>{option.label}</span>
                            <span className={styles.typeHint}>{option.hint}</span>
                          </span>
                          {selected && (
                            <span className={styles.typeCheck} aria-hidden="true">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!isDigestType && (
                    <p className={styles.warning}>
                      This is an older {currentAffairsMeta.contentTypeLabel(values.contentType)} post. It stays as it is
                      unless you pick a digest type above.
                    </p>
                  )}
                </section>

                <section id="ca-details" className={styles.card}>
                  <h2 className={styles.cardTitle}>Details</h2>
                  <FormItem name="title">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        className={styles.titleInput}
                        value={values.title}
                        placeholder="Current Affairs: 23 October 2026"
                        onChange={(e) => {
                          const title = e.target.value;
                          setValues((prev) => ({
                            ...prev,
                            title,
                            slug: !meta?.firstPublishedAt && prev.slug === slugify(prev.title) ? slugify(title) : prev.slug,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                      />
                    </FormControl>
                    <p className={styles.hint}>
                      testkart.in/current-affairs/<strong>{slugToCheck || "..."}</strong>
                      {slugTaken && <span className={styles.inlineError}> - already used by "{slugTaken.title}"</span>}
                    </p>
                    <FormMessage />
                  </FormItem>

                  <div className={styles.grid3}>
                    {renderPeriodField()}

                    <FormItem name="language">
                      <FormLabel>Language</FormLabel>
                      <Select value={values.language} onValueChange={(v) => set("language", v as InputType["language"])}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currentAffairsMeta.LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                </section>

                <section className={`${styles.card} ${styles.tagsCard}`}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Tags</h2>
                    <span className={`${styles.cardHint} ${styles.subtleHint}`}>Power topic pages and exam filters</span>
                  </div>
                  <CurrentAffairsTagPicker value={values.tags} onChange={(tags) => set("tags", tags)} options={tagOptions} variant="compact" />
                </section>

                <section id="ca-items" className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{values.contentType === "editorial_analysis" ? "Analysis" : "News items"}</h2>
                    {period && <span className={styles.cardHint}>{period}</span>}
                  </div>
                  {renderContent()}
                </section>

                <section id="ca-advanced" className={`${styles.card} ${styles.advanced}`}>
                  <button
                    type="button"
                    className={styles.advancedToggle}
                    aria-expanded={advancedOpen}
                    aria-controls="ca-advanced-body"
                    onClick={() => setAdvancedOpen((open) => !open)}
                  >
                    <span className={styles.cardTitle}>Advanced settings</span>
                    <span className={styles.cardHint}>
                      Summary, cover image, URL, SEO and quiz - all optional
                      {advancedIssueCount > 0 && <span className={styles.inlineError}> - {advancedIssueCount} to fix</span>}
                    </span>
                    <ChevronDown size={18} className={`${styles.chevron} ${advancedOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />
                  </button>

                  {advancedOpen && (
                    <div id="ca-advanced-body" className={styles.advancedBody}>
                      <FormItem name="summary">
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            value={values.summary}
                            placeholder="One or two lines shown under the title and in listings."
                            onChange={(e) => set("summary", e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <div className={styles.coverBlock}>
                        <FormItem name="coverImageUrl" className={styles.coverUpload}>
                          <FormLabel>Cover image</FormLabel>
                          <ImageUploader
                            folder="current-affairs"
                            currentImageUrl={values.coverImageUrl || undefined}
                            currentFileId={values.coverImageFileId || undefined}
                            aspectRatio="16 / 9"
                            label="Upload cover image"
                            onSuccess={({ url, fileId }) =>
                              setValues((prev) => ({ ...prev, coverImageUrl: url, coverImageFileId: fileId }))
                            }
                          />
                          <FormMessage />
                        </FormItem>
                        <div className={styles.coverMeta}>
                          <FormItem name="coverImageAlt">
                            <FormLabel>Alt text</FormLabel>
                            <FormControl>
                              <Input
                                value={values.coverImageAlt}
                                placeholder="What the image shows"
                                onChange={(e) => set("coverImageAlt", e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          <FormItem name="coverImageCredit">
                            <FormLabel>Image credit</FormLabel>
                            <FormControl>
                              <Input
                                value={values.coverImageCredit}
                                placeholder="e.g. PIB"
                                onChange={(e) => set("coverImageCredit", e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        </div>
                      </div>

                      <FormItem name="slug">
                        <FormLabel>URL slug</FormLabel>
                        <FormControl>
                          <Input
                            value={values.slug}
                            onChange={(e) => set("slug", e.target.value)}
                            onBlur={() => setValues((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
                          />
                        </FormControl>
                        {slugTaken ? (
                          <p className={styles.inlineError} role="alert">
                            Already used by "{slugTaken.title}". Pick another slug before saving.
                          </p>
                        ) : (
                          <p className={styles.hint}>Made from the title. Change it only if you need a different link.</p>
                        )}
                        {slugChanged && (
                          <p className={styles.warning}>The old URL /current-affairs/{saved.slug} keeps redirecting to the new one.</p>
                        )}
                        <FormMessage />
                      </FormItem>

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

                      <FormItem name="ogImageUrl" className={styles.ogField}>
                        <FormLabel>Social sharing image</FormLabel>
                        <ImageUploader
                          folder="current-affairs"
                          currentImageUrl={values.ogImageUrl || undefined}
                          currentFileId={values.ogImageFileId || undefined}
                          aspectRatio="1200 / 630"
                          label="Upload sharing image"
                          onSuccess={({ url, fileId }) => setValues((prev) => ({ ...prev, ogImageUrl: url, ogImageFileId: fileId }))}
                        />
                        <p className={styles.hint}>1200x630. Left blank, the cover image is shared.</p>
                        <FormMessage />
                      </FormItem>

                      <div className={styles.quizBlock}>
                        <h3 className={styles.subTitle}>Quiz</h3>
                        <CurrentAffairsQuizEditor
                          quiz={values.quiz}
                          onChange={(quiz) => set("quiz", quiz)}
                          tagOptions={tagOptions}
                          postTags={values.tags}
                          defaultTitle={quizDefaultTitle}
                          digest={{
                            title: values.title,
                            contentType: values.contentType,
                            digestDate: values.digestDate,
                            summary: values.summary,
                            body: values.body,
                            items: values.items,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </section>
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
                        if (mode === "schedule" && !values.publishAt) set("publishAt", tomorrowSevenIst());
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
                    <h2 className={styles.sideTitle}>Checklist</h2>
                    <span className={readyCount === checklist.length ? styles.readyAll : styles.readyCount}>
                      {readyCount}/{checklist.length}
                    </span>
                  </div>
                  <ul className={styles.checklist}>
                    {checklist.map((row) => (
                      <li key={row.label}>
                        <button type="button" className={styles.checkRow} onClick={() => goTo(row.target)}>
                          {row.ok ? (
                            <CheckCircle2 size={15} className={styles.readyIcon} aria-hidden="true" />
                          ) : (
                            <AlertCircle size={15} className={styles.notReadyIcon} aria-hidden="true" />
                          )}
                          <span>{row.label}</span>
                          {row.detail && <span className={styles.checkDetail}>{row.detail}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {meta && (
                  <section className={styles.sideCard}>
                    <p className={styles.recordLine}>
                      Last saved {currentAffairsMeta.formatIst(meta.updatedAt)}
                      {meta.updatedByName && ` by ${meta.updatedByName}`}
                    </p>
                    <div className={styles.recordActions}>
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
            <CurrentAffairsPreview
              post={{ ...values, status: meta?.status ?? "draft" }}
              authorName={authorName}
              publishedAt={isLive ? meta?.publishedAt : null}
              updatedAt={meta?.updatedAt}
              related={(meta?.related ?? []).filter((r) => values.relatedIds.includes(r.id))}
            />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish and save as draft?"
        description="The digest comes off the site and your current edits are saved with it as a draft."
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
        title="Archive this digest?"
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
              navigate("/admin/current-affairs");
            },
          });
        }}
        isPending={deleteMutation.isPending}
        itemName={values.title}
        itemType="digest"
      />
    </>
  );
};

export default AdminCurrentAffairsEditorPage;
