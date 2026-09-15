import React, { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Selectable } from "kysely";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Eye, Loader2, Newspaper, Trash2 } from "lucide-react";
import { NewsCoverage } from "../helpers/schema";
import {
  useAdminNewsQuery,
  useUpsertNewsMutation,
  useDeleteNewsMutation,
} from "../helpers/useAdminNews";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { slugify } from "../helpers/slugify";
import { writeupToHtml, writeupToPlainText } from "../helpers/newsWriteup";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ImageUploader } from "../components/ImageUploader";
import { RichTextEditor } from "../components/RichTextEditor";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "../components/Form";
import styles from "./admin.news.e.$id.module.css";

/** The live site, so "View article" opens the real page rather than the preview. */
const PUBLIC_ORIGIN = "https://testkart.in";

const newsFormSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  publicationName: z.string(),
  imageUrl: z.string().min(1, "A banner photo is required"),
  imageFileId: z.string(),
  excerpt: z.string().max(500, "Keep the excerpt under 500 characters"),
  writeup: z.string().refine((value) => writeupToPlainText(value).length > 0, {
    message: "Writeup is required",
  }),
  coverageUrl: z
    .string()
    .refine((v) => v === "" || z.string().url().safeParse(v).success, {
      message: "Enter a full URL, including https://",
    }),
  keywords: z.string().max(500, "Keep keywords under 500 characters"),
  publishedAt: z.string().min(1, "Published date is required"),
  isPublished: z.boolean(),
});

type NewsFormValues = z.infer<typeof newsFormSchema>;

const FIELDS = Object.keys(newsFormSchema.shape) as (keyof NewsFormValues)[];

const sameValues = (a: NewsFormValues, b: NewsFormValues) =>
  FIELDS.every((field) => a[field] === b[field]);

const today = () => new Date().toISOString().slice(0, 10);

const emptyValues = (): NewsFormValues => ({
  title: "",
  slug: "",
  publicationName: "",
  imageUrl: "",
  imageFileId: "",
  excerpt: "",
  writeup: "",
  coverageUrl: "",
  keywords: "",
  publishedAt: today(),
  isPublished: true,
});

const toFormValues = (item: Selectable<NewsCoverage>): NewsFormValues => ({
  id: item.id,
  title: item.title,
  slug: item.slug,
  publicationName: item.publicationName ?? "",
  imageUrl: item.imageUrl,
  imageFileId: item.imageFileId ?? "",
  excerpt: item.excerpt ?? "",
  writeup: writeupToHtml(item.writeup),
  coverageUrl: item.coverageUrl ?? "",
  keywords: item.keywords ?? "",
  publishedAt: new Date(item.publishedAt).toISOString().slice(0, 10),
  isPublished: item.isPublished,
});

const AdminNewsEditorPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNewRoute = idSegment === "new";
  const routeId = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;

  const { data, isError, error, refetch, isFetchedAfterMount } = useAdminNewsQuery({
    refetchOnMount: "always",
  });
  const upsertMutation = useUpsertNewsMutation();
  const deleteMutation = useDeleteNewsMutation();

  const [initialValues] = useState(emptyValues);
  const form = useForm({ schema: newsFormSchema, defaultValues: initialValues });
  // The last saved state; null until an existing entry has loaded.
  const [saved, setSaved] = useState<NewsFormValues | null>(isNewRoute ? initialValues : null);
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

  const item = routeId !== null ? data?.items.find((entry) => entry.id === routeId) : undefined;

  // Load once, from a fetch made by this page, so edits are never overwritten by a refetch.
  useEffect(() => {
    if (saved || !item || !isFetchedAfterMount) return;
    const values = toFormValues(item);
    form.setValues(values);
    setSaved(values);
  }, [saved, item, isFetchedAfterMount, form.setValues]);

  const isDirty = !!saved && !sameValues(form.values, saved);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (upsertMutation.isPending) return;
    if (!form.validateForm()) {
      toast.error("Some fields need attention before this can be saved.");
      return;
    }

    const values = form.values;
    upsertMutation.mutate(
      {
        id: values.id,
        title: values.title,
        slug: values.slug,
        publicationName: values.publicationName || null,
        imageUrl: values.imageUrl,
        imageFileId: values.imageFileId || null,
        excerpt: values.excerpt || null,
        writeup: values.writeup,
        coverageUrl: values.coverageUrl || null,
        keywords: values.keywords || null,
        publishedAt: new Date(values.publishedAt),
        isPublished: values.isPublished,
      },
      {
        onSuccess: ({ item: savedItem }) => {
          const next = toFormValues(savedItem);
          setSaved(next);
          // The server settles the slug and keywords; anything typed during the save stays.
          form.setValues((prev) => ({
            ...prev,
            id: savedItem.id,
            slug: next.slug,
            keywords: next.keywords,
          }));
          if (!values.id) {
            navigate(`/admin/news/e/${savedItem.id}`, { replace: true });
          }
        },
      }
    );
  };

  const handleDelete = () => {
    if (!form.values.id) return;
    deleteMutation.mutate(
      { id: form.values.id },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          navigate("/admin/news");
        },
      }
    );
  };

  if (!saved) {
    const notFound = routeId === null || (isFetchedAfterMount && !!data && !item);

    if (isError && !data) {
      return (
        <div className={styles.notFound}>
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load this coverage"
            description={
              error instanceof Error
                ? error.message
                : "The request did not come back. Check your connection and try again."
            }
          >
            <Button variant="outline" onClick={() => refetch()}>
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
            <title>Coverage not found - Testkart Admin</title>
          </Helmet>
          <ConsoleListEmpty
            icon={<Newspaper size={24} />}
            title="Coverage not found"
            description="This entry may have been deleted, or the link is wrong."
          >
            <Button asChild variant="outline">
              <Link to="/admin/news">Back to news and events</Link>
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
            <Skeleton style={{ height: "520px", borderRadius: "var(--radius-md)" }} />
            <Skeleton style={{ height: "520px", borderRadius: "var(--radius-md)" }} />
          </div>
        </div>
      </div>
    );
  }

  const isSaved = !!form.values.id;
  const slugPreview = slugify(form.values.slug);
  const originalSlug = saved.id ? saved.slug : null;
  const slugChanged = !!originalSlug && originalSlug !== slugPreview;
  const keywordCount = new Set(
    form.values.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  ).size;

  return (
    <>
      <Helmet>
        <title>{`${isSaved ? "Edit coverage" : "New coverage"} - Testkart Admin`}</title>
      </Helmet>

      <Form {...form}>
        <form
          className={styles.pageContainer}
          onSubmit={handleSave}
          noValidate
          style={{ "--rte-toolbar-top": `${headerHeight}px` } as React.CSSProperties}
        >
          <header ref={headerRef} className={styles.header}>
            <div className={styles.headerLeft}>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to="/admin/news" aria-label="Back to news and events">
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <div className={styles.headingBlock}>
                <h1 className={styles.heading}>{isSaved ? "Edit coverage" : "New coverage"}</h1>
                <div className={styles.saveStatus} aria-live="polite">
                  {upsertMutation.isPending ? (
                    <>
                      <Loader2 size={14} className={styles.spinIcon} /> Saving...
                    </>
                  ) : isDirty ? (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusDotYellow}`} /> Unsaved
                      changes
                    </>
                  ) : isSaved ? (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusDotGreen}`} /> All
                      changes saved
                    </>
                  ) : (
                    "Not saved yet"
                  )}
                </div>
              </div>
            </div>

            <div className={styles.headerRight}>
              {saved.id && (
                <>
                  <Badge variant={saved.isPublished ? "success" : "secondary"}>
                    {saved.isPublished ? "Published" : "Hidden"}
                  </Badge>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-md"
                    aria-label="View article on the site"
                  >
                    <a
                      href={`${PUBLIC_ORIGIN}/news-and-events/${saved.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View article"
                    >
                      <Eye size={16} />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-md"
                    className={styles.deleteAction}
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Delete coverage"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending
                  ? "Saving..."
                  : isSaved
                    ? "Save changes"
                    : "Create coverage"}
              </Button>
            </div>
          </header>

          <div className={styles.contentArea}>
            <div className={styles.layout}>
              <div className={styles.writingSurface}>
                <FormItem name="title">
                  <FormControl>
                    <input
                      className={styles.titleInput}
                      placeholder="Coverage title"
                      aria-label="Title"
                      value={form.values.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        form.setValues((prev) => ({
                          ...prev,
                          title,
                          // Only track the title while the slug has never been
                          // hand-edited and the entry has no live URL yet.
                          slug:
                            !prev.id && prev.slug === slugify(prev.title)
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

                <FormItem name="writeup">
                  <FormControl>
                    <RichTextEditor
                      className={styles.editor}
                      value={form.values.writeup}
                      onChange={(writeup) => form.setValues((prev) => ({ ...prev, writeup }))}
                      placeholder="Write about the coverage or event..."
                      minHeight={420}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Publishing</h2>

                  <FormItem name="isPublished">
                    <div className={styles.switchRow}>
                      <FormLabel>Visible on the public page</FormLabel>
                      <FormControl>
                        <Switch
                          checked={form.values.isPublished}
                          onCheckedChange={(checked) =>
                            form.setValues((prev) => ({ ...prev, isPublished: checked }))
                          }
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="publishedAt">
                    <FormLabel>Published date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={form.values.publishedAt}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, publishedAt: e.target.value }))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="publicationName">
                    <FormLabel>Publication (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. The Hindu"
                        value={form.values.publicationName}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, publicationName: e.target.value }))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </section>

                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Banner photo</h2>
                  <FormItem name="imageUrl">
                    {/* Not wrapped in FormControl: that slots props onto its
                        child, and ImageUploader is not a DOM-forwarding input. */}
                    <ImageUploader
                      folder="news-coverage"
                      currentImageUrl={form.values.imageUrl || undefined}
                      currentFileId={form.values.imageFileId || undefined}
                      aspectRatio="16 / 9"
                      label="Upload banner photo"
                      onSuccess={({ url, fileId }) =>
                        form.setValues((prev) => ({
                          ...prev,
                          imageUrl: url,
                          imageFileId: fileId,
                        }))
                      }
                    />
                    <p className={styles.hint}>
                      Always 16:9 - 1200x675 or larger. Shown uncropped, so anything off-ratio
                      letterboxes. Doubles as the social share image.
                    </p>
                    <FormMessage />
                  </FormItem>
                </section>

                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>URL and search</h2>

                  <FormItem name="slug">
                    <FormLabel>URL slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="testkart-featured-in-the-hindu"
                        value={form.values.slug}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        onBlur={() =>
                          form.setValues((prev) => ({ ...prev, slug: slugify(prev.slug) }))
                        }
                      />
                    </FormControl>
                    <p className={styles.urlPreview}>
                      testkart.in/news-and-events/<strong>{slugPreview || "..."}</strong>
                    </p>
                    {slugChanged && (
                      <p className={styles.warning}>
                        The old URL /news-and-events/{originalSlug} will 301 to the new one, so
                        existing links keep working.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>

                  <FormItem name="excerpt">
                    <FormLabel>Excerpt (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="One or two lines shown under the title in the list."
                        rows={3}
                        value={form.values.excerpt}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, excerpt: e.target.value }))
                        }
                      />
                    </FormControl>
                    <p className={styles.hint}>
                      Also the search and social description. Left blank, the start of the
                      writeup is used.
                    </p>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="keywords">
                    <FormLabel>Keywords (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ssc exams, mock tests, edtech funding"
                        value={form.values.keywords}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, keywords: e.target.value }))
                        }
                      />
                    </FormControl>
                    <p className={styles.hint}>
                      Comma separated. Blanks and duplicates are dropped on save.
                      {keywordCount > 0 &&
                        ` ${keywordCount} keyword${keywordCount === 1 ? "" : "s"}.`}
                    </p>
                    <FormMessage />
                  </FormItem>
                </section>

                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Original coverage</h2>
                  <FormItem name="coverageUrl">
                    <FormLabel>Coverage page URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/article"
                        value={form.values.coverageUrl}
                        onChange={(e) =>
                          form.setValues((prev) => ({ ...prev, coverageUrl: e.target.value }))
                        }
                      />
                    </FormControl>
                    <p className={styles.hint}>
                      Shown as an "Open coverage page" button under the writeup.
                    </p>
                    <FormMessage />
                  </FormItem>
                </section>
              </aside>
            </div>
          </div>
        </form>
      </Form>

      <DeleteConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
        itemName={form.values.title}
        itemType="news coverage"
      />
    </>
  );
};

export default AdminNewsEditorPage;
