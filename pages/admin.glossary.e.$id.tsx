import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookA,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Loader2,
  Network,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  schema as saveSchema,
  GlossaryValidationError,
  type InputType,
  type ValidationIssue,
} from "../endpoints/admin/glossary/save_POST.schema";
import type { GlossaryRelatedTerm, GlossaryTermDetail } from "../endpoints/admin/glossary/get_GET.schema";
import { getAdminGlossarySlugCheck } from "../endpoints/admin/glossary/slug-check_GET.schema";
import {
  useAdminGlossaryTerm,
  useDeleteGlossaryTermMutation,
  useSaveGlossaryTermMutation,
  useUnpublishGlossaryTermMutation,
} from "../helpers/useAdminGlossary";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { RELATED_TERM_COUNT, validateGlossaryTerm } from "../helpers/glossaryValidation";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { slugify } from "../helpers/slugify";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Dialog } from "../components/Dialog";
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from "../components/Form";
import { GlossaryRelatedTermsPicker } from "../components/GlossaryRelatedTermsPicker";
import { GlossaryTermArticle, type GlossaryArticleTerm } from "../components/GlossaryTermArticle";
import { Input } from "../components/Input";
import { RichTextEditor } from "../components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { Textarea } from "../components/Textarea";
import styles from "./admin.glossary.e.$id.module.css";

const DEFINITION_LIMIT = 300;
const SEO_TITLE_TARGET = 60;
const SEO_DESCRIPTION_TARGET = 160;

type SavedMeta = Pick<
  GlossaryTermDetail,
  "status" | "publishedAt" | "firstPublishedAt" | "updatedAt" | "createdByName" | "updatedByName" | "previousSlugs" | "usedByCount"
>;

const emptyValues = (): InputType => ({
  term: "",
  slug: "",
  category: null,
  definition: "",
  explanationHeading: "",
  explanationFirst: "",
  explanationSecond: "",
  extraHeading: "",
  extraBody: "",
  productText: "",
  productUrl: "",
  productLabel: "",
  relatedTermIds: [],
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  status: "draft",
});

const toMeta = (term: GlossaryTermDetail): SavedMeta => ({
  status: term.status,
  publishedAt: term.publishedAt,
  firstPublishedAt: term.firstPublishedAt,
  updatedAt: term.updatedAt,
  createdByName: term.createdByName,
  updatedByName: term.updatedByName,
  previousSlugs: term.previousSlugs,
  usedByCount: term.usedByCount,
});

