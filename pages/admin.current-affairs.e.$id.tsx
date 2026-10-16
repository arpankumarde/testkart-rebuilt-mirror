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
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Tags,
  Trash2,
  LayoutList,
  X,
} from "lucide-react";
import {
  schema as saveSchema,
  CurrentAffairsValidationError,
  type InputType,
  type ValidationIssue,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsPostDetail, CurrentAffairsRelatedSummary } from "../endpoints/admin/current-affairs/get_GET.schema";
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
import type { CurrentAffairsContentType, CurrentAffairsStatus } from "../helpers/schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
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
import { CurrentAffairsSourcesEditor } from "../components/CurrentAffairsSourcesEditor";
import { CurrentAffairsItemsEditor, emptyCurrentAffairsItem } from "../components/CurrentAffairsItemsEditor";
import { CurrentAffairsQuizEditor } from "../components/CurrentAffairsQuizEditor";
import { CurrentAffairsRelatedPicker } from "../components/CurrentAffairsRelatedPicker";
import { CurrentAffairsPreview } from "../components/CurrentAffairsPreview";
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from "../components/Form";
import styles from "./admin.current-affairs.e.$id.module.css";

type SectionKey = "basics" | "tags" | "content" | "supporting" | "quiz" | "seo";
type PublishMode = "now" | "schedule";
type ErrorTree = { [key: string]: string | ErrorTree };
type SavedMeta = Pick<
  CurrentAffairsPostDetail,
  "status" | "publishedAt" | "firstPublishedAt" | "updatedAt" | "createdAt" | "createdByName" | "updatedByName" | "previousSlugs"
>;

const SEO_TITLE_TARGET = 60;
const SEO_DESCRIPTION_TARGET = 160;
const GLANCE_MAX = 5;

const sectionOf = (path: string): SectionKey => {
  const root = path.split(".")[0];
  if (["tags"].includes(root)) return "tags";
  if (["items", "itemCount", "atAGlance", "body"].includes(root)) return "content";
  if (["sources", "relatedIds", "corrections", "readingTimeMinutes"].includes(root)) return "supporting";
  if (root === "quiz") return "quiz";
  if (["seoTitle", "seoDescription", "ogImageUrl"].includes(root)) return "seo";
  return "basics";
};

const flattenErrors = (tree: ErrorTree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flattenErrors(value, `${prefix}${key}.`)
  );

const contentLabel = (type: CurrentAffairsContentType) =>
  type === "editorial_analysis" ? "Analysis" : type === "individual_item" ? "Story" : "Digest items";

const dailyTitle = (day: string) => `Current Affairs: ${currentAffairsMeta.formatDay(day)}`;

