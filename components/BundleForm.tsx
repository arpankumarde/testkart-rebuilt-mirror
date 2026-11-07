import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';
import { TeacherFlowTop } from './TeacherFlowTop';
import { TeacherFoldedPanel } from './TeacherFoldedPanel';
import type { TeacherFlowStep } from './TeacherFlowSteps';
import { useTeacherCoursesQuery } from '../helpers/useTeacherCoursesQuery';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { usePublishedTeacherProductsQuery } from '../helpers/useTeacherProductsQuery';
import { computeBundlePricing, formatInr } from '../helpers/bundlePricing';
import { bundleDescriptionToHtml, normalizeBundleDescription } from '../helpers/bundleDescription';
import { useUnsavedChangesGuard } from '../helpers/useUnsavedChangesGuard';
import type { BundleDetailItem } from '../endpoints/teacher/bundles/details_GET.schema';
import { AlertTriangle, BookOpen, Check, Lock, Search, Send } from 'lucide-react';
import { ThumbnailUploader } from './ThumbnailUploader';
import { VideoUploader } from './VideoUploader';
import { AIRewriteButton } from './AIRewriteButton';
import { noEmoji } from '../helpers/emojiText';
import styles from './BundleForm.module.css';

const formSchema = z.object({
  title: noEmoji(z.string().min(3, "Title must be at least 3 characters long.")),
  description: z.string().optional(),
  // Uploaders clear a file with "" or null; submit turns both into null.
  thumbnailUrl: z.string().url().or(z.literal('')).optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  introVideoUrl: z.string().optional().nullable(),
  introVideoFileId: z.string().optional().nullable(),
  courseIds: z.array(z.number()).optional().default([]),
  testIds: z.array(z.number()).optional().default([]),
  digitalProductIds: z.array(z.number()).optional().default([]),
  price: z.number().min(0, "Price cannot be negative."),
});

export type BundleFormValues = z.infer<typeof formSchema>;

export interface BundleFormProps {
  initialValues?: Partial<BundleFormValues>;
  onSubmit: (values: BundleFormValues) => void;
  isSubmitting: boolean;
  cancelTo: string;
  submitText: string;
  // A published bundle's items cannot change on the server, so they are locked here too.
  isPublished?: boolean;
  // The bundle's current items from the details endpoint, so items that are
  // unpublished or missing from the pickers still show and still count.
  selectedItems?: BundleDetailItem[];
  // Teacher pages: the step track, items first, extras folded, and a Publish
  // button beside save. The admin editor leaves this off and keeps the plain form.
  guided?: boolean;
  // Guided only: shown between the step track and the form (AI fill, rejection note).
  intro?: React.ReactNode;
  // Guided only: publishes after saving. hasChanges says whether a save is needed first.
  onPublish?: (values: BundleFormValues, hasChanges: boolean) => void;
  isPublishing?: boolean;
  // Bump after a successful save so the form treats the saved values as clean.
  savedAt?: number;
}

type ItemType = BundleDetailItem['itemType'];
type ItemKey = 'courseIds' | 'testIds' | 'digitalProductIds';
type ItemOption = { id: number; title: string; price: number; isPublished: boolean };
type KindFilter = 'all' | ItemType;

const KINDS: { type: ItemType; key: ItemKey; label: string; tag: string }[] = [
  { type: 'test', key: 'testIds', label: 'Test series', tag: 'Test series' },
  { type: 'course', key: 'courseIds', label: 'Courses', tag: 'Course' },
  { type: 'digital_product', key: 'digitalProductIds', label: 'Notes and PDFs', tag: 'Notes' },
];

const snapshot = (v: BundleFormValues) =>
  JSON.stringify([
    v.title,
    normalizeBundleDescription(v.description),
    v.thumbnailUrl || null,
    v.introVideoUrl || null,
    [...v.courseIds].sort(),
    [...v.testIds].sort(),
    [...v.digitalProductIds].sort(),
    v.price,
  ]);

