import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Sparkles,
  MessageCircleQuestion,
  Plus,
  X,
  ExternalLink,
  CheckCircle2,
  CircleDot,
  FileEdit,
  FileText,
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  UserCheck,
  TrendingUp,
  GraduationCap,
  BookOpen,
  Package,
  File,
  ChevronDown,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Spinner } from "../components/Spinner";
import { RichTextEditor } from "../components/RichTextEditor";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/Sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ExamContentExportButton } from "../components/ExamContentExportButton";
import { ExamCustomPageDialog } from "../components/ExamCustomPageDialog";
import { useAdminLayout } from "../helpers/useAdminLayout";
import { adminFormat } from "../helpers/adminFormat";
import { useListUrlParams } from "../helpers/useListUrlParams";
import {
  useAdminExamContentQuery,
  useUpsertExamContentMutation,
  useGenerateExamContentMutation,
  usePublishExamContentMutation,
  useUnpublishExamContentMutation,
  useExamContentReadyForReviewMutation,
  useDeleteExamCustomPageMutation,
} from "../helpers/useAdminExamContent";
import {
  ADMIN_EXAM_SECTION_META,
  customPageSlug,
  customSectionMeta,
  isAdminExamSectionType,
  isCustomPageType,
  type AdminExamSectionType,
  type ExamContentPageTypeMeta,
  type ExamSectionPageType,
  type FaqItem,
} from "../helpers/examContentTypes";
import type { ExamContentPageItem } from "../endpoints/admin/exam-content/list_GET.schema";
import styles from "./admin.exam-content.$examId.module.css";

type FormState = {
  title: string;
  seoTitle: string;
  seoDescription: string;
  description: string;
  content: string;
  faqItems: FaqItem[];
};

const emptyForm: FormState = { title: "", seoTitle: "", seoDescription: "", description: "", content: "", faqItems: [] };

const SECTION_PARAM = "section";

// Sidebar groups, in the order the sections are listed.
const BUILT_IN_GROUPS: { title: string; types: AdminExamSectionType[] }[] = [
  { title: "Exam information", types: ["overview", "syllabus", "exam_pattern", "eligibility", "cutoff"] },
  { title: "Listing pages", types: ["mock_tests", "courses", "study_notes", "bundles"] },
];
const CUSTOM_GROUP_TITLE = "Custom pages";

const SECTION_ICONS: Record<AdminExamSectionType, LucideIcon> = {
  overview: LayoutDashboard,
  syllabus: ListChecks,
  exam_pattern: ClipboardList,
  eligibility: UserCheck,
  cutoff: TrendingUp,
  mock_tests: FileText,
  courses: GraduationCap,
  study_notes: BookOpen,
  bundles: Package,
};

const iconFor = (type: ExamSectionPageType): LucideIcon =>
  isCustomPageType(type) ? File : SECTION_ICONS[type];

function toFormState(page: ExamContentPageItem): FormState {
  return {
    title: page.title,
    seoTitle: page.seoTitle || "",
    seoDescription: page.seoDescription || "",
    description: page.description || "",
    content: page.content || "",
    faqItems: page.faqItems || [],
  };
}

function pageSignature(page: ExamContentPageItem): string {
  return `${page.id ?? "new"}-${page.updatedAt ? new Date(page.updatedAt).getTime() : 0}`;
}