const tomorrowSevenIst = () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${currentAffairsMeta.toIstInput(tomorrow).slice(0, 10)}T07:00`;
};

const isContentType = (value: string | null): value is CurrentAffairsContentType =>
  currentAffairsMeta.CONTENT_TYPES.some((t) => t.value === value);

const emptyValues = (contentType: CurrentAffairsContentType, authorId: number | null): InputType => ({
  contentType,
  title: contentType === "daily_digest" ? dailyTitle(currentAffairsMeta.istToday()) : "",
  slug: contentType === "daily_digest" ? slugify(dailyTitle(currentAffairsMeta.istToday())) : "",
  summary: "",
  coverImageUrl: "",
  coverImageFileId: "",
  coverImageAlt: "",
  coverImageCredit: "",
  authorId,
  language: "en",
  status: "draft",
  publishAt: "",
  digestDate: currentAffairsMeta.isDigest(contentType) ? currentAffairsMeta.istToday() : "",
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
  items: contentType === "individual_item" ? [emptyCurrentAffairsItem()] : [],
  relatedIds: [],
  corrections: [],
  quiz: null,
});

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
});

const SUCCESS_COPY: Record<InputType["status"], string> = {
  draft: "Draft saved",
  scheduled: "Scheduled",
  published: "Published",
};

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
    return emptyValues(isContentType(type) ? type : "daily_digest", currentAdminId);
  });
  const form = useForm({ schema: saveSchema, defaultValues: initialValues });
  const values = form.values as InputType;
  const setValues = form.setValues as React.Dispatch<React.SetStateAction<InputType>>;

  const [saved, setSaved] = useState<InputType | null>(isNewRoute ? initialValues : null);
  const [meta, setMeta] = useState<SavedMeta | null>(null);
  const [section, setSection] = useState<SectionKey>("basics");
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [related, setRelated] = useState<Record<number, CurrentAffairsRelatedSummary>>({});

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
    setRelated(Object.fromEntries(loadedPost.related.map((r) => [r.id, r])));
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

  const errorPaths = useMemo(() => flattenErrors(form.errors as ErrorTree), [form.errors]);
  const sectionErrors = useMemo(() => {
    const counts: Partial<Record<SectionKey, number>> = {};
    for (const path of errorPaths) counts[sectionOf(path)] = (counts[sectionOf(path)] ?? 0) + 1;
    return counts;
  }, [errorPaths]);

  const readiness = useMemo(() => {
    const issues = validateCurrentAffairs({ ...values, status: "published", publishAt: "" });
    const counts: Partial<Record<SectionKey, number>> = {};
    for (const issue of issues) counts[sectionOf(issue.path)] = (counts[sectionOf(issue.path)] ?? 0) + 1;
    return { total: issues.length, counts };
  }, [values]);

  const tagOptions = tagsQuery.data?.tags ?? [];
  const admins = (adminsQuery.data?.admins ?? []).filter((a) => a.isActive || a.id === values.authorId);
  const authorName = admins.find((a) => a.id === values.authorId)?.fullName ?? null;

  const set = <K extends keyof InputType>(key: K, value: InputType[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const applyIssues = (issues: ValidationIssue[], headline?: string) => {
    form.validateForm();
    for (const issue of issues) form.setFieldError(issue.path, issue.message);
    const first = issues[0];
    if (first) setSection(sectionOf(first.path));
    toast.error(headline ?? `${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, {
      description: first?.message,
    });
    setTimeout(() => {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 150);
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

  const changeContentType = (contentType: CurrentAffairsContentType) =>
    setValues((prev) => {
      const next: InputType = { ...prev, contentType };
      if (contentType === "individual_item" && prev.items.length === 0) next.items = [emptyCurrentAffairsItem()];
      if (currentAffairsMeta.isDigest(contentType) && !prev.digestDate) next.digestDate = currentAffairsMeta.istToday();
      return next;
    });

  const changeDigestDate = (digestDate: string) =>
    setValues((prev) => {
      const next: InputType = { ...prev, digestDate };
      const autoTitle = prev.digestDate ? dailyTitle(prev.digestDate) : "";
      if (prev.contentType === "daily_digest" && digestDate && (!prev.title || prev.title === autoTitle)) {
        next.title = dailyTitle(digestDate);
        if (!meta?.firstPublishedAt && prev.slug === slugify(prev.title)) next.slug = slugify(next.title);
      }
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
            title="Could not load this post"
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
            <title>Post not found - Testkart Admin</title>
          </Helmet>
          <ConsoleListEmpty
            icon={<CalendarDays size={24} />}
            title="Post not found"
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
            <Skeleton style={{ height: "420px", borderRadius: "var(--radius-md)" }} />
          </div>
        </div>
      </div>
    );
  }

  const isSaved = !!values.id;
  const slugChanged = !!meta?.firstPublishedAt && !!saved.slug && saved.slug !== slugToCheck;
  const slugTaken = slugCheck.data && slugCheck.data.slug === slugToCheck && !slugCheck.data.available ? slugCheck.data.usedBy : null;
  const isDigest = currentAffairsMeta.isDigest(values.contentType);
  const quizDefaultTitle = values.digestDate ? `Daily quiz: ${currentAffairsMeta.formatDay(values.digestDate)}` : "Daily quiz";

  const primaryLabel =
    publishMode === "schedule" && !isLive ? (isScheduled ? "Update schedule" : "Schedule") : isLive ? "Update" : "Publish";
  const primaryTarget: InputType["status"] = publishMode === "schedule" && !isLive ? "scheduled" : "published";

  const sections: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: "basics", label: "Basics", icon: <FileText size={15} /> },
    { key: "tags", label: "Tags", icon: <Tags size={15} /> },
    { key: "content", label: contentLabel(values.contentType), icon: <LayoutList size={15} /> },
    { key: "supporting", label: "Sources & related", icon: <Link2 size={15} /> },
    { key: "quiz", label: "Quiz", icon: <ListChecks size={15} /> },
    { key: "seo", label: "SEO & sharing", icon: <Search size={15} /> },
  ];

  const statusLine = (() => {
    if (!meta) return "Not saved yet";
    if (meta.status === "published" && meta.publishedAt) return `Live since ${currentAffairsMeta.formatIst(meta.publishedAt)}`;
    if (meta.status === "scheduled") return `Goes live ${currentAffairsMeta.formatIst(currentAffairsMeta.fromIstInput(saved.publishAt))}`;
    if (meta.status === "archived") return "Archived - hidden from the site";
    return "Draft - not on the site";
  })();

  const renderBasics = () => (
    <div className={styles.sectionBody}>
      <FormItem name="title">
        <FormControl>
          <input
            className={styles.titleInput}
            placeholder="Headline"
            aria-label="Title"
            value={values.title}
            onChange={(e) => {
              const title = e.target.value;
              setValues((prev) => ({
                ...prev,
                title,
                // The slug follows the title until it is hand-edited or the post has gone live once.
                slug: !meta?.firstPublishedAt && prev.slug === slugify(prev.title) ? slugify(title) : prev.slug,
              }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <div className={styles.grid2}>
        <FormItem name="contentType">
          <FormLabel>Content type</FormLabel>
          <Select value={values.contentType} onValueChange={(v) => changeContentType(v as CurrentAffairsContentType)}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {currentAffairsMeta.CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>

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

        {isDigest && (
          <FormItem name="digestDate">
            <FormLabel>
              {values.contentType === "daily_digest" ? "Digest date" : values.contentType === "weekly_digest" ? "Week starting" : "Month starting"}
            </FormLabel>
            <FormControl>
              <Input type="date" value={values.digestDate} onChange={(e) => changeDigestDate(e.target.value)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}

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

      <FormItem name="slug">
        <FormLabel>URL slug</FormLabel>
        <FormControl>
          <Input
            value={values.slug}
            placeholder="current-affairs-23-october-2026"
            onChange={(e) => set("slug", e.target.value)}
            onBlur={() => setValues((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
          />
        </FormControl>
        <p className={styles.urlPreview}>
          testkart.in/current-affairs/<strong>{slugToCheck || "..."}</strong>
        </p>
        {slugTaken ? (
          <p className={styles.fieldError} role="alert">
            Already used by "{slugTaken.title}". Pick another slug before saving.
          </p>
        ) : slugCheck.data?.available && slugCheck.data.slug === slugToCheck && slugToCheck !== saved.slug ? (
          <p className={styles.fieldOk}>
            <CheckCircle2 size={13} aria-hidden="true" /> Available
          </p>
        ) : null}
        {slugChanged && (
          <p className={styles.warning}>The old URL /current-affairs/{saved.slug} keeps redirecting to the new one.</p>
        )}
        <FormMessage />
      </FormItem>

      <FormItem name="summary">
        <FormLabel>Summary</FormLabel>
        <FormControl>
          <Textarea
            rows={3}
            value={values.summary}
            placeholder="One or two lines under the headline: what this digest or article covers."
            onChange={(e) => set("summary", e.target.value)}
          />
        </FormControl>
        <p className={styles.hint}>{values.summary.length} / 600 - aim for under 200 characters.</p>
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
            onSuccess={({ url, fileId }) => setValues((prev) => ({ ...prev, coverImageUrl: url, coverImageFileId: fileId }))}
          />
          <p className={styles.hint}>16:9, 1200x675 or larger.</p>
          <FormMessage />
        </FormItem>
        <div className={styles.coverMeta}>
          <FormItem name="coverImageAlt">
            <FormLabel>Alt text</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                value={values.coverImageAlt}
                placeholder="What the image shows, for screen readers"
                onChange={(e) => set("coverImageAlt", e.target.value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="coverImageCredit">
            <FormLabel>Image credit (optional)</FormLabel>
            <FormControl>
              <Input value={values.coverImageCredit} placeholder="e.g. PIB" onChange={(e) => set("coverImageCredit", e.target.value)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>
      </div>
    </div>
  );

  const renderGlance = () => (
    <section className={styles.subCard}>
      <div className={styles.subHead}>
        <h3 className={styles.subTitle}>At a glance</h3>
        {values.items.some((i) => i.headline.trim()) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              set(
                "atAGlance",
                values.items
                  .map((i) => i.headline.trim())
                  .filter(Boolean)
                  .slice(0, GLANCE_MAX)
              )
            }
          >
            Fill from item headlines
          </Button>
        )}
      </div>
      <p className={styles.hint}>Up to {GLANCE_MAX} one-line summaries shown above the items.</p>
      {values.atAGlance.map((line, index) => (
        <div key={index} className={styles.inlineRow}>
          <Input
            value={line}
            aria-label={`At a glance line ${index + 1}`}
            onChange={(e) => set("atAGlance", values.atAGlance.map((l, i) => (i === index ? e.target.value : l)))}
          />
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.danger}
            onClick={() => set("atAGlance", values.atAGlance.filter((_, i) => i !== index))}
            aria-label={`Remove line ${index + 1}`}
          >
            <X size={16} />
          </Button>
        </div>
      ))}
      {values.atAGlance.length < GLANCE_MAX && (
        <Button variant="outline" size="sm" className={styles.selfStart} onClick={() => set("atAGlance", [...values.atAGlance, ""])}>
          <Plus size={14} /> Add line
        </Button>
      )}
    </section>
  );

  const renderContent = () => {
    if (values.contentType === "editorial_analysis") {
      return (
        <div className={styles.sectionBody}>
          <FormItem name="body">
            <FormLabel>Analysis</FormLabel>
            <FormControl>
              <RichTextEditor
                className={styles.editor}
                value={values.body}
                onChange={(body) => set("body", body)}
                placeholder="Write the editorial analysis..."
                minHeight={420}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>
      );
    }

    if (values.contentType === "individual_item") {
      return (
        <div className={styles.sectionBody}>
          {values.items.length > 1 && (
            <div className={styles.warning}>
              This post still holds {values.items.length} items from when it was a digest. A single item shows only one.
              <Button variant="outline" size="sm" onClick={() => set("items", values.items.slice(0, 1))}>
                Keep only the first
              </Button>
            </div>
          )}
          <FormItem name="itemCount">
            <FormMessage />
          </FormItem>
          <CurrentAffairsItemsEditor
            mode="single"
            items={values.items}
            onChange={(items) => set("items", items)}
            tagOptions={tagOptions}
            postTags={values.tags}
            errors={form.errors as ErrorTree}
          />
        </div>
      );
    }

    return (
      <div className={styles.sectionBody}>
        {renderGlance()}
        <CurrentAffairsItemsEditor
          items={values.items}
          onChange={(items) => set("items", items)}
          tagOptions={tagOptions}
          postTags={values.tags}
          errors={form.errors as ErrorTree}
        />
        {values.contentType !== "daily_digest" && (
          <FormItem name="body">
            <FormLabel>Overview (optional)</FormLabel>
            <FormControl>
              <RichTextEditor
                value={values.body}
                onChange={(body) => set("body", body)}
                placeholder="An introduction to the week or month..."
                minHeight={200}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      </div>
    );
  };

  const renderSupporting = () => (
    <div className={styles.sectionBody}>
      <section className={styles.subCard}>
        <h3 className={styles.subTitle}>Sources</h3>
        <p className={styles.hint}>
          {values.contentType === "editorial_analysis"
            ? "The articles and reports this analysis draws on. At least one is needed to publish."
            : "Post-wide references. Each digest item keeps its own sources too."}
        </p>
        <CurrentAffairsSourcesEditor name="sources" value={values.sources} onChange={(sources) => set("sources", sources)} />
      </section>

      <section className={styles.subCard}>
        <h3 className={styles.subTitle}>Related current affairs</h3>
        <CurrentAffairsRelatedPicker
          value={values.relatedIds}
          onChange={(ids) => set("relatedIds", ids)}
          known={related}
          onKnown={(summary) => setRelated((prev) => ({ ...prev, [summary.id]: summary }))}
          excludeId={values.id}
        />
      </section>

      <section className={styles.subCard}>
        <h3 className={styles.subTitle}>Corrections</h3>
        <p className={styles.hint}>Dated notes shown at the end of the post, only when there is one.</p>
        {values.corrections.map((correction, index) => (
          <div key={correction.key} className={styles.correctionRow}>
            <FormItem name={`corrections.${index}.date`}>
              <FormControl>
                <Input
                  type="date"
                  aria-label={`Correction ${index + 1} date`}
                  value={correction.date}
                  onChange={(e) =>
                    set("corrections", values.corrections.map((c, i) => (i === index ? { ...c, date: e.target.value } : c)))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name={`corrections.${index}.note`}>
              <FormControl>
                <Textarea
                  rows={2}
                  aria-label={`Correction ${index + 1} note`}
                  placeholder="What was wrong and what it now says"
                  value={correction.note}
                  onChange={(e) =>
                    set("corrections", values.corrections.map((c, i) => (i === index ? { ...c, note: e.target.value } : c)))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.danger}
              onClick={() => set("corrections", values.corrections.filter((_, i) => i !== index))}
              aria-label={`Remove correction ${index + 1}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className={styles.selfStart}
          onClick={() =>
            set("corrections", [
              ...values.corrections,
              { key: `c-${Date.now()}`, date: currentAffairsMeta.istToday(), note: "" },
            ])
          }
        >
          <Plus size={14} /> Add correction
        </Button>
      </section>

      <section className={styles.subCard}>
        <h3 className={styles.subTitle}>Reading time</h3>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>
            {values.readingTimeIsManual
              ? "Set by hand"
              : `Worked out from the text: ${currentAffairsMeta.readingMinutes([
                  values.summary,
                  values.body,
                  ...values.atAGlance,
                  ...values.items.flatMap((i) => [i.headline, i.whyInNews, i.keyPoints, i.background]),
                ])} min`}
          </span>
          <Switch
            checked={values.readingTimeIsManual}
            onCheckedChange={(manual) => set("readingTimeIsManual", manual)}
            aria-label="Set reading time by hand"
          />
        </div>
        {values.readingTimeIsManual && (
          <FormItem name="readingTimeMinutes" className={styles.narrowField}>
            <FormLabel>Minutes</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                max={240}
                value={values.readingTimeMinutes}
                onChange={(e) => set("readingTimeMinutes", Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      </section>
    </div>
  );

  const renderSeo = () => {
    const seoTitle = values.seoTitle || values.title;
    const seoDescription = values.seoDescription || values.summary;
    return (
      <div className={styles.sectionBody}>
        <FormItem name="seoTitle">
          <FormLabel>SEO title</FormLabel>
          <FormControl>
            <Input value={values.seoTitle} placeholder={values.title} onChange={(e) => set("seoTitle", e.target.value)} />
          </FormControl>
          <p className={`${styles.hint} ${seoTitle.length > SEO_TITLE_TARGET ? styles.over : ""}`}>
            {seoTitle.length} / {SEO_TITLE_TARGET}. Left blank, the headline is used.
          </p>
          <FormMessage />
        </FormItem>
        <FormItem name="seoDescription">
          <FormLabel>Meta description</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              value={values.seoDescription}
              placeholder={values.summary}
              onChange={(e) => set("seoDescription", e.target.value)}
            />
          </FormControl>
          <p className={`${styles.hint} ${seoDescription.length > SEO_DESCRIPTION_TARGET ? styles.over : ""}`}>
            {seoDescription.length} / {SEO_DESCRIPTION_TARGET}. Left blank, the summary is used.
          </p>
          <FormMessage />
        </FormItem>

        <div className={styles.snippet} aria-label="Search result preview">
          <span className={styles.snippetUrl}>testkart.in - current-affairs - {slugToCheck || "..."}</span>
          <span className={styles.snippetTitle}>{seoTitle || "Headline"}</span>
          <span className={styles.snippetText}>{seoDescription || "Summary"}</span>
        </div>

        <FormItem name="ogImageUrl" className={styles.ogField}>
          <FormLabel>Social sharing image (optional)</FormLabel>
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
      </div>
    );
  };

  const renderSection = () => {
    switch (section) {
      case "basics":
        return renderBasics();
      case "tags":
        return (
          <div className={styles.sectionBody}>
            <p className={styles.hint}>
              Post-level tags feed the topic pages and exam filters. Click a suggestion to add it, or type to add a custom tag.
              Existing tags are suggested as you type, so the same tag is never created twice.
            </p>
            <CurrentAffairsTagPicker value={values.tags} onChange={(tags) => set("tags", tags)} options={tagOptions} />
          </div>
        );
      case "content":
        return renderContent();
      case "supporting":
        return renderSupporting();
      case "quiz":
        return (
          <div className={styles.sectionBody}>
            <CurrentAffairsQuizEditor
              quiz={values.quiz}
              onChange={(quiz) => set("quiz", quiz)}
              tagOptions={tagOptions}
              postTags={values.tags}
              defaultTitle={quizDefaultTitle}
            />
          </div>
        );
      case "seo":
        return renderSeo();
    }
  };

  return (
    <>
      <Helmet>
        <title>{`${isSaved ? "Edit" : "New"} current affairs - Testkart Admin`}</title>
      </Helmet>

      <Form {...form}>
        <form
          className={styles.pageContainer}
          onSubmit={(e) => {
            e.preventDefault();
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
                <h1 className={styles.heading}>{isSaved ? "Edit current affairs" : "New current affairs"}</h1>
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
                <nav className={styles.sectionNav} aria-label="Form sections">
                  {sections.map((s) => {
                    const errorCount = sectionErrors[s.key] ?? 0;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        className={`${styles.sectionTab} ${section === s.key ? styles.sectionTabActive : ""}`}
                        aria-current={section === s.key ? "step" : undefined}
                        onClick={() => setSection(s.key)}
                      >
                        {s.icon}
                        {s.label}
                        {s.key === "content" && isDigest && <span className={styles.tabCount}>{values.items.length}</span>}
                        {errorCount > 0 && (
                          <span className={styles.tabError} aria-label={`${errorCount} to fix`}>
                            {errorCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
                <div className={styles.sectionCard}>{renderSection()}</div>
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.sectionTitle}>Publication</h2>
                    {meta && <CurrentAffairsStatusBadge status={meta.status} />}
                  </div>
                  <p className={styles.statusLine}>{statusLine}</p>

                  {isArchived && (
                    <Button variant="outline" onClick={() => runStatus("restore")} disabled={statusMutation.isPending}>
                      <ArchiveRestore size={16} /> Restore as draft
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
                      <p className={styles.hint}>India Standard Time. Scheduled posts go live on their own.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.sectionTitle}>Ready to publish</h2>
                    {readiness.total === 0 ? (
                      <CheckCircle2 size={18} className={styles.readyIcon} aria-label="Ready" />
                    ) : (
                      <span className={styles.readyCount}>{readiness.total} left</span>
                    )}
                  </div>
                  <ul className={styles.checklist}>
                    {sections.map((s) => {
                      const left = readiness.counts[s.key] ?? 0;
                      return (
                        <li key={s.key}>
                          <button type="button" className={styles.checkRow} onClick={() => setSection(s.key)}>
                            {left === 0 ? (
                              <CheckCircle2 size={15} className={styles.readyIcon} aria-hidden="true" />
                            ) : (
                              <AlertCircle size={15} className={styles.notReadyIcon} aria-hidden="true" />
                            )}
                            <span>{s.label}</span>
                            {left > 0 && <span className={styles.checkLeft}>{left} to do</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {meta && (
                  <section className={styles.card}>
                    <h2 className={styles.sectionTitle}>Record</h2>
                    <dl className={styles.record}>
                      <dt>Created</dt>
                      <dd>
                        {currentAffairsMeta.formatIst(meta.createdAt)}
                        {meta.createdByName && ` by ${meta.createdByName}`}
                      </dd>
                      <dt>Last saved</dt>
                      <dd>
                        {currentAffairsMeta.formatIst(meta.updatedAt)}
                        {meta.updatedByName && ` by ${meta.updatedByName}`}
                      </dd>
                      {meta.previousSlugs.length > 0 && (
                        <>
                          <dt>Old URLs</dt>
                          <dd>{meta.previousSlugs.length} redirecting</dd>
                        </>
                      )}
                    </dl>
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
              related={values.relatedIds.map((id) => ({ id, title: related[id]?.title ?? `Post #${id}` }))}
            />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish and save as draft?"
        description="The post comes off the site and your current edits are saved with it as a draft."
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
        title="Archive this post?"
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
        itemType="current affairs post"
      />
    </>
  );
};

export default AdminCurrentAffairsEditorPage;