interface SectionCardProps {
  id: string;
  letter: string;
  title: string;
  icon: React.ReactNode;
  tone: string;
  tag?: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ id, letter, title, icon, tone, tag, children }) => (
  <section id={id} className={styles.card} aria-labelledby={`${id}-title`}>
    <header className={styles.cardHeader}>
      <span className={`${styles.cardIcon} ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <h2 id={`${id}-title`} className={styles.cardTitle}>
        <span className={styles.cardLetter}>{letter}.</span> {title}
      </h2>
      {tag && <span className={styles.optional}>{tag}</span>}
    </header>
    <div className={styles.cardBody}>{children}</div>
  </section>
);

const AdminGlossaryEditorPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNewRoute = idSegment === "new";
  const routeId = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;

  const detailQuery = useAdminGlossaryTerm(routeId);
  const saveMutation = useSaveGlossaryTermMutation();
  const unpublishMutation = useUnpublishGlossaryTermMutation();
  const deleteMutation = useDeleteGlossaryTermMutation();

  const [initialValues] = useState(emptyValues);
  const form = useForm({ schema: saveSchema, defaultValues: initialValues });
  const values = form.values as InputType;
  const setValues = form.setValues as React.Dispatch<React.SetStateAction<InputType>>;

  const [saved, setSaved] = useState<InputType | null>(isNewRoute ? initialValues : null);
  const [meta, setMeta] = useState<SavedMeta | null>(null);
  const [relatedTerms, setRelatedTerms] = useState<GlossaryRelatedTerm[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
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
  const loadedTerm = detailQuery.isFetchedAfterMount ? detailQuery.data?.term : undefined;
  useEffect(() => {
    if (saved || !loadedTerm) return;
    const next = saveSchema.parse(loadedTerm);
    form.setValues(next);
    setSaved(next);
    setMeta(toMeta(loadedTerm));
    setRelatedTerms(loadedTerm.relatedTerms);
    setExtraOpen(!!loadedTerm.extraHeading || glossaryMeta.hasText(loadedTerm.extraBody));
  }, [saved, loadedTerm, form.setValues]);

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

  const slugToCheck = slugify(values.slug || values.term);
  const [debouncedSlug, setDebouncedSlug] = useState(slugToCheck);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slugToCheck), 400);
    return () => clearTimeout(timer);
  }, [slugToCheck]);
  const slugCheck = useQuery({
    queryKey: ["admin", "glossary", "slug-check", debouncedSlug, values.id ?? null],
    queryFn: () => getAdminGlossarySlugCheck({ slug: debouncedSlug, excludeId: values.id }),
    enabled: !!debouncedSlug,
    staleTime: 10_000,
  });

  const readinessIssues = useMemo(() => validateGlossaryTerm({ ...values, status: "published" }), [values]);

  const set = <K extends keyof InputType>(key: K, value: InputType[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const chooseRelated = (terms: GlossaryRelatedTerm[]) => {
    setRelatedTerms(terms);
    set("relatedTermIds", terms.map((term) => term.id));
  };

  const applyIssues = (issues: ValidationIssue[], headline?: string) => {
    form.validateForm();
    for (const issue of issues) form.setFieldError(issue.path, issue.message);
    toast.error(headline ?? `${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, {
      description: issues[0]?.message,
    });
    setTimeout(() => {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  };

  const isLive = meta?.status === "published";

  const submit = (target: InputType["status"]) => {
    if (saveMutation.isPending) return;
    const payload: InputType = { ...values, slug: slugify(values.slug || values.term), status: target };
    const issues = validateGlossaryTerm(payload);
    if (issues.length > 0) {
      applyIssues(issues, target === "published" ? "Not ready to publish" : undefined);
      return;
    }
    form.validateForm();

    saveMutation.mutate(payload, {
      onSuccess: ({ term }) => {
        const patch = { id: term.id, slug: term.slug, status: term.status };
        setSaved({ ...payload, ...patch });
        setValues((prev) => ({ ...prev, ...patch }));
        setMeta(toMeta(term));
        setRelatedTerms(term.relatedTerms);
        toast.success(target === "draft" ? "Draft saved" : isLive ? "Updated" : "Published");
        if (!values.id) navigate(glossaryMeta.editPath(term.id), { replace: true });
      },
      onError: (error) => {
        if (error instanceof GlossaryValidationError) applyIssues(error.issues, error.message);
        else toast.error(parseErrorMessage(error) || "Could not save");
      },
    });
  };

  const runUnpublish = () => {
    if (!values.id) return;
    unpublishMutation.mutate(values.id, {
      onSuccess: () => {
        setConfirmUnpublish(false);
        setMeta((prev) => (prev ? { ...prev, status: "draft", publishedAt: null } : prev));
        setValues((prev) => ({ ...prev, status: "draft" }));
        setSaved((prev) => (prev ? { ...prev, status: "draft" } : prev));
      },
    });
  };

  if (!saved) {
    const notFound = routeId === null || (detailQuery.isError && /not found/i.test(String(detailQuery.error)));
    if (detailQuery.isError && !notFound) {
      return (
        <div className={styles.notFound}>
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load this term"
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
            <title>Term not found - Testkart Admin</title>
          </Helmet>
          <ConsoleListEmpty icon={<BookA size={24} />} title="Term not found" description="It may have been deleted, or the link is wrong.">
            <Button asChild variant="outline">
              <Link to={glossaryMeta.ADMIN_PATH}>Back to Glossary</Link>
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
  const slugTaken = slugCheck.data && slugCheck.data.slug === slugToCheck && !slugCheck.data.available ? slugCheck.data.usedBy : null;

  const termName = values.term.trim() || "[Term]";
  const publicPath = glossaryMeta.termPath(slugToCheck || "your-term");
  const seoTitle = glossaryMeta.metaTitle(termName, values.seoTitle);
  const seoDescription = glossaryMeta.metaDescription(values.definition, values.seoDescription);
  const liveRelated = relatedTerms.filter((term) => term.status === "published");
  const hiddenRelated = relatedTerms.length - liveRelated.length;

  const issuesFor = (...paths: string[]) => readinessIssues.filter((issue) => paths.includes(issue.path)).length;
  const checklist = [
    { label: "Name and definition", ok: issuesFor("term", "slug", "category", "definition") === 0 && !slugTaken, target: "gl-basics" },
    { label: "Explanation", ok: issuesFor("explanationFirst", "explanationSecond", "extraHeading", "extraBody") === 0, target: "gl-explanation" },
    { label: "See it on Testkart", ok: issuesFor("productText", "productUrl", "productLabel") === 0, target: "gl-product" },
    {
      label: "Related terms",
      ok: issuesFor("relatedTermIds") === 0,
      detail: `${values.relatedTermIds.length}/${RELATED_TERM_COUNT}`,
      target: "gl-related",
    },
  ];

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });

  const previewTerm: GlossaryArticleTerm = {
    term: values.term,
    slug: values.slug,
    category: values.category,
    definition: values.definition,
    explanationHeading: values.explanationHeading,
    explanationFirst: values.explanationFirst,
    explanationSecond: values.explanationSecond,
    extraHeading: values.extraHeading,
    extraBody: values.extraBody,
    productText: values.productText,
    productUrl: values.productUrl,
    productLabel: values.productLabel,
  };

  const usedBy = meta?.usedByCount ?? 0;
  const usedByLine =
    usedBy > 0 ? ` Its card also leaves the ${usedBy} term${usedBy === 1 ? "" : "s"} that list it as related.` : "";

  return (
    <>
      <Helmet>
        <title>{`${isSaved ? "Edit" : "New"} glossary term - Testkart Admin`}</title>
      </Helmet>

      <Form {...form}>
        <form
          className={styles.pageContainer}
          onSubmit={(e) => {
            e.preventDefault();
            // React passes submits up through portals; only this form's own submit publishes.
            if (e.target !== e.currentTarget) return;
            submit("published");
          }}
          onKeyDown={(e) => {
            // Enter in a single-line field must not publish the term.
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
          }}
          noValidate
          style={{ "--rte-toolbar-top": `${headerHeight}px`, "--editor-header": `${headerHeight}px` } as React.CSSProperties}
        >
          <header ref={headerRef} className={styles.header}>
            <div className={styles.headerLeft}>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to={glossaryMeta.ADMIN_PATH} aria-label="Back to Glossary">
                  <ArrowLeft size={18} />
                </Link>
              </Button>
              <div className={styles.headingBlock}>
                <h1 className={styles.heading}>{isSaved ? values.term || "Edit term" : "New term"}</h1>
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
              {isLive ? (
                <Button variant="outline" onClick={() => setConfirmUnpublish(true)} disabled={saveMutation.isPending}>
                  Unpublish
                </Button>
              ) : (
                <Button variant="outline" onClick={() => submit("draft")} disabled={saveMutation.isPending}>
                  Save as Draft
                </Button>
              )}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : isLive ? "Update" : "Publish"}
              </Button>
            </div>
          </header>

          <div className={styles.contentArea}>
            <div className={styles.layout}>
              <div className={styles.mainColumn}>
                <SectionCard id="gl-basics" letter="A" title="Basic information" icon={<BookA size={18} />} tone={styles.toneLavender}>
                  <FormItem name="term">
                    <FormLabel>Term name</FormLabel>
                    <FormControl>
                      <Input
                        value={values.term}
                        placeholder="e.g. Mock test"
                        onChange={(e) => {
                          const term = e.target.value;
                          setValues((prev) => ({
                            ...prev,
                            term,
                            slug:
                              !meta?.firstPublishedAt && (prev.slug === "" || prev.slug === slugify(prev.term)) ? slugify(term) : prev.slug,
                          }));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="slug">
                    <FormLabel>URL slug</FormLabel>
                    <div className={styles.slugRow}>
                      <span className={styles.slugPrefix}>testkart.in/glossary/</span>
                      <FormControl>
                        <Input
                          className={styles.slugInput}
                          value={values.slug}
                          placeholder="made-from-the-term"
                          onChange={(e) => set("slug", e.target.value)}
                          onBlur={() => setValues((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
                        />
                      </FormControl>
                    </div>
                    {slugTaken ? (
                      <p className={styles.inlineError} role="alert">
                        Already used by "{slugTaken.term}". Pick another slug before saving.
                      </p>
                    ) : (
                      <p className={styles.hint}>Follows the term name until you edit it.</p>
                    )}
                    {slugChanged && <p className={styles.warning}>The old URL /glossary/{saved.slug} keeps redirecting to the new one.</p>}
                    <FormMessage />
                  </FormItem>

                  <FormItem name="category">
                    <FormLabel>Category</FormLabel>
                    <Select value={values.category ?? undefined} onValueChange={(value) => set("category", value as InputType["category"])}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {glossaryMeta.CATEGORIES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="definition">
                    <FormLabel>One-line definition</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        maxLength={DEFINITION_LIMIT}
                        value={values.definition}
                        placeholder="One plain sentence. It also appears on the glossary card and on related-term cards."
                        onChange={(e) => set("definition", e.target.value.replace(/[\r\n]+/g, " "))}
                      />
                    </FormControl>
                    <p className={styles.hint}>
                      {values.definition.length} / {DEFINITION_LIMIT}
                    </p>
                    <FormMessage />
                  </FormItem>
                </SectionCard>

                <SectionCard id="gl-explanation" letter="B" title="Term explanation" icon={<FileText size={18} />} tone={styles.toneMint}>
                  <FormItem name="explanationHeading">
                    <FormLabel>Heading</FormLabel>
                    <FormControl>
                      <Input
                        value={values.explanationHeading}
                        placeholder={`What is ${termName}?`}
                        onChange={(e) => set("explanationHeading", e.target.value)}
                      />
                    </FormControl>
                    <p className={styles.hint}>Leave blank to use the wording shown. Edit it to read naturally, such as "What is a mock test?".</p>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="explanationFirst">
                    <FormLabel>Paragraph 1</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={values.explanationFirst}
                        onChange={(html) => set("explanationFirst", html)}
                        placeholder="What the term means."
                        minHeight={120}
                        disableMediaUpload
                        hideHeadingButtons
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="explanationSecond">
                    <FormLabel>Paragraph 2</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={values.explanationSecond}
                        onChange={(html) => set("explanationSecond", html)}
                        placeholder="How it is used in practice."
                        minHeight={120}
                        disableMediaUpload
                        hideHeadingButtons
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  {extraOpen ? (
                    <div className={styles.extra}>
                      <div className={styles.extraHead}>
                        <span className={styles.extraTitle}>Extra section</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setValues((prev) => ({ ...prev, extraHeading: "", extraBody: "" }));
                            setExtraOpen(false);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      <FormItem name="extraHeading">
                        <FormLabel>Section heading</FormLabel>
                        <FormControl>
                          <Input
                            value={values.extraHeading}
                            placeholder="e.g. Full form and other languages"
                            onChange={(e) => set("extraHeading", e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="extraBody">
                        <FormLabel>Section text</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            value={values.extraBody}
                            onChange={(html) => set("extraBody", html)}
                            placeholder="Full form, alternate names or translations."
                            minHeight={100}
                            disableMediaUpload
                            hideHeadingButtons
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className={styles.addExtra} onClick={() => setExtraOpen(true)}>
                      <Plus size={15} /> Add an extra section
                    </Button>
                  )}
                </SectionCard>

                <SectionCard id="gl-product" letter="C" title="See it on Testkart" icon={<Link2 size={18} />} tone={styles.tonePowder}>
                  <FormItem name="productText">
                    <FormLabel>Product explanation</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        maxLength={400}
                        value={values.productText}
                        placeholder="One sentence about how Testkart does this."
                        onChange={(e) => set("productText", e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <div className={styles.grid2}>
                    <FormItem name="productUrl">
                      <FormLabel>Landing page link</FormLabel>
                      <FormControl>
                        <Input value={values.productUrl} placeholder="/sell/mock-test" onChange={(e) => set("productUrl", e.target.value.trim())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="productLabel">
                      <FormLabel>Link label</FormLabel>
                      <FormControl>
                        <Input value={values.productLabel} placeholder="Create a mock test" onChange={(e) => set("productLabel", e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </div>

                  <div className={styles.shortcuts} role="group" aria-label="Testkart landing pages">
                    {glossaryMeta.PRODUCT_PAGES.map((page) => (
                      <button
                        key={page.path}
                        type="button"
                        className={`${styles.shortcut} ${values.productUrl === page.path ? styles.shortcutActive : ""}`}
                        aria-pressed={values.productUrl === page.path}
                        onClick={() => setValues((prev) => ({ ...prev, productUrl: page.path, productLabel: prev.productLabel || page.label }))}
                      >
                        {page.name}
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard id="gl-related" letter="D" title="Related terms" icon={<Network size={18} />} tone={styles.toneSage}>
                  <FormItem name="relatedTermIds">
                    <FormLabel>Choose exactly {RELATED_TERM_COUNT} terms</FormLabel>
                    <GlossaryRelatedTermsPicker value={relatedTerms} onChange={chooseRelated} excludeId={values.id} />
                    <FormMessage />
                  </FormItem>
                </SectionCard>

                <SectionCard id="gl-seo" letter="E" title="SEO settings" icon={<Search size={18} />} tone={styles.tonePeach}>
                  <FormItem name="seoTitle">
                    <FormLabel>Meta title</FormLabel>
                    <FormControl>
                      <Input
                        value={values.seoTitle}
                        maxLength={120}
                        placeholder={glossaryMeta.metaTitle(termName, "")}
                        onChange={(e) => set("seoTitle", e.target.value)}
                      />
                    </FormControl>
                    <p className={`${styles.hint} ${values.seoTitle.length > SEO_TITLE_TARGET ? styles.over : ""}`}>
                      {values.seoTitle.length} / {SEO_TITLE_TARGET}
                    </p>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="seoDescription">
                    <FormLabel>Meta description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        maxLength={320}
                        value={values.seoDescription}
                        placeholder="Leave blank to use the one-line definition."
                        onChange={(e) => set("seoDescription", e.target.value)}
                      />
                    </FormControl>
                    <p className={`${styles.hint} ${values.seoDescription.length > SEO_DESCRIPTION_TARGET ? styles.over : ""}`}>
                      {values.seoDescription.length} / {SEO_DESCRIPTION_TARGET}
                    </p>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="canonicalUrl">
                    <FormLabel>Canonical URL</FormLabel>
                    <FormControl>
                      <Input
                        value={values.canonicalUrl}
                        placeholder={glossaryMeta.canonicalUrl(slugToCheck || "your-term")}
                        onChange={(e) => set("canonicalUrl", e.target.value)}
                      />
                    </FormControl>
                    <p className={styles.hint}>Generated from the slug. Fill this in only to point at a different testkart.in page.</p>
                    <FormMessage />
                  </FormItem>

                  <div className={styles.serp} aria-label="Search result preview">
                    <span className={styles.serpLabel}>Search preview</span>
                    <span className={styles.serpTitle}>{seoTitle} | Testkart</span>
                    <span className={styles.serpUrl}>testkart.in {publicPath.replace(/\//g, " > ").trim()}</span>
                    <span className={styles.serpText}>{seoDescription || "The one-line definition appears here."}</span>
                  </div>
                  <p className={styles.hint}>BreadcrumbList structured data is added automatically: Home, Glossary, {termName}.</p>
                </SectionCard>
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.sideCard}>
                  <div className={styles.sideHead}>
                    <h2 className={styles.sideTitle}>F. Publication</h2>
                    <span className={`${styles.statusPill} ${isLive ? styles.statusLive : ""}`}>{isLive ? "Published" : "Draft"}</span>
                  </div>
                  <p className={styles.statusLine}>
                    {isLive
                      ? `Live for ${adminFormat.relativeTime(meta?.publishedAt).replace(" ago", "")}`
                      : meta
                        ? "Not on the site"
                        : "Not saved yet"}
                  </p>
                  {isLive && (
                    <a href={publicPath} target="_blank" rel="noopener noreferrer" className={styles.publicLink}>
                      {publicPath} <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </section>

                <section className={styles.sideCard}>
                  <h2 className={styles.sideTitle}>Ready to publish</h2>
                  <ul className={styles.checklist}>
                    {checklist.map((row) => (
                      <li key={row.label}>
                        <button type="button" className={styles.checkRow} onClick={() => goTo(row.target)}>
                          {row.ok ? (
                            <CheckCircle2 size={16} className={styles.checkOk} aria-hidden="true" />
                          ) : (
                            <Circle size={16} className={styles.checkTodo} aria-hidden="true" />
                          )}
                          <span>{row.label}</span>
                          {row.detail && <span className={styles.checkDetail}>{row.detail}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {hiddenRelated > 0 && (
                    <p className={styles.sideNote}>
                      {hiddenRelated} related term{hiddenRelated === 1 ? " is a draft" : "s are drafts"}. The public page shows them once they are
                      published.
                    </p>
                  )}
                </section>

                {meta && (
                  <section className={styles.sideCard}>
                    <p className={styles.recordLine}>
                      Updated {adminFormat.relativeTime(meta.updatedAt)}
                      {meta.updatedByName ? ` by ${meta.updatedByName}` : ""}
                    </p>
                    {usedBy > 0 && (
                      <p className={styles.recordLine}>
                        Listed as related by {usedBy} term{usedBy === 1 ? "" : "s"}
                      </p>
                    )}
                    <Button variant="ghost" size="sm" className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={14} /> Delete term
                    </Button>
                  </section>
                )}
              </aside>
            </div>
          </div>
        </form>
      </Form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <ConsoleDialogContent size="xl">
          <ConsoleDialogHeader
            title="Preview"
            description={isLive ? "Your current edits on the public layout." : "Your current edits on the public layout. Nothing here is on the site yet."}
          />
          <ConsoleDialogBody className={styles.previewBody}>
            {hiddenRelated > 0 && (
              <p className={styles.previewNote}>
                {hiddenRelated} related term{hiddenRelated === 1 ? " is hidden because it is a draft" : "s are hidden because they are drafts"}.
              </p>
            )}
            <GlossaryTermArticle term={previewTerm} related={liveRelated} preview />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish this term?"
        description={
          <>
            <strong>{saved.term}</strong> leaves the site and its page stops working. Nothing is deleted.{usedByLine}
          </>
        }
        confirmLabel="Unpublish"
        isPending={unpublishMutation.isPending}
        onConfirm={runUnpublish}
      />

      <ConsoleConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this term?"
        description={
          <>
            <strong>{saved.term}</strong> will be removed permanently. This cannot be undone.{usedByLine}
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!values.id) return;
          deleteMutation.mutate(values.id, { onSuccess: () => navigate(glossaryMeta.ADMIN_PATH) });
        }}
      />
    </>
  );
};

export default AdminGlossaryEditorPage;