/* The bundle step track: what is in it, its name and price, then going live. */
export const bundleFlowSteps = ({
  itemsDone,
  detailsDone,
  published,
  onSelect,
}: {
  itemsDone: boolean;
  detailsDone: boolean;
  published: boolean;
  onSelect?: (step: 'items' | 'details' | 'publish') => void;
}): TeacherFlowStep[] => {
  const done = { items: itemsDone, details: detailsDone, publish: published };
  const order = ['items', 'details', 'publish'] as const;
  const current = order.find((key) => !done[key]);
  const meta = {
    items: { label: 'Items', hint: 'Pick 2 or more', tone: 'mint' as const },
    details: { label: 'Name and price', hint: 'What students see', tone: 'lavender' as const },
    publish: { label: 'Publish', hint: 'Goes live at once', tone: 'peach' as const },
  };
  return order.map((key) => ({
    key,
    ...meta[key],
    state: done[key] ? 'done' : key === current ? 'current' : 'todo',
    onSelect: onSelect ? () => onSelect(key) : undefined,
  }));
};

export const BundleForm: React.FC<BundleFormProps> = ({
  initialValues,
  onSubmit,
  isSubmitting,
  cancelTo,
  submitText,
  isPublished = false,
  selectedItems = [],
  guided = false,
  intro,
  onPublish,
  isPublishing = false,
  savedAt,
}) => {
  const { data: courses, isLoading: isLoadingCourses } = useTeacherCoursesQuery();
  const { data: tests, isLoading: isLoadingTests } = useTeacherTestsQuery();
  const { data: products, isLoading: isLoadingProducts } = usePublishedTeacherProductsQuery();
  const priceInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [isCoverUploading, setCoverUploading] = useState(false);
  const [isVideoUploading, setVideoUploading] = useState(false);
  const isUploading = isCoverUploading || isVideoUploading;
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      title: initialValues?.title || '',
      description: bundleDescriptionToHtml(initialValues?.description),
      thumbnailUrl: initialValues?.thumbnailUrl || null,
      thumbnailFileId: initialValues?.thumbnailFileId || null,
      introVideoUrl: initialValues?.introVideoUrl || null,
      introVideoFileId: initialValues?.introVideoFileId || null,
      courseIds: initialValues?.courseIds || [],
      testIds: initialValues?.testIds || [],
      digitalProductIds: initialValues?.digitalProductIds || [],
      price: initialValues?.price || 0,
    },
  });

  const [baseline, setBaseline] = useState(() => snapshot(form.values));
  const lastSubmittedRef = useRef<BundleFormValues | null>(null);
  useEffect(() => {
    if (savedAt && lastSubmittedRef.current) setBaseline(snapshot(lastSubmittedRef.current));
  }, [savedAt]);
  const isDirty = snapshot(form.values) !== baseline;
  const isBusy = isSubmitting || isPublishing;
  const guard = useUnsavedChangesGuard(isDirty && !isBusy);

  const optionsByType = useMemo(() => {
    const fromDetails = new Map(selectedItems.map((item) => [`${item.itemType}:${item.id}`, item]));
    const build = (type: ItemType, listed: ItemOption[], selectedIds: number[]) => {
      const options = new Map<number, ItemOption>();
      // Drafts may hold items that are not live yet; publishing waits for them.
      for (const item of listed) {
        options.set(item.id, item);
      }
      for (const id of selectedIds) {
        const detail = fromDetails.get(`${type}:${id}`);
        if (!options.has(id) && detail) options.set(id, detail);
      }
      const all = Array.from(options.values());
      return isPublished ? all.filter((item) => selectedIds.includes(item.id)) : all;
    };
    return {
      course: build(
        'course',
        (courses ?? []).map((c) => ({ id: c.id, title: c.title, price: c.price, isPublished: c.status === 'published' })),
        form.values.courseIds
      ),
      test: build(
        'test',
        (tests ?? []).map((t) => ({ id: t.id, title: t.title, price: t.price, isPublished: !!t.isPublished })),
        form.values.testIds
      ),
      digital_product: build(
        'digital_product',
        (products ?? []).map((p) => ({ id: p.id, title: p.title, price: p.price, isPublished: p.status === 'published' })),
        form.values.digitalProductIds
      ),
    };
  }, [courses, tests, products, selectedItems, isPublished, form.values.courseIds, form.values.testIds, form.values.digitalProductIds]);

  const selectedOptions = useMemo(() => {
    const pick = (options: ItemOption[], ids: number[]) => options.filter((o) => ids.includes(o.id));
    return [
      ...pick(optionsByType.course, form.values.courseIds),
      ...pick(optionsByType.test, form.values.testIds),
      ...pick(optionsByType.digital_product, form.values.digitalProductIds),
    ];
  }, [optionsByType, form.values.courseIds, form.values.testIds, form.values.digitalProductIds]);

  const totalItemsSelected = form.values.courseIds.length + form.values.testIds.length + form.values.digitalProductIds.length;
  const isLoadingItems = isLoadingCourses || isLoadingTests || isLoadingProducts;
  const pricing = computeBundlePricing(selectedOptions.map((o) => o.price), form.values.price);
  const showPriceError = !isLoadingItems && totalItemsSelected >= 2 && !!pricing.priceError;
  const bundleItemTitles = selectedOptions.map((o) => o.title);
  const notLiveCount = selectedOptions.filter((o) => !o.isPublished).length;
  const canPublish = !isLoadingItems && totalItemsSelected >= 2 && notLiveCount === 0 && !pricing.priceError;

  // The price is only ever what the teacher typed: changing items moves the
  // original price and discount, never the bundle price. reviewedOriginal is the
  // original price the teacher last priced against, so a different one means
  // the items changed since and the price is worth a second look.
  const [reviewedOriginal, setReviewedOriginal] = useState<number | null>(null);
  useEffect(() => {
    if (reviewedOriginal === null && !isLoadingItems) setReviewedOriginal(pricing.originalPrice);
  }, [reviewedOriginal, isLoadingItems, pricing.originalPrice]);
  const showPriceReview =
    !isLoadingItems &&
    reviewedOriginal !== null &&
    Math.abs(pricing.originalPrice - reviewedOriginal) >= 0.01 &&
    form.values.price > 0;

  const toggleItem = (key: ItemKey, id: number, isSelected: boolean) => {
    form.setValues((prev) => ({
      ...prev,
      [key]: isSelected ? [...prev[key], id] : prev[key].filter((existing) => existing !== id),
    }));
  };

  // Shared checks for both buttons; null means the submit must wait.
  const prepare = (values: BundleFormValues): BundleFormValues | null => {
    if (isLoadingItems || isUploading) return null;
    if (pricing.priceError && totalItemsSelected >= 2) {
      priceInputRef.current?.focus();
      return null;
    }
    const cleaned = {
      ...values,
      description: normalizeBundleDescription(values.description),
      thumbnailUrl: values.thumbnailUrl || null,
      thumbnailFileId: values.thumbnailUrl ? values.thumbnailFileId || null : null,
      introVideoUrl: values.introVideoUrl || null,
      introVideoFileId: values.introVideoUrl ? values.introVideoFileId || null : null,
    };
    lastSubmittedRef.current = values;
    return cleaned;
  };

  const handleFormSubmit = (values: BundleFormValues) => {
    const cleaned = prepare(values);
    if (cleaned) onSubmit(cleaned);
  };

  const handlePublishSubmit = (values: BundleFormValues) => {
    const cleaned = prepare(values);
    if (cleaned && onPublish) onPublish(cleaned, isDirty);
  };

  const renderPriceFeedback = () =>
    (showPriceError || showPriceReview) && (
      <div className={styles.priceFeedback}>
        {showPriceError && (
          <p className={styles.priceError} role="alert">{pricing.priceError}</p>
        )}
        {showPriceReview && (
          <div className={styles.priceNotice} role="status">
            <AlertTriangle size={14} className={styles.noticeIcon} aria-hidden="true" />
            <span className={styles.noticeText}>
              Items changed. Please review and update your bundle price. Original is now{' '}
              {formatInr(pricing.originalPrice)} (was {formatInr(reviewedOriginal ?? 0)}).{' '}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.keepPrice}
                onClick={() => setReviewedOriginal(pricing.originalPrice)}
              >
                Keep {formatInr(form.values.price)}
              </Button>
            </span>
          </div>
        )}
      </div>
    );

  const priceInput = (
    <Input
      ref={priceInputRef}
      type="number"
      min="0"
      placeholder="e.g., 2999"
      value={form.values.price}
      {...(showPriceError ? { 'aria-invalid': true } : {})}
      onChange={(e) => {
        const val = e.target.value ? parseFloat(e.target.value) : 0;
        form.setValues(prev => ({ ...prev, price: Number.isFinite(val) ? val : 0 }));
        setReviewedOriginal(pricing.originalPrice);
      }}
    />
  );

  const titleLabelRow = (label: string) => (
    <div className={styles.labelRow}>
      <FormLabel>{label}</FormLabel>
      <AIRewriteButton
        field="title"
        contentType="bundle"
        currentValue={form.values.title}
        context={{ bundleItemTitles, price: form.values.price }}
        onAccept={(suggestion) => form.setValues(prev => ({ ...prev, title: suggestion }))}
      />
    </div>
  );

  const descriptionField = (label: string) => (
    <FormItem name="description">
      <div className={styles.labelRow}>
        <FormLabel>{label}</FormLabel>
        <AIRewriteButton
          field="description"
          contentType="bundle"
          currentValue={form.values.description || ''}
          context={{ bundleItemTitles, price: form.values.price, title: form.values.title }}
          onAccept={(suggestion) => form.setValues(prev => ({ ...prev, description: suggestion }))}
        />
      </div>
      <FormControl>
        <RichTextEditor
          placeholder="Describe what students will get in this bundle."
          value={form.values.description || ''}
          onChange={(html) => form.setValues(prev => ({ ...prev, description: html }))}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );

  const coverField = (label: string) => (
    <FormItem name="thumbnailUrl">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <ThumbnailUploader
          value={form.values.thumbnailUrl}
          currentFileId={form.values.thumbnailFileId || undefined}
          folder="bundle-thumbnails"
          onChange={(url, fileId) =>
            form.setValues(prev => ({ ...prev, thumbnailUrl: url || null, thumbnailFileId: url ? fileId || null : null }))
          }
          onRemove={() => form.setValues(prev => ({ ...prev, thumbnailUrl: null, thumbnailFileId: null }))}
          onUploadingChange={setCoverUploading}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );

  const videoField = (label: string) => (
    <FormItem name="introVideoUrl">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <VideoUploader
          folder="bundle-videos"
          currentVideoUrl={form.values.introVideoUrl || undefined}
          currentVideoFileId={form.values.introVideoFileId || undefined}
          onSuccess={({ url, videoFileId }) =>
            form.setValues(prev => ({ ...prev, introVideoUrl: url || null, introVideoFileId: url ? videoFileId || null : null }))
          }
          onRemove={() => form.setValues(prev => ({ ...prev, introVideoUrl: null, introVideoFileId: null }))}
          onUploadingChange={setVideoUploading}
          label="Upload Intro Video"
          allowYouTube={true}
          maxSizeInMB={500}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );

  if (guided) {
    const scrollTo = (step: 'items' | 'details' | 'publish') => {
      const target = step === 'items' ? itemsRef.current : step === 'details' ? detailsRef.current : actionsRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const steps = bundleFlowSteps({
      itemsDone: totalItemsSelected >= 2,
      detailsDone: form.values.title.trim().length >= 3 && !(totalItemsSelected >= 2 && pricing.priceError),
      published: isPublished,
      onSelect: scrollTo,
    });

    const rows = KINDS.flatMap((kind) =>
      optionsByType[kind.type].map((item) => ({ kind, item, selected: form.values[kind.key].includes(item.id) }))
    );
    const query = search.trim().toLowerCase();
    const visibleRows = rows.filter(
      (row) =>
        (kindFilter === 'all' || row.kind.type === kindFilter) &&
        (query === '' || row.item.title.toLowerCase().includes(query))
    );
    const kindCounts = KINDS.map((kind) => ({ ...kind, count: optionsByType[kind.type].length })).filter(
      (kind) => kind.count > 0
    );
    const showFilters = !isPublished && kindCounts.length > 1;
    const showSearch = !isPublished && rows.length > 8;

    const readiness = isPublished
      ? 'This bundle is live. Saved changes show at once.'
      : isLoadingItems
        ? ''
        : totalItemsSelected < 2
          ? `Pick ${2 - totalItemsSelected} more ${2 - totalItemsSelected === 1 ? 'item' : 'items'} to publish. You can save a draft now.`
          : notLiveCount > 0
            ? `${notLiveCount} picked ${notLiveCount === 1 ? 'item is' : 'items are'} not live yet. Publish ${notLiveCount === 1 ? 'it' : 'them'} first, or save a draft for now.`
            : 'Ready to go live. Bundles go live at once, with no review.';

    const hasExtras = !!(
      initialValues?.thumbnailUrl ||
      initialValues?.introVideoUrl ||
      normalizeBundleDescription(initialValues?.description)
    );

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className={styles.guided}>
          <TeacherFlowTop back={() => guard.leave(cancelTo)} label="Bundle steps" steps={steps} />

          {intro}

          <section ref={itemsRef} className={styles.card} aria-labelledby="bundle-items-title">
            <div className={styles.cardHead}>
              <span className={`${styles.marker} ${styles.markerMint}`} aria-hidden="true" />
              <div className={styles.cardHeadText}>
                <h2 id="bundle-items-title" className={styles.cardTitle}>What is in the bundle</h2>
                <span className={styles.cardHint}>
                  {isPublished ? 'Items stay fixed while the bundle is live.' : 'Pick 2 or more of your test series, courses or notes.'}
                </span>
              </div>
            </div>

            {isPublished && (
              <div className={styles.lockedNote} role="note">
                <Lock size={16} aria-hidden="true" />
                <span>To change the items, unpublish the bundle from Bundles first.</span>
              </div>
            )}

            {(showFilters || showSearch) && (
              <div className={styles.pickerTools}>
                {showFilters && (
                  <div className={styles.filters} role="group" aria-label="Show">
                    {[{ type: 'all' as const, label: 'All', count: rows.length }, ...kindCounts].map((kind) => (
                      <button
                        key={kind.type}
                        type="button"
                        className={styles.filter}
                        aria-pressed={kindFilter === kind.type}
                        onClick={() => setKindFilter(kind.type)}
                      >
                        {kind.label} <span className={styles.filterCount}>{kind.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSearch && (
                  <div className={styles.search}>
                    <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search your items"
                      aria-label="Search your items"
                      className={styles.searchInput}
                    />
                  </div>
                )}
              </div>
            )}

            <FormItem name="testIds">
              <div className={styles.pickList}>
                {isLoadingItems ? (
                  <>
                    <Skeleton className={styles.courseSkeleton} />
                    <Skeleton className={styles.courseSkeleton} />
                    <Skeleton className={styles.courseSkeleton} />
                  </>
                ) : rows.length === 0 ? (
                  <div className={styles.emptyState}>
                    Nothing to add yet. Create a test series, course or notes first, then come back.
                  </div>
                ) : visibleRows.length === 0 ? (
                  <div className={styles.emptyState}>No items match.</div>
                ) : (
                  visibleRows.map(({ kind, item, selected }) => (
                    <label
                      key={`${kind.type}:${item.id}`}
                      className={`${styles.pick} ${isPublished ? styles.pickLocked : ''}`}
                      data-selected={selected}
                    >
                      <Checkbox
                        checked={selected}
                        disabled={isPublished}
                        onChange={(e) => toggleItem(kind.key, item.id, e.target.checked)}
                      />
                      <span className={styles.pickText}>
                        <span className={styles.pickTitle}>{item.title}</span>
                        <span className={styles.pickMeta}>
                          <span className={styles.kindTag} data-kind={kind.type}>{kind.tag}</span>
                          {!item.isPublished && <span className={styles.notLive}>Not live yet</span>}
                        </span>
                      </span>
                      <span className={styles.pickPrice}>{item.price > 0 ? formatInr(item.price) : 'Free'}</span>
                    </label>
                  ))
                )}
              </div>
              <FormMessage />
            </FormItem>

            {!isLoadingItems && rows.length > 0 && (
              <p className={styles.pickSummary} aria-live="polite">
                {totalItemsSelected === 0 ? (
                  'Nothing picked yet.'
                ) : (
                  <>
                    <Check size={14} aria-hidden="true" />
                    {totalItemsSelected} picked, worth {formatInr(pricing.originalPrice)} on their own
                  </>
                )}
              </p>
            )}
          </section>

          <section ref={detailsRef} className={styles.card} aria-labelledby="bundle-details-title">
            <div className={styles.cardHead}>
              <span className={`${styles.marker} ${styles.markerLavender}`} aria-hidden="true" />
              <div className={styles.cardHeadText}>
                <h2 id="bundle-details-title" className={styles.cardTitle}>Name and price</h2>
                <span className={styles.cardHint}>What students see on the bundle card.</span>
              </div>
            </div>

            <FormItem name="title">
              {titleLabelRow('Title')}
              <FormControl>
                <Input
                  placeholder="e.g., SSC CGL Complete Pack"
                  value={form.values.title}
                  onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.priceRow}>
              <FormItem name="price" className={styles.priceInputItem}>
                <FormLabel>Bundle price (₹)</FormLabel>
                <FormControl>{priceInput}</FormControl>
                <FormDescription>Enter 0 to make it free.</FormDescription>
                <FormMessage />
              </FormItem>
              <div className={styles.saving} aria-live="polite">
                <span className={styles.savingLabel}>Worth on their own</span>
                <span className={styles.savingValue}>{formatInr(pricing.originalPrice)}</span>
                {pricing.discountPercentage > 0 && (
                  <span className={styles.savingChip}>Students save {Math.round(pricing.discountPercentage)}%</span>
                )}
              </div>
            </div>
            {renderPriceFeedback()}
          </section>

          <TeacherFoldedPanel
            title="More details"
            hint="Description, cover image and intro video. Optional."
            defaultOpen={hasExtras}
          >
            {descriptionField('Description')}
            {coverField('Cover image')}
            {videoField('Intro video')}
          </TeacherFoldedPanel>

          <div ref={actionsRef} className={styles.guidedActions}>
            {readiness && <p className={styles.readiness} data-ready={canPublish || isPublished}>{readiness}</p>}
            <div className={styles.actionButtons}>
              {onPublish && !isPublished ? (
                <>
                  <Button type="submit" variant="outline" disabled={isBusy || isLoadingItems || isUploading}>
                    {isSubmitting && <Spinner />}
                    {isUploading ? 'Waiting for upload...' : submitText}
                  </Button>
                  <Button
                    type="button"
                    disabled={!canPublish || isBusy || isUploading}
                    onClick={(e) => form.handleSubmit(handlePublishSubmit)(e as unknown as React.FormEvent)}
                  >
                    {isPublishing ? <Spinner /> : <Send size={16} aria-hidden="true" />}
                    {isPublishing ? 'Publishing...' : 'Publish bundle'}
                  </Button>
                </>
              ) : (
                <Button type="submit" disabled={isBusy || isLoadingItems || isUploading}>
                  {isSubmitting && <Spinner />}
                  {isUploading ? 'Waiting for upload...' : submitText}
                </Button>
              )}
            </div>
          </div>
        </form>
        {guard.dialog}
      </Form>
    );
  }

  const renderItemList = (label: string, type: ItemType, key: ItemKey, isLoading: boolean, emptyText: string) => {
    const options = optionsByType[type];
    if (isPublished && options.length === 0) return null;
    return (
      <FormItem name={key}>
        <FormLabel>{label}</FormLabel>
        <div className={styles.courseList}>
          {isLoading ? (
            <>
              <Skeleton className={styles.courseSkeleton} />
              <Skeleton className={styles.courseSkeleton} />
            </>
          ) : options.length === 0 ? (
            <div className={styles.emptyState}>{emptyText}</div>
          ) : (
            options.map((item) => (
              <label key={item.id} className={`${styles.courseItem} ${isPublished ? styles.courseItemLocked : ''}`}>
                <Checkbox
                  checked={form.values[key].includes(item.id)}
                  disabled={isPublished}
                  onChange={(e) => toggleItem(key, item.id, e.target.checked)}
                />
                {type === 'digital_product' && <BookOpen size={16} className={styles.itemIcon} />}
                <span className={styles.courseTitle}>
                  {item.title}
                  {!item.isPublished && <span className={styles.itemNote}>Not live yet</span>}
                </span>
                <span className={styles.coursePrice}>{formatInr(item.price)}</span>
              </label>
            ))
          )}
        </div>
        <FormMessage />
      </FormItem>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className={styles.form}>
        <FormItem name="title">
          {titleLabelRow('Bundle Title')}
          <FormControl>
            <Input
              placeholder="e.g., The Complete Web Development Bootcamp"
              value={form.values.title}
              onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        {descriptionField('Description (Optional)')}
        {coverField('Cover Image')}
        {videoField('Intro Video (Optional)')}

        <div className={styles.itemSelectionContainer}>
          <div className={styles.sectionHeader}>
            <h3>Include Items</h3>
            <p>
              {isPublished
                ? `${totalItemsSelected} items in this bundle.`
                : 'Pick what to sell together. You can save a draft any time; to publish, it needs 2 or more items, all live.'}
            </p>
          </div>

          {isPublished && (
            <div className={styles.lockedNote} role="note">
              <Lock size={16} aria-hidden="true" />
              <span>Items are locked while the bundle is published. To change them, unpublish it from Bundles first.</span>
            </div>
          )}

          {renderItemList('Courses', 'course', 'courseIds', isLoadingCourses, 'No courses yet')}
          {renderItemList('Test series', 'test', 'testIds', isLoadingTests, 'No test series yet')}
          {renderItemList('Notes and PDFs', 'digital_product', 'digitalProductIds', isLoadingProducts, 'No notes or PDFs yet')}

          {!isPublished && totalItemsSelected < 2 && (
            <div className={styles.validationMessage}>
              {totalItemsSelected} of 2 items picked. You can save the draft now and add more later.
            </div>
          )}
        </div>

        <div className={styles.priceGrid}>
          <div className={styles.priceInfo}>
            <span className={styles.priceLabel}>Original price</span>
            <span className={styles.priceValue}>{formatInr(pricing.originalPrice)}</span>
          </div>
          <FormItem name="price" className={styles.priceInputItem}>
            <FormLabel>Bundle Price (INR)</FormLabel>
            <FormControl>{priceInput}</FormControl>
            <FormDescription>0 means the bundle is free.</FormDescription>
            <FormMessage />
          </FormItem>
          {/* Under the price field, in a row of its own, so a message never changes
              the height of the three cells above it. */}
          {renderPriceFeedback()}
          <div className={`${styles.priceInfo} ${styles.discountInfo}`}>
            <span className={styles.priceLabel}>Discount</span>
            <span className={`${styles.priceValue} ${styles.discountValue}`}>
              {Math.round(pricing.discountPercentage)}% off
            </span>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="outline" onClick={() => guard.leave(cancelTo)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingItems || isUploading}>
            {isSubmitting && <Spinner />}
            {isUploading ? 'Waiting for upload...' : submitText}
          </Button>
        </div>
      </form>
      {guard.dialog}
    </Form>
  );
};