export default function AdminExamContentPage() {
  const { examId: examIdParam } = useParams<{ examId: string }>();
  const examId = examIdParam ? parseInt(examIdParam, 10) : null;

  const { setHeaderHidden } = useAdminLayout();
  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  const { data, isFetching, error } = useAdminExamContentQuery(examId);
  const upsertMutation = useUpsertExamContentMutation();
  const generateMutation = useGenerateExamContentMutation();
  const publishMutation = usePublishExamContentMutation();
  const unpublishMutation = useUnpublishExamContentMutation();
  const readyForReviewMutation = useExamContentReadyForReviewMutation();
  const deleteCustomPageMutation = useDeleteExamCustomPageMutation();

  // The open section lives in the URL, so a dashboard link can land on it. A
  // custom page only counts once it's in this exam's list; anything else
  // falls back to Overview.
  const { searchParams, write: writeUrlParams } = useListUrlParams();
  // Defaults to empty: a list cached from before custom pages existed has no
  // customPages field until it refetches.
  const customPages = data?.customPages ?? [];
  const sectionParam = searchParams.get(SECTION_PARAM);
  const activeType: ExamSectionPageType =
    sectionParam !== null &&
    (isAdminExamSectionType(sectionParam) ||
      (isCustomPageType(sectionParam) && customPages.some((p) => p.pageType === sectionParam)))
      ? sectionParam
      : "overview";

  const workspaceRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [addTabOpen, setAddTabOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setActiveType = (type: ExamSectionPageType) => {
    writeUrlParams({ [SECTION_PARAM]: type === "overview" ? null : type });
    setNavOpen(false);
    // Coming from deep inside a long editor, start the new section at its top.
    const workspace = workspaceRef.current;
    if (workspace && workspace.getBoundingClientRect().top < 0) {
      workspace.scrollIntoView({ block: "start" });
    }
  };
  const [formByType, setFormByType] = useState<Record<string, FormState>>({});
  const [savedSnapshotByType, setSavedSnapshotByType] = useState<Record<string, FormState>>({});
  const signatureRef = useRef<Record<string, string>>({});
  const [savingForPublish, setSavingForPublish] = useState(false);

  // Re-sync local editable form state from the server whenever a page's
  // underlying row actually changes (first load, after Save, after
  // Generate, after Publish/Unpublish) - but not on every render, so typing
  // in the editor isn't fighting a resync.
  useEffect(() => {
    if (!data) return;
    setFormByType((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const page of data.pages) {
        const sig = pageSignature(page);
        if (signatureRef.current[page.pageType] !== sig) {
          signatureRef.current[page.pageType] = sig;
          const state = toFormState(page);
          next[page.pageType] = state;
          setSavedSnapshotByType((s) => ({ ...s, [page.pageType]: state }));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  if (!examId) {
    return (
      <div className={styles.page}>
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title="No exam selected"
          description="Go back and pick an exam to manage its content."
        >
          <Button variant="outline" asChild>
            <Link to="/admin/exam-content">
              <ArrowLeft size={16} /> Back to exam content
            </Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const backLink = (
    <Button variant="ghost" size="sm" asChild className={styles.backLink}>
      <Link to="/admin/exam-content">
        <ArrowLeft size={14} /> Exam content
      </Link>
    </Button>
  );

  if (isFetching && !data) {
    return (
      <div className={styles.page}>
        {backLink}
        <Skeleton className={styles.skeletonTitle} />
        <div className={styles.workspace}>
          <Skeleton className={styles.skeletonSidebar} />
          <div className={styles.content}>
            <Skeleton className={styles.skeletonHeading} />
            <Skeleton className={styles.skeletonStatus} />
            <Skeleton className={styles.skeletonEditor} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        {backLink}
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load this exam's content"
          description={error instanceof Error ? error.message : undefined}
        />
      </div>
    );
  }

  const metaFor = (type: ExamSectionPageType): ExamContentPageTypeMeta => {
    if (isCustomPageType(type)) {
      const customPage = customPages.find((p) => p.pageType === type);
      return customSectionMeta(type, customPage?.label ?? customPageSlug(type));
    }
    return ADMIN_EXAM_SECTION_META[type];
  };

  const currentPage = data.pages.find((p) => p.pageType === activeType)!;
  const currentForm = formByType[activeType] ?? emptyForm;
  const savedSnapshot = savedSnapshotByType[activeType] ?? emptyForm;
  const isDirty = JSON.stringify(currentForm) !== JSON.stringify(savedSnapshot);
  const isTypeDirty = (type: string) =>
    formByType[type] !== undefined &&
    JSON.stringify(formByType[type]) !== JSON.stringify(savedSnapshotByType[type] ?? emptyForm);

  const examLabel = data.exam.fullName || data.exam.examName;
  const meta = metaFor(activeType);
  const isOverview = activeType === "overview";
  const activeCustomPage = isCustomPageType(activeType)
    ? customPages.find((p) => p.pageType === activeType)
    : undefined;
  const ActiveIcon = iconFor(activeType);

  const navGroups: { title: string; types: ExamSectionPageType[] }[] = [
    ...BUILT_IN_GROUPS,
    { title: CUSTOM_GROUP_TITLE, types: customPages.map((p) => p.pageType) },
  ];
  const activeGroupTitle =
    navGroups.find((group) => group.types.includes(activeType))?.title ?? BUILT_IN_GROUPS[0].title;
  const publishedTotal = data.pages.filter((p) => p.status === "published").length;

  // Saving is allowed as soon as there's *something* worth keeping, and
  // publishing uses the same bar - mirrors the backend's rule exactly.
  // Neither content nor FAQs is mandatory on its own; a section just needs
  // one of the two to be worth putting live.
  const hasSavableDraft = currentForm.content.trim().length > 0 || currentForm.faqItems.length > 0;
  const hasPublishableContent = currentForm.content.trim().length > 0 || currentForm.faqItems.length > 0;

  const hasPublishedSnapshot = currentPage.status === "published";
  const liveStatus = hasPublishedSnapshot ? "published" : "draft";
  const hasSavedContent =
    (currentPage.content ?? "").trim().length > 0 || (currentPage.faqItems ?? []).length > 0;
  // While a review change is saving, show the state that was picked, not the old one.
  const pendingReview = readyForReviewMutation.isPending ? readyForReviewMutation.variables : undefined;
  const isReadyForReview =
    pendingReview?.pageType === activeType
      ? pendingReview.readyForReview
      : currentPage.readyForReviewAt !== null;
  const draftDiffersFromPublished =
    hasPublishedSnapshot &&
    (JSON.stringify(currentPage.publishedFaqItems || []) !== JSON.stringify(currentForm.faqItems) ||
      (currentPage.publishedContent || "") !== currentForm.content ||
      (currentPage.publishedTitle || "") !== currentForm.title);

  const updateForm = (patch: Partial<FormState>) => {
    setFormByType((prev) => ({ ...prev, [activeType]: { ...(prev[activeType] ?? emptyForm), ...patch } }));
  };

  const defaultTitleFor = (type: ExamSectionPageType) => `${examLabel} ${metaFor(type).titleSuffix}`;

  const upsertInput = () => ({
    examId,
    pageType: activeType,
    title: currentForm.title || defaultTitleFor(activeType),
    seoTitle: currentForm.seoTitle || null,
    seoDescription: currentForm.seoDescription || null,
    description: currentForm.description || null,
    content: currentForm.content,
    faqItems: currentForm.faqItems,
  });

  const handleSave = () => {
    upsertMutation.mutate(upsertInput());
  };

  const handleGenerateContent = () => {
    generateMutation.mutate({ examId, pageType: activeType, target: "content" });
  };

  const handleGenerateFaqs = () => {
    generateMutation.mutate({ examId, pageType: activeType, target: "faqs" });
  };

  // Publish copies the saved draft live, so unsaved edits are saved first.
  const handlePublish = async () => {
    const pageType = activeType;
    if (isDirty) {
      setSavingForPublish(true);
      try {
        await upsertMutation.mutateAsync(upsertInput());
      } catch {
        return;
      } finally {
        setSavingForPublish(false);
      }
    }
    publishMutation.mutate({ examId, pageType });
  };
  const isPublishing = publishMutation.isPending || savingForPublish;

  const handleUnpublish = () => {
    unpublishMutation.mutate({ examId, pageType: activeType });
  };

  const handleStatusChange = (value: string) => {
    readyForReviewMutation.mutate({
      examId,
      pageType: activeType,
      readyForReview: value === "ready_for_review",
    });
  };

  const handleDeleteCustomPage = async () => {
    if (!activeCustomPage) return;
    try {
      await deleteCustomPageMutation.mutateAsync({ examId, slug: activeCustomPage.slug });
      setDeleteOpen(false);
      setActiveType("overview");
    } catch {
      // Toast already shown; keep the dialog open to retry.
    }
  };

  const publicUrl = meta.slug ? `/exams/${data.exam.examSlug}/${meta.slug}` : null;

  // Shared by the desktop sidebar and the mobile drawer.
  const renderNav = () => (
    <div className={styles.navBody}>
      <div className={styles.navHeader}>
        <span className={styles.navTitle}>Sections</span>
        <span className={styles.navProgress}>
          {publishedTotal} of {data.pages.length} live
        </span>
      </div>

      <nav className={styles.navScroll} aria-label="Exam sections">
        {navGroups.map((group) => (
          <div key={group.title} className={styles.navGroup}>
            <p className={styles.navGroupTitle}>{group.title}</p>
            {group.types.length === 0 ? (
              <p className={styles.navEmpty}>Tabs you add appear here.</p>
            ) : (
              <ul className={styles.navList}>
                {group.types.map((type) => {
                  const page = data.pages.find((p) => p.pageType === type)!;
                  const Icon = iconFor(type);
                  const isActive = type === activeType;
                  const dirty = isTypeDirty(type);
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setActiveType(type)}
                      >
                        <Icon size={16} className={styles.navItemIcon} aria-hidden="true" />
                        <span className={styles.navItemLabel}>{metaFor(type).label}</span>
                        <span className={styles.navItemMarks}>
                          {dirty && (
                            <span className={styles.unsavedDot} role="img" aria-label="Unsaved edits" title="Unsaved edits" />
                          )}
                          {page.readyForReviewAt && (
                            <CircleDot size={14} className={styles.reviewMark} aria-label="Ready for review" />
                          )}
                          {page.status === "published" && (
                            <CheckCircle2 size={14} className={styles.publishedTick} aria-label="Published" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <div className={styles.navFooter}>
        <Button
          type="button"
          variant="outline"
          className={styles.addTabButton}
          onClick={() => {
            setNavOpen(false);
            setAddTabOpen(true);
          }}
        >
          <Plus size={16} /> Add New Tab
        </Button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Content: ${examLabel} | Testkart Admin`}</title>
      </Helmet>

      {backLink}

      <ConsolePageHeader title={examLabel}>
        <Badge variant="outline">{data.exam.categoryName}</Badge>
      </ConsolePageHeader>

      <div className={styles.workspace} ref={workspaceRef}>
        <aside className={styles.sidebar}>{renderNav()}</aside>

        <div className={styles.content}>
          {/* Below the sidebar breakpoint the section list moves into a drawer. */}
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <button type="button" className={styles.mobileNavTrigger}>
                <ActiveIcon size={16} className={styles.mobileNavIcon} aria-hidden="true" />
                <span className={styles.mobileNavText}>
                  <span className={styles.mobileNavEyebrow}>Section</span>
                  <span className={styles.mobileNavLabel}>{meta.label}</span>
                </span>
                <ChevronDown size={16} className={styles.mobileNavChevron} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className={styles.navSheet}>
              <SheetHeader className={styles.srOnly}>
                <SheetTitle>Exam sections</SheetTitle>
                <SheetDescription>Pick a section of this exam to edit.</SheetDescription>
              </SheetHeader>
              {renderNav()}
            </SheetContent>
          </Sheet>

          <div className={styles.contentHeader}>
            <div className={styles.contentHeading}>
              <span className={styles.contentIcon} aria-hidden="true">
                <ActiveIcon size={18} />
              </span>
              <div className={styles.contentTitles}>
                <span className={styles.contentEyebrow}>{activeGroupTitle}</span>
                <h2 className={styles.contentTitle}>{meta.label}</h2>
              </div>
            </div>
            {activeCustomPage && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} /> Delete tab
              </Button>
            )}
          </div>
          <p className={styles.contentNote}>
            Nothing goes live until you publish, and a section's own URL exists only once it is published.
          </p>

          <div key={activeType} className={styles.tabPanel}>
            <div className={styles.statusBar}>
              <div className={styles.statusLeft}>
                <Select
                  value={isReadyForReview ? "ready_for_review" : liveStatus}
                  onValueChange={handleStatusChange}
                  disabled={readyForReviewMutation.isPending || currentPage.id === null}
                >
                  <SelectTrigger
                    className={styles.statusSelect}
                    aria-label="Section status"
                    title={currentPage.id === null ? "Save a draft before marking it ready for review" : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={liveStatus}>
                      <span
                        className={`${styles.statusDot} ${hasPublishedSnapshot ? styles.statusDotPublished : styles.statusDotDraft}`}
                      />
                      {hasPublishedSnapshot ? "Published" : "Draft"}
                    </SelectItem>
                    <SelectItem value="ready_for_review" disabled={!hasSavedContent}>
                      <span className={`${styles.statusDot} ${styles.statusDotReview}`} />
                      Ready for review
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isReadyForReview && hasPublishedSnapshot && <Badge variant="outline">Live</Badge>}
                {isReadyForReview && currentPage.readyForReviewAt && (
                  <span>
                    {currentPage.readyForReviewByAdminName
                      ? `Marked by ${currentPage.readyForReviewByAdminName}`
                      : "Marked"}{" "}
                    {adminFormat.relativeTime(currentPage.readyForReviewAt)}
                  </span>
                )}
                {currentForm && currentPage.source === "ai" && <Badge variant="outline">AI-drafted</Badge>}
                {isDirty && <span className={styles.dirtyNote}>Unsaved edits - Publish saves them first</span>}
                {!isDirty && draftDiffersFromPublished && (
                  <span className={styles.dirtyNote}>Saved draft differs from what's live</span>
                )}
                {currentPage.reviewedByAdminName && currentPage.status === "published" && (
                  <span>Reviewed by {currentPage.reviewedByAdminName}</span>
                )}
              </div>
              <div className={styles.statusRight}>
                <ExamContentExportButton
                  examLabel={examLabel}
                  sectionLabel={meta.label}
                  title={currentForm.title || defaultTitleFor(activeType)}
                  description={meta.hasDescription ? currentForm.description : ""}
                  content={meta.hasBodyContent ? currentForm.content : ""}
                  faqItems={currentForm.faqItems}
                  disabled={!hasSavableDraft}
                />
                {currentPage.status === "published" && publicUrl && (
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> View live
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className={styles.editorCard}>
              <p className={styles.sectionHint}>{meta.adminHint}</p>

              {!isOverview && (
                <>
                  <div className={styles.field}>
                    <label htmlFor="section-title" className={styles.fieldLabel}>
                      Page title
                    </label>
                    <Input
                      id="section-title"
                      value={currentForm.title}
                      placeholder={defaultTitleFor(activeType)}
                      onChange={(e) => updateForm({ title: e.target.value })}
                    />
                  </div>

                  {meta.hasDescription && (
                    <div className={styles.field}>
                      <label htmlFor="section-description" className={styles.fieldLabel}>
                        Description (optional)
                      </label>
                      <Textarea
                        id="section-description"
                        rows={2}
                        value={currentForm.description}
                        placeholder="Shown as a subtitle under the page heading - defaults to a generic line if left blank"
                        onChange={(e) => updateForm({ description: e.target.value })}
                      />
                    </div>
                  )}

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label htmlFor="section-seo-title" className={styles.fieldLabel}>
                        SEO title (optional)
                      </label>
                      <Input
                        id="section-seo-title"
                        value={currentForm.seoTitle}
                        placeholder="Defaults to the page title"
                        onChange={(e) => updateForm({ seoTitle: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="section-seo-description" className={styles.fieldLabel}>
                        SEO description (optional)
                      </label>
                      <Textarea
                        id="section-seo-description"
                        rows={1}
                        value={currentForm.seoDescription}
                        placeholder="Shown in search results"
                        onChange={(e) => updateForm({ seoDescription: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {meta.hasBodyContent && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Content</span>
                  {isOverview && (
                    <p className={styles.fieldHint}>Shown below the mock test listings on this exam's own page.</p>
                  )}
                  {meta.hasDescription && (
                    <p className={styles.fieldHint}>
                      Shown below the product grid on this listing page, above the footer.
                    </p>
                  )}
                  <RichTextEditor
                    value={currentForm.content}
                    onChange={(html) => updateForm({ content: html })}
                    placeholder="Write or generate the page content..."
                  />
                </div>
              )}

              <div className={styles.field}>
                <span className={styles.fieldLabel}>FAQs (optional)</span>
                <p className={styles.fieldHint}>
                  {isOverview
                    ? "Shown below the Overview content on this exam's own page, in addition to the Testkart FAQ rich result."
                    : "Shown below the main content on this section's page, in addition to the Testkart FAQ rich result."}
                </p>
                <div className={styles.faqList}>
                  {currentForm.faqItems.map((item, index) => (
                    <div key={index} className={styles.faqItem}>
                      <div className={styles.faqFields}>
                        <div className={styles.field}>
                          <label htmlFor={`faq-${index}-question`} className={styles.fieldLabel}>
                            Question
                          </label>
                          <Input
                            id={`faq-${index}-question`}
                            value={item.question}
                            onChange={(e) => {
                              const next = [...currentForm.faqItems];
                              next[index] = { ...next[index], question: e.target.value };
                              updateForm({ faqItems: next });
                            }}
                          />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor={`faq-${index}-answer`} className={styles.fieldLabel}>
                            Answer
                          </label>
                          <Textarea
                            id={`faq-${index}-answer`}
                            rows={2}
                            value={item.answer}
                            onChange={(e) => {
                              const next = [...currentForm.faqItems];
                              next[index] = { ...next[index], answer: e.target.value };
                              updateForm({ faqItems: next });
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          const next = [...currentForm.faqItems];
                          next.splice(index, 1);
                          updateForm({ faqItems: next });
                        }}
                        aria-label="Remove question"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.addQuestion}
                    onClick={() => updateForm({ faqItems: [...currentForm.faqItems, { question: "", answer: "" }] })}
                  >
                    <Plus size={14} /> Add question
                  </Button>
                </div>
              </div>

              <div className={styles.actionsBar}>
                <div className={styles.actionsGroup}>
                  {meta.hasBodyContent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateContent}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? <Spinner size="sm" /> : <Sparkles size={16} />}
                      Generate content
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateFaqs}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? <Spinner size="sm" /> : <MessageCircleQuestion size={16} />}
                    Generate FAQs
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSave}
                    disabled={upsertMutation.isPending || !hasSavableDraft}
                  >
                    <FileEdit size={16} />
                    {upsertMutation.isPending ? "Saving..." : "Save draft"}
                  </Button>
                </div>
                <div className={styles.actionsGroup}>
                  {currentPage.status === "published" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUnpublish}
                      disabled={unpublishMutation.isPending}
                    >
                      {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={
                      isPublishing ||
                      upsertMutation.isPending ||
                      !hasPublishableContent ||
                      (currentPage.id === null && !isDirty)
                    }
                  >
                    {isPublishing
                      ? "Publishing..."
                      : currentPage.status === "published"
                        ? "Republish"
                        : "Publish"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExamCustomPageDialog
        open={addTabOpen}
        onOpenChange={setAddTabOpen}
        examId={examId}
        examSlug={data.exam.examSlug}
        existingSlugs={customPages.map((p) => p.slug)}
        onCreated={(pageType) => setActiveType(pageType)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className={styles.deleteDialog}>
          <DialogHeader>
            <DialogTitle>Delete "{activeCustomPage?.label}"?</DialogTitle>
            <DialogDescription>
              This removes the tab, its draft and its FAQs.
              {hasPublishedSnapshot && " The live page is taken off the site and its URL redirects to the exam page."}{" "}
              This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteCustomPage}
              disabled={deleteCustomPageMutation.isPending}
            >
              <Trash2 size={14} />
              {deleteCustomPageMutation.isPending ? "Deleting..." : "Delete tab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
