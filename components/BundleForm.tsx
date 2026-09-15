import React, { useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';
import { useTeacherCoursesQuery } from '../helpers/useTeacherCoursesQuery';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { usePublishedTeacherProductsQuery } from '../helpers/useTeacherProductsQuery';
import { computeBundlePricing, formatInr } from '../helpers/bundlePricing';
import { useUnsavedChangesGuard } from '../helpers/useUnsavedChangesGuard';
import type { BundleDetailItem } from '../endpoints/teacher/bundles/details_GET.schema';
import { BookOpen, Lock } from 'lucide-react';
import { ThumbnailUploader } from './ThumbnailUploader';
import { VideoUploader } from './VideoUploader';
import { AIRewriteButton } from './AIRewriteButton';
import styles from './BundleForm.module.css';

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
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
}

type ItemType = BundleDetailItem['itemType'];
type ItemOption = { id: number; title: string; price: number; isPublished: boolean };

const snapshot = (v: BundleFormValues) =>
  JSON.stringify([
    v.title,
    v.description || '',
    v.thumbnailUrl || null,
    v.introVideoUrl || null,
    [...v.courseIds].sort(),
    [...v.testIds].sort(),
    [...v.digitalProductIds].sort(),
    v.price,
  ]);

export const BundleForm: React.FC<BundleFormProps> = ({
  initialValues,
  onSubmit,
  isSubmitting,
  cancelTo,
  submitText,
  isPublished = false,
  selectedItems = [],
}) => {
  const { data: courses, isLoading: isLoadingCourses } = useTeacherCoursesQuery();
  const { data: tests, isLoading: isLoadingTests } = useTeacherTestsQuery();
  const { data: products, isLoading: isLoadingProducts } = usePublishedTeacherProductsQuery();
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [isCoverUploading, setCoverUploading] = useState(false);
  const [isVideoUploading, setVideoUploading] = useState(false);
  const isUploading = isCoverUploading || isVideoUploading;

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      title: initialValues?.title || '',
      description: initialValues?.description || '',
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

  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = snapshot(form.values);
  const isDirty = snapshot(form.values) !== baselineRef.current;
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting);

  const optionsByType = useMemo(() => {
    const fromDetails = new Map(selectedItems.map((item) => [`${item.itemType}:${item.id}`, item]));
    const build = (type: ItemType, listed: ItemOption[], selectedIds: number[]) => {
      const options = new Map<number, ItemOption>();
      for (const item of listed) {
        if (item.isPublished || selectedIds.includes(item.id)) options.set(item.id, item);
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

  const toggleItem = (key: 'courseIds' | 'testIds' | 'digitalProductIds', id: number, isSelected: boolean) => {
    form.setValues((prev) => ({
      ...prev,
      [key]: isSelected ? [...prev[key], id] : prev[key].filter((existing) => existing !== id),
    }));
  };

  const handleFormSubmit = (values: BundleFormValues) => {
    if (totalItemsSelected < 2 || isLoadingItems || isUploading) return;
    if (pricing.priceError) {
      priceInputRef.current?.focus();
      return;
    }
    onSubmit({
      ...values,
      thumbnailUrl: values.thumbnailUrl || null,
      thumbnailFileId: values.thumbnailUrl ? values.thumbnailFileId || null : null,
      introVideoUrl: values.introVideoUrl || null,
      introVideoFileId: values.introVideoUrl ? values.introVideoFileId || null : null,
    });
  };

  const renderItemList = (
    label: string,
    type: ItemType,
    key: 'courseIds' | 'testIds' | 'digitalProductIds',
    isLoading: boolean,
    emptyText: string
  ) => {
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
                  {!item.isPublished && <span className={styles.itemNote}>Not published</span>}
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
          <div className={styles.labelRow}>
            <FormLabel>Bundle Title</FormLabel>
            <AIRewriteButton
              field="title"
              contentType="bundle"
              currentValue={form.values.title}
              context={{ bundleItemTitles, price: form.values.price }}
              onAccept={(suggestion) => form.setValues(prev => ({ ...prev, title: suggestion }))}
            />
          </div>
          <FormControl>
            <Input
              placeholder="e.g., The Complete Web Development Bootcamp"
              value={form.values.title}
              onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="description">
          <div className={styles.labelRow}>
            <FormLabel>Description (Optional)</FormLabel>
            <AIRewriteButton
              field="description"
              contentType="bundle"
              currentValue={form.values.description || ''}
              context={{ bundleItemTitles, price: form.values.price, title: form.values.title }}
              onAccept={(suggestion) => form.setValues(prev => ({ ...prev, description: suggestion }))}
            />
          </div>
          <FormControl>
            <Textarea
              placeholder="Describe what students will get in this bundle."
              rows={4}
              value={form.values.description || ''}
              onChange={(e) => form.setValues(prev => ({ ...prev, description: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="thumbnailUrl">
          <FormLabel>Cover Image</FormLabel>
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

        <FormItem name="introVideoUrl">
          <FormLabel>Intro Video (Optional)</FormLabel>
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

        <div className={styles.itemSelectionContainer}>
          <div className={styles.sectionHeader}>
            <h3>Include Items</h3>
            <p>
              {isPublished
                ? `${totalItemsSelected} items in this bundle.`
                : 'Select at least 2 items to form your bundle.'}
            </p>
          </div>

          {isPublished && (
            <div className={styles.lockedNote} role="note">
              <Lock size={16} aria-hidden="true" />
              <span>Items are locked while the bundle is published. To change them, unpublish it from Bundles first.</span>
            </div>
          )}

          {renderItemList('Select Courses', 'course', 'courseIds', isLoadingCourses, 'No published courses available')}
          {renderItemList('Select Tests', 'test', 'testIds', isLoadingTests, 'No published tests available')}
          {renderItemList('Select Notes', 'digital_product', 'digitalProductIds', isLoadingProducts, 'No published notes available')}

          {totalItemsSelected < 2 && (
            <div className={styles.validationMessage}>
              Please select at least 2 items (courses, tests, or notes) to create a bundle.
              Currently selected: {totalItemsSelected}
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
            <FormControl>
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
                }}
              />
            </FormControl>
            <FormMessage />
            {showPriceError && (
              <p className={styles.priceError} role="alert">{pricing.priceError}</p>
            )}
          </FormItem>
          <div className={styles.priceInfo}>
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
          <Button type="submit" disabled={isSubmitting || totalItemsSelected < 2 || isLoadingItems || isUploading}>
            {isSubmitting && <Spinner />}
            {isUploading ? 'Waiting for upload...' : submitText}
          </Button>
        </div>
      </form>
      {guard.dialog}
    </Form>
  );
};
