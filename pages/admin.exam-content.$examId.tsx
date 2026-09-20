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
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Spinner } from "../components/Spinner";
import { RichTextEditor } from "../components/RichTextEditor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ExamContentExportButton } from "../components/ExamContentExportButton";
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
} from "../helpers/useAdminExamContent";
import {
  ADMIN_EXAM_SECTION_TYPES,
  ADMIN_EXAM_SECTION_META,
  type AdminExamSectionType,
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

  // The open section lives in the URL, so a dashboard link can land on it.
  const { read: readUrlParam, write: writeUrlParams } = useListUrlParams();
  const activeType = readUrlParam(SECTION_PARAM, ADMIN_EXAM_SECTION_TYPES, "overview");
  const setActiveType = (type: AdminExamSectionType) =>
    writeUrlParams({ [SECTION_PARAM]: type === "overview" ? null : type });
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
        <Skeleton className={styles.skeletonTabs} />
        <Skeleton className={styles.skeletonStatus} />
        <Skeleton className={styles.skeletonEditor} />
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

  const currentPage = data.pages.find((p) => p.pageType === activeType)!;
  const currentForm = formByType[activeType] ?? emptyForm;
  const savedSnapshot = savedSnapshotByType[activeType] ?? emptyForm;
  const isDirty = JSON.stringify(currentForm) !== JSON.stringify(savedSnapshot);

  const examLabel = data.exam.fullName || data.exam.examName;
  const meta = ADMIN_EXAM_SECTION_META[activeType];
  const isOverview = activeType === "overview";

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

  const defaultTitleFor = (type: AdminExamSectionType) => `${examLabel} ${ADMIN_EXAM_SECTION_META[type].titleSuffix}`;

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

  const publicUrl = meta.slug ? `/exams/${data.exam.examSlug}/${meta.slug}` : null;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Content: ${examLabel} | Testkart Admin`}</title>
      </Helmet>

      {backLink}

      <ConsolePageHeader title={examLabel}>
        <Badge variant="outline">{data.exam.categoryName}</Badge>
      </ConsolePageHeader>

      <Tabs
        value={activeType}
        onValueChange={(v) => setActiveType(v as AdminExamSectionType)}
        className={styles.tabs}
      >
        <div className={styles.tabsHeader}>
          <TabsList className={styles.tabsList}>
            {ADMIN_EXAM_SECTION_TYPES.map((type) => {
              const page = data.pages.find((p) => p.pageType === type)!;
              return (
                <TabsTrigger key={type} value={type}>
                  {ADMIN_EXAM_SECTION_META[type].label}
                  {page.status === "published" && (
                    <CheckCircle2 size={13} className={styles.publishedTick} aria-label="Published" />
                  )}
                  {page.readyForReviewAt && (
                    <CircleDot size={13} className={styles.reviewMark} aria-label="Ready for review" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <p className={styles.tabsNote}>
            Nothing goes live until you publish, and a section's own URL exists only once it is published.
          </p>
        </div>

        {ADMIN_EXAM_SECTION_TYPES.map((type) => (
          <TabsContent key={type} value={type} className={styles.tabPanel}>
            {activeType === type && (
              <>
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
                    {currentForm && currentPage.source === "ai" && (
                      <Badge variant="outline">AI-drafted</Badge>
                    )}
                    {isDirty && (
                      <span className={styles.dirtyNote}>
                        Unsaved edits - Publish saves them first
                      </span>
                    )}
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
                      title={currentForm.title || defaultTitleFor(type)}
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
                  <p className={styles.sectionHint}>{ADMIN_EXAM_SECTION_META[type].adminHint}</p>

                  {!isOverview && (
                    <>
                      <div className={styles.field}>
                        <label htmlFor="section-title" className={styles.fieldLabel}>
                          Page title
                        </label>
                        <Input
                          id="section-title"
                          value={currentForm.title}
                          placeholder={defaultTitleFor(type)}
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
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
