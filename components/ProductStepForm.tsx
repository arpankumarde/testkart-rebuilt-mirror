import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useForm } from './Form';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Button } from './Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Checkbox } from './Checkbox';
import { Spinner } from './Spinner';
import { FileUploader } from './FileUploader';
import { ExamNamePicker } from './ExamNamePicker';
import { Skeleton } from './Skeleton';
import { useTeacherProductMutations } from '../helpers/useTeacherProductsQuery';
import { useTeacherProductDetailsQuery } from '../helpers/useTeacherProductDetailsQuery';
import { useTeacherProductAnalyzePdf } from '../helpers/useTeacherProductAnalyzePdf';
import { useUploadLimits } from '../helpers/useUploadLimits';
import { useUnsavedChangesGuard } from '../helpers/useUnsavedChangesGuard';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { parseErrorMessage } from '../helpers/parseErrorMessage';
import { DIGITAL_PRODUCT_CATEGORIES, isRealFileUrl, STUDY_NOTES_PDF_MAX_MB } from '../helpers/digitalProductRules';
import { checkStudyNotesPdf } from '../helpers/studyNotesPdfCheck';
import { schema as createSchema } from '../endpoints/teacher/products/create_POST.schema';
import { postTeacherProductsPdfPageCount, PdfRejectedError } from '../endpoints/teacher/products/pdf-page-count_POST.schema';
import { Plus, GripVertical, ArrowUp, ArrowDown, X, Eye, Sparkles, AlertTriangle, AlertCircle, CheckCircle, FileText, RefreshCw } from 'lucide-react';
import { AIRewriteButton } from './AIRewriteButton';

const LazyPdfViewer = React.lazy(() => import('./ContentReviewPdfViewer'));
import styles from './ProductStepForm.module.css';

interface ProductStepFormProps {
  productId?: number;
  aiInitialValues?: {
    title?: string;
    shortDescription?: string;
    description?: string;
    examName?: string;
    category?: string;
    language?: string;
    tags?: string[];
    suggestedPrice?: number;
  } | null;
}

const fileRowSchema = z.object({
  // Client-only row identity that async upload results are matched by. Never sent.
  clientKey: z.string().optional(),
  // The saved file row id, sent back so the server updates that row in place.
  id: z.number().int().positive().optional().nullable(),
  title: z.string(),
  // Empty until the row's PDF is uploaded. Rows without a real file are not saved.
  fileUrl: z.string(),
  fileId: z.string().optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  pageCount: z.number().int().min(0).optional().nullable(),
}).superRefine((file, ctx) => {
  if (isRealFileUrl(file.fileUrl) && !file.title.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['title'], message: 'File title is required.' });
  }
});

const formSchema = createSchema.extend({
  tagsString: z.string().optional(),
  pdfUrl: z.string().optional(),
  // Files are required to publish, not to save, so an empty list is valid.
  files: z.array(fileRowSchema).optional().default([]),
}).omit({ tags: true, thumbnailUrl: true, thumbnailFileId: true });

type FormValues = z.infer<typeof formSchema>;

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  shortDescription: 'Short description',
  description: 'Full description',
  price: 'Price',
  category: 'Category',
  language: 'Language',
  examName: 'Exam name',
  tagsString: 'Tags',
  previewPages: 'Preview pages',
};

const FILES_TAB_FIELDS = new Set(['files', 'previewPages', 'pageCount']);

// What counts as an unsaved change. Page counts are left out because they
// are filled in in the background after load.
const snapshotValues = (v: FormValues, isFree: boolean) =>
  JSON.stringify([
    v.title,
    v.description,
    v.shortDescription || '',
    isFree ? 0 : v.price,
    v.category || '',
    v.language || '',
    v.examName || '',
    v.previewPages || 0,
    v.tagsString || '',
    (v.files || []).filter((f) => isRealFileUrl(f.fileUrl)).map((f) => [f.title, f.fileUrl]),
  ]);

const LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
  "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
  "Assamese", "Urdu", "Sanskrit", "Konkani", "Dogri",
  "Bodo", "Maithili", "Santali", "Kashmiri", "Nepali",
  "Sindhi", "Manipuri", "Multiple Languages",
];

// Uploads finish out of order, so results are matched to rows by this key
// rather than by array position.
const generateClientKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const ProductStepForm: React.FC<ProductStepFormProps> = ({ productId, aiInitialValues }) => {
  const navigate = useNavigate();
  const isEditMode = !!productId;

  const [isSubmittingAction, setIsSubmittingAction] = useState<'save' | 'publish' | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [extractedPdfText, setExtractedPdfText] = useState<string | null>(null);
  // Edit mode only. Opens on Files for a product with nothing uploaded yet.
  const [activeStepTab, setActiveStepTab] = useState<'details' | 'files'>('details');
  // The price typed before "Keep this free" was ticked, restored when unticked.
  const lastPriceRef = useRef<number>(0);
  // Its own state rather than price === 0, so unticking always re-enables the
  // price input even while the price is still 0.
  const [isFreeChecked, setIsFreeChecked] = useState(true);
  const [replacing, setReplacing] = useState<{ clientKey: string; progress: number; checking: boolean } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceKeyRef = useRef<string | null>(null);
  const formRootRef = useRef<HTMLFormElement>(null);
  const [errorFocusTick, setErrorFocusTick] = useState(0);
  const baselineRef = useRef<string | null>(null);

  const { createProductMutation, updateProductMutation, publishProductMutation } = useTeacherProductMutations({ silent: true });
  const analyzePdfMutation = useTeacherProductAnalyzePdf();
  const limits = useUploadLimits();
  const pdfMaxMb = Math.min(limits.digitalProductPdfMaxMb, STUDY_NOTES_PDF_MAX_MB);
  const {
    data: productDetails,
    isLoading: isDetailsLoading,
    error: detailsError,
    refetch: refetchDetails,
    isFetching: isDetailsFetching,
  } = useTeacherProductDetailsQuery(isEditMode ? productId : undefined);
  const isPublished = productDetails?.status === 'published';

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      title: '',
      description: '',
      shortDescription: '',
      price: 0,
      category: '',
      language: '',
      examName: '',
      previewPages: 0,
      pageCount: 0,
      tagsString: '',
      // Create mode has no Files section; edit mode fills this once details load.
      files: [],
    },
  });

  useEffect(() => {
    if (isEditMode && productDetails && !isFormInitialized) {
      let files = productDetails.files || [];
      // Legacy single-file products keep their file on pdfUrl with no file row.
      if (files.length === 0 && isRealFileUrl(productDetails.pdfUrl)) {
        files = [{
          id: 0,
          title: productDetails.title || 'File 1',
          fileUrl: productDetails.pdfUrl,
          fileId: productDetails.pdfFileId,
          fileSizeBytes: productDetails.fileSizeBytes,
          pageCount: productDetails.pageCount,
          orderIndex: 0,
        }];
      }

      const hasRealFiles = files.some((f: any) => isRealFileUrl(f.fileUrl));
      setActiveStepTab(hasRealFiles ? 'details' : 'files');
      setIsFreeChecked(productDetails.price === 0);

      form.setValues({
        title: productDetails.title,
        description: productDetails.description || '',
        shortDescription: productDetails.shortDescription || '',
        price: productDetails.price,
        category: productDetails.category || '',
        language: productDetails.language || '',
        examName: productDetails.examName || '',
        previewPages: productDetails.previewPages || 0,
        pageCount: files.reduce((sum: number, f: any) => sum + (f.pageCount || 0), 0),
        tagsString: productDetails.tags ? productDetails.tags.join(', ') : '',
        files: files.map(f => ({
          clientKey: generateClientKey(),
          id: f.id > 0 ? f.id : null,
          title: f.title,
          fileUrl: f.fileUrl,
          fileId: f.fileId,
          fileSizeBytes: f.fileSizeBytes,
          pageCount: f.pageCount,
        })),
      });
      setIsFormInitialized(true);
    } else if (!isEditMode && !isFormInitialized) {
      if (aiInitialValues) {
        const suggestedPrice = aiInitialValues.suggestedPrice ?? 0;
        form.setValues(prev => ({
          ...prev,
          title: aiInitialValues.title || prev.title,
          description: aiInitialValues.description || prev.description,
          shortDescription: aiInitialValues.shortDescription || prev.shortDescription,
          price: suggestedPrice > 0 ? suggestedPrice : prev.price,
          category: aiInitialValues.category || prev.category,
          language: aiInitialValues.language || prev.language,
          examName: aiInitialValues.examName || prev.examName,
          tagsString: aiInitialValues.tags ? aiInitialValues.tags.join(', ') : prev.tagsString,
        }));
        // A suggested price means the product is not free; the box must agree
        // with the price that will be saved.
        setIsFreeChecked(!(suggestedPrice > 0));
        if (suggestedPrice > 0) lastPriceRef.current = suggestedPrice;
      }
      setIsFormInitialized(true);
    }
  }, [isEditMode, productDetails, form.setValues, isFormInitialized, aiInitialValues]);

  useEffect(() => {
    if (isFormInitialized && baselineRef.current === null) {
      baselineRef.current = snapshotValues(form.values, isFreeChecked);
    }
  }, [isFormInitialized, form.values, isFreeChecked]);

  // Files uploaded before page counting existed have no count; fill it in on load.
  const backfilledKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isFormInitialized) return;
    const filesNeedingCount = (form.values.files || []).filter(
      (f) => isRealFileUrl(f.fileUrl) && !f.pageCount && f.clientKey && !backfilledKeysRef.current.has(f.clientKey)
    );
    if (filesNeedingCount.length === 0) return;

    filesNeedingCount.forEach((f) => {
      const clientKey = f.clientKey;
      if (!clientKey) return;
      backfilledKeysRef.current.add(clientKey);
      postTeacherProductsPdfPageCount({ fileUrl: f.fileUrl })
        .then(({ pageCount }) => {
          if (!pageCount) return;
          handleFilesChange((prevFiles) =>
            prevFiles.map((pf) => (pf.clientKey === clientKey ? { ...pf, pageCount } : pf))
          );
        })
        .catch((err) => {
          if (err instanceof PdfRejectedError) {
            toast.error(`${f.title || 'A file'}: ${err.message}`);
            return;
          }
          console.error('Failed to backfill page count for', f.fileUrl, err);
        });
    });
  }, [isFormInitialized, form.values.files]);

  type FileRow = FormValues['files'][number];

  // Always pass an updater when the change comes from an async upload, so two
  // uploads finishing close together cannot overwrite each other's result.
  // Titles are only defaulted when a row is created, never re-derived here.
  const handleFilesChange = (update: FileRow[] | ((prevFiles: FileRow[]) => FileRow[])) => {
    form.setValues(prev => {
      const prevFiles = prev.files || [];
      const nextFiles = typeof update === 'function' ? update(prevFiles) : update;
      const total = nextFiles.reduce((acc, f) => acc + (f.pageCount || 0), 0);
      return { ...prev, files: nextFiles, pageCount: total };
    });
  };

  const handleReorderDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    handleFilesChange(prevFiles => {
      const newFiles = [...prevFiles];
      const [moved] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, moved);
      return newFiles;
    });
    setDraggedIndex(null);
  };

  const startReplace = (clientKey: string) => {
    replaceKeyRef.current = clientKey;
    replaceInputRef.current?.click();
  };

  // Swaps the PDF on an existing row. The row keeps its id and title, so
  // students keep the same file entry, and the old object is not deleted:
  // nothing changes for students until the product is saved.
  const handleReplaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const clientKey = replaceKeyRef.current;
    replaceKeyRef.current = null;
    if (!file || !clientKey) return;
    const previous = (form.values.files || []).find((f) => f.clientKey === clientKey);
    setReplacing({ clientKey, progress: 0, checking: true });
    try {
      const checked = await checkStudyNotesPdf(file, pdfMaxMb);
      if ('error' in checked) {
        toast.error(checked.error);
        return;
      }
      const pdf = checked.file;
      setReplacing({ clientKey, progress: 0, checking: false });
      const result = await uploadFileToR2(pdf, 'products/files', pdf.name, (progress) =>
        setReplacing({ clientKey, progress, checking: false })
      );
      backfilledKeysRef.current.add(clientKey);
      handleFilesChange((prevFiles) =>
        prevFiles.map((f) =>
          f.clientKey === clientKey
            ? { ...f, fileUrl: result.url, fileId: result.key, fileSizeBytes: pdf.size, pageCount: null }
            : f
        )
      );
      try {
        const { pageCount } = await postTeacherProductsPdfPageCount({ fileUrl: result.url });
        handleFilesChange((prevFiles) =>
          prevFiles.map((f) => (f.clientKey === clientKey ? { ...f, pageCount } : f))
        );
      } catch (err) {
        if (err instanceof PdfRejectedError) {
          // The saved file stays on the row, so nothing changes for students.
          handleFilesChange((prevFiles) =>
            prevFiles.map((f) =>
              f.clientKey === clientKey && previous
                ? { ...f, fileUrl: previous.fileUrl, fileId: previous.fileId, fileSizeBytes: previous.fileSizeBytes, pageCount: previous.pageCount }
                : f
            )
          );
          toast.error(err.message);
          return;
        }
        console.error('Failed to read the page count of the replacement PDF', err);
      }
      toast.success(`Uploaded ${pdf.name}. Save to apply the replacement.`);
    } catch (err) {
      toast.error(parseErrorMessage(err) || 'Upload failed. Please try again.');
    } finally {
      setReplacing(null);
    }
  };

  const getRewriteContext = () => ({
    examName: form.values.examName || undefined,
    category: form.values.category || undefined,
    language: form.values.language || undefined,
    tags: form.values.tagsString ? form.values.tagsString.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    fileTitles: form.values.files ? form.values.files.map(f => f.title).filter(Boolean) : undefined,
  });

  const handleAnalyzePdf = () => {
    if (!extractedPdfText) return;
    analyzePdfMutation.mutate(
      { title: form.values.title || undefined, extractedText: extractedPdfText },
      {
        onSuccess: (data) => {
          form.setValues(prev => ({
            ...prev,
            category: prev.category && prev.category.trim() !== '' ? prev.category : (data.category || prev.category),
            examName: prev.examName && prev.examName.trim() !== '' ? prev.examName : (data.examName || prev.examName),
            tagsString: prev.tagsString && prev.tagsString.trim() !== ''
              ? prev.tagsString
              : (data.tags && data.tags.length > 0 ? data.tags.join(', ') : prev.tagsString),
          }));
          toast.success("Applied suggestions from the PDF - review and adjust as needed.");
        },
      }
    );
  };

  // `required` blocks any save. The file requirement only blocks publishing,
  // so a draft can be saved before its PDF exists. Recommended items never block.
  const readiness = useMemo(() => {
    const required: string[] = [];
    const recommended: string[] = [];

    const titleLen = (form.values.title || '').trim().length;
    if (titleLen < 3) required.push("Add a title (at least 3 characters).");

    const descText = (form.values.description || '').replace(/<[^>]*>?/gm, '').trim();
    if (descText.length < 10) required.push("Add a full description (at least 10 characters).");

    if (form.values.price === undefined || form.values.price === null || Number.isNaN(form.values.price) || form.values.price < 0) {
      required.push("Set a price (0 for free).");
    }

    const realFiles = (form.values.files || []).filter(f => isRealFileUrl(f.fileUrl));
    const fileIssue = realFiles.length === 0 ? "Upload at least one PDF file before publishing." : null;

    if (!form.values.shortDescription || form.values.shortDescription.trim().length === 0) {
      recommended.push("Add a short description - it's what students see on the card.");
    }
    if (!form.values.category) recommended.push("Pick a category so students can filter for it.");
    if (!form.values.language) recommended.push("Set the language.");
    if (!form.values.examName) recommended.push("Tag the exam this is for, to help students find it.");
    if (!form.values.tagsString || form.values.tagsString.trim().length === 0) {
      recommended.push("Add a few tags to improve search visibility.");
    }

    return {
      required,
      recommended,
      fileIssue,
      isReadyToSave: required.length === 0,
      isReadyToPublish: required.length === 0 && !fileIssue,
    };
  }, [form.values]);

  const buildPayload = useCallback(() => {
    const tags = form.values.tagsString
      ? form.values.tagsString.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    // The server derives pdfUrl, size and page totals from this list, and
    // matches rows by id so saved files keep their ids.
    const files = (form.values.files || [])
      .filter(f => isRealFileUrl(f.fileUrl))
      .map(f => ({
        id: f.id ?? null,
        title: f.title.trim(),
        fileUrl: f.fileUrl,
        fileId: f.fileId ?? null,
        fileSizeBytes: f.fileSizeBytes ?? null,
        pageCount: f.pageCount ?? null,
      }));

    return {
      title: form.values.title,
      description: form.values.description,
      shortDescription: form.values.shortDescription || null,
      price: isFreeChecked ? 0 : form.values.price,
      category: form.values.category || null,
      language: form.values.language || null,
      examName: form.values.examName || null,
      tags,
      files,
      pageCount: files.reduce((sum, f) => sum + (f.pageCount || 0), 0) || null,
      previewPages: form.values.previewPages || 0,
    };
  }, [form.values, isFreeChecked]);

  const isDirty = baselineRef.current !== null && snapshotValues(form.values, isFreeChecked) !== baselineRef.current;
  const isSubmitting = createProductMutation.isPending || updateProductMutation.isPending || publishProductMutation.isPending || isSubmittingAction !== null;
  const guard = useUnsavedChangesGuard(
    isDirty && !isSubmitting,
    isEditMode
      ? 'Your changes on this page are not saved yet, including any PDFs you uploaded here. If you leave now, they are lost.'
      : undefined
  );

  const markSaved = () => {
    baselineRef.current = snapshotValues(form.values, isFreeChecked);
  };

  // Validation covers both tabs, so a failed save opens the tab holding the
  // first problem, says what it is and moves focus to it.
  const revealFirstError = () => {
    const result = formSchema.safeParse(form.values);
    const issue = result.success ? null : result.error.issues[0];
    if (!issue) {
      toast.error('Please fix the highlighted errors before saving.');
      return;
    }
    const [field, index] = issue.path;
    if (isEditMode) setActiveStepTab(FILES_TAB_FIELDS.has(String(field)) ? 'files' : 'details');
    const label = field === 'files' && typeof index === 'number'
      ? `File ${index + 1}`
      : FIELD_LABELS[String(field)] ?? 'Form';
    toast.error(`${label}: ${issue.message}`);
    setErrorFocusTick((n) => n + 1);
  };

  useEffect(() => {
    if (!errorFocusTick) return;
    const root = formRootRef.current;
    root?.querySelector<HTMLElement>('[id$="-form-item-message"]')?.scrollIntoView({ block: 'center' });
    root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true });
  }, [errorFocusTick]);

  const handleSave = (action: 'save' | 'publish') => {
    if (!form.validateForm()) {
      revealFirstError();
      return;
    }
    if (action === 'publish' && !readiness.isReadyToPublish) {
      toast.error(readiness.fileIssue || "Please fix the highlighted issues before publishing.");
      return;
    }
    setIsSubmittingAction(action);
    const payload = buildPayload();
    const leaveAfterSave = () => {
      markSaved();
      setIsSubmittingAction(null);
      navigate('/teacher/products');
    };

    if (isEditMode && productId) {
      updateProductMutation.mutate({ ...payload, id: productId }, {
        onSuccess: (saved) => {
          handleFilesChange((prevFiles) =>
            prevFiles.map((f) => {
              if (f.id || !isRealFileUrl(f.fileUrl)) return f;
              const match = saved.files.find((s) => s.fileUrl === f.fileUrl);
              return match ? { ...f, id: match.id } : f;
            })
          );
          // A published product is already live, so saving is the whole job.
          if (action === 'publish' && !isPublished) {
            publishProductMutation.mutate({ id: productId }, {
              onSuccess: () => {
                toast.success('Saved and published');
                leaveAfterSave();
              },
              onError: (error) => {
                markSaved();
                setIsSubmittingAction(null);
                toast.error(`Your changes are saved, but the product was not published. ${parseErrorMessage(error)}`);
              },
            });
          } else {
            toast.success(isPublished ? 'Changes saved and live' : 'Draft saved');
            leaveAfterSave();
          }
        },
        onError: (error) => {
          setIsSubmittingAction(null);
          toast.error(parseErrorMessage(error) || 'The product could not be saved.');
        },
      });
    } else {
      // Creating only collects details; files are added on the edit page next.
      createProductMutation.mutate(payload, {
        onSuccess: (data) => {
          markSaved();
          setIsSubmittingAction(null);
          toast.success('Draft saved. Now upload your PDF files.');
          navigate(`/teacher/products/${data.id}/edit`);
        },
        onError: (error) => {
          setIsSubmittingAction(null);
          toast.error(parseErrorMessage(error) || 'The product could not be created.');
        },
      });
    }
  };

  if (isEditMode && isDetailsLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <Skeleton className={styles.skeletonBar} />
          <Skeleton className={styles.skeletonBlock} />
          <Skeleton className={styles.skeletonBar} />
          <Skeleton className={styles.skeletonBar} />
        </div>
      </div>
    );
  }

  // Without the saved product there is nothing safe to edit: a blank form
  // could be saved over the real one.
  if (isEditMode && !productDetails) {
    return (
      <div className={styles.container}>
        <div className={styles.loadError} role="alert">
          <span className={styles.loadErrorIcon} aria-hidden="true">
            <AlertCircle size={26} />
          </span>
          <h2 className={styles.loadErrorTitle}>This product could not be loaded</h2>
          <p className={styles.loadErrorText}>
            {detailsError ? `${parseErrorMessage(detailsError).replace(/\.?$/, '.')}` : 'It did not come back from the server.'}{' '}
            Nothing has been changed. Try again, or go back to the list.
          </p>
          <div className={styles.loadErrorActions}>
            <Button onClick={() => refetchDetails()} disabled={isDetailsFetching}>
              {isDetailsFetching && <Spinner size="sm" />}
              Try again
            </Button>
            <Button variant="outline" onClick={() => navigate('/teacher/products')}>
              Back to Notes &amp; PDFs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Form {...form}>
        <form ref={formRootRef} onSubmit={(e) => e.preventDefault()} className={styles.pageLayout}>
          <div className={styles.mainColumn}>
            {isEditMode && (
              <div className={styles.stepTabs}>
                <button
                  type="button"
                  className={`${styles.stepTab} ${activeStepTab === 'details' ? styles.stepTabActive : ''}`}
                  onClick={() => setActiveStepTab('details')}
                >
                  1. Details
                </button>
                <button
                  type="button"
                  className={`${styles.stepTab} ${activeStepTab === 'files' ? styles.stepTabActive : ''}`}
                  onClick={() => setActiveStepTab('files')}
                >
                  2. Files
                </button>
              </div>
            )}

            {(!isEditMode || activeStepTab === 'details') && (
            <div className={styles.section}>
              <FormItem name="title">
                <div className={styles.labelRow}>
                  <FormLabel>Product Title *</FormLabel>
                  <AIRewriteButton
                    field="title"
                    contentType="product"
                    currentValue={form.values.title}
                    context={getRewriteContext()}
                    onAccept={(suggestion) => form.setValues(prev => ({ ...prev, title: suggestion }))}
                  />
                </div>
                <FormControl>
                  <Input
                    placeholder="e.g., Complete Physics Formula Sheet"
                    value={form.values.title}
                    onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="shortDescription">
                <div className={styles.labelRow}>
                  <FormLabel>Short Description</FormLabel>
                  <AIRewriteButton
                    field="shortDescription"
                    contentType="product"
                    currentValue={form.values.shortDescription || ''}
                    context={{ ...getRewriteContext(), title: form.values.title, description: form.values.description }}
                    onAccept={(suggestion) => form.setValues(prev => ({ ...prev, shortDescription: suggestion }))}
                  />
                </div>
                <FormControl>
                  <Input
                    placeholder="Brief summary for the card view (max 255 chars)"
                    value={form.values.shortDescription || ''}
                    onChange={(e) => form.setValues(prev => ({ ...prev, shortDescription: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="description">
                <div className={styles.labelRow}>
                  <FormLabel>Full Description *</FormLabel>
                  <AIRewriteButton
                    field="description"
                    contentType="product"
                    currentValue={form.values.description}
                    context={{ ...getRewriteContext(), title: form.values.title }}
                    onAccept={(suggestion) => form.setValues(prev => ({ ...prev, description: suggestion }))}
                  />
                </div>
                <FormControl>
                  <RichTextEditor
                    placeholder="Detailed description of what's included..."
                    value={form.values.description}
                    onChange={(html) => form.setValues(prev => ({ ...prev, description: html }))}
                    disableMediaUpload
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <div className={styles.grid2}>
                <FormItem name="category">
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.category || undefined}
                      onValueChange={(val) => {
                        // Radix's Select fires a spurious onValueChange("") right after
                        // mount when the controlled value is set programmatically before
                        // the user has ever opened it (seen right after loading saved
                        // category/language into the edit form). None of our category
                        // options are an empty string, so a real user selection can never
                        // produce "" — safe to ignore it here.
                        if (!val) return;
                        form.setValues(prev => ({ ...prev, category: val }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIGITAL_PRODUCT_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="language">
                  <FormLabel>Language</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.language || undefined}
                      onValueChange={(val) => {
                        // See the matching guard on the category Select above — Radix
                        // fires a spurious onValueChange("") right after mount when the
                        // value is set programmatically, and no real language option is
                        // an empty string, so ignoring falsy values here is safe.
                        if (!val) return;
                        form.setValues(prev => ({ ...prev, language: val }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="examName">
                <FormLabel>Exam Name</FormLabel>
                <FormControl>
                  <ExamNamePicker
                    value={form.values.examName || ""}
                    onChange={(val) => form.setValues(p => ({ ...p, examName: val }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="isFree">
                <div className={styles.checkboxRow}>
                  <FormControl>
                    <Checkbox
                      checked={isFreeChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsFreeChecked(checked);
                        if (checked) {
                          // Remember whatever price was there so unchecking
                          // restores it instead of leaving 0 behind.
                          if (form.values.price > 0) lastPriceRef.current = form.values.price;
                          form.setValues(prev => ({ ...prev, price: 0 }));
                        } else {
                          form.setValues(prev => ({ ...prev, price: lastPriceRef.current || prev.price || 0 }));
                        }
                      }}
                    />
                  </FormControl>
                  <FormLabel>Keep this free for students</FormLabel>
                </div>
                <FormDescription>No charge - students can get it for free instead of adding it to cart.</FormDescription>
              </FormItem>

              <div className={styles.grid2}>
                <FormItem name="price">
                  <FormLabel>Set price (0 to keep the product free)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0 for free"
                      value={form.values.price}
                      // Editing happens through the checkbox above once it's
                      // free — disable direct entry so the two controls can't
                      // disagree (e.g. checkbox unchecked but price still 0).
                      disabled={isFreeChecked}
                      onChange={(e) => form.setValues(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="tagsString">
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., physics, formulas, class 12 (comma separated)"
                      value={form.values.tagsString || ''}
                      onChange={(e) => form.setValues(prev => ({ ...prev, tagsString: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            </div>
            )}

            {/* Files are the second step: hidden while creating, their own tab when editing. */}
            {isEditMode && activeStepTab === 'files' && (
            <div className={styles.section}>
              <div className={styles.fileList}>
                <div className={styles.fileListHeader}>
                  <span className={styles.fileListLabel}>Product files (PDF)</span>
                  <div className={styles.fileListHeaderActions}>
                    {extractedPdfText && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAnalyzePdf}
                        disabled={analyzePdfMutation.isPending}
                      >
                        {analyzePdfMutation.isPending ? <Spinner size="sm" /> : <Sparkles size={14} />}
                        Suggest details from PDF
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      handleFilesChange(prevFiles => [
                        ...prevFiles,
                        { clientKey: generateClientKey(), id: null, title: `File ${prevFiles.length + 1}`, fileUrl: '', fileId: null, fileSizeBytes: null, pageCount: null },
                      ]);
                    }}>
                      <Plus size={16} /> Add File
                    </Button>
                  </div>
                </div>

                {(form.values.files || []).length === 0 && (
                  <div className={styles.filesEmptyState}>
                    <FileText size={28} className={styles.filesEmptyStateIcon} />
                    <p>No files uploaded yet.</p>
                    <span>Click "Add File" above to upload your first PDF.</span>
                  </div>
                )}

                <div className={styles.fileGrid}>
                  {(form.values.files || []).map((file, index) => {
                    const allFiles = form.values.files || [];
                    const uploaded = isRealFileUrl(file.fileUrl);
                    const uploadedCount = allFiles.filter((f) => isRealFileUrl(f.fileUrl)).length;
                    const clientKey = file.clientKey;
                    const isReplacing = !!clientKey && replacing?.clientKey === clientKey;
                    const setTitle = (title: string) =>
                      handleFilesChange(prevFiles => prevFiles.map(f => (f.clientKey === clientKey ? { ...f, title } : f)));
                    const removeRow = () =>
                      handleFilesChange(prevFiles => prevFiles.filter(f => f.clientKey !== clientKey));
                    const moveRow = (delta: -1 | 1) =>
                      handleFilesChange(prevFiles => {
                        const from = prevFiles.findIndex(f => f.clientKey === clientKey);
                        const to = from + delta;
                        if (from < 0 || to < 0 || to >= prevFiles.length) return prevFiles;
                        const next = [...prevFiles];
                        [next[from], next[to]] = [next[to], next[from]];
                        return next;
                      });
                    const meta = [
                      file.pageCount ? `${file.pageCount} pages` : '',
                      file.fileSizeBytes ? `${(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '',
                    ].filter(Boolean).join(' · ');

                    return (
                      <div
                        key={clientKey ?? `row-${index}`}
                        className={`${styles.fileEntry} ${draggedIndex === index ? styles.dragging : ''} ${uploaded ? styles.fileEntryCompact : ''}`}
                        draggable={uploaded && !isReplacing}
                        onDragStart={() => setDraggedIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleReorderDrop(index)}
                        onDragEnd={() => setDraggedIndex(null)}
                      >
                        {uploaded ? (
                          <div className={styles.fileRow}>
                            <GripVertical size={16} className={styles.dragHandle} aria-hidden="true" />
                            <div className={styles.fileRowIcon}>
                              <FileText size={16} />
                            </div>
                            <FormItem name={`files.${index}.title`} className={styles.fileRowInfo}>
                              <FormControl>
                                <input
                                  className={styles.fileRowNameInput}
                                  aria-label={`Title of file ${index + 1}`}
                                  value={file.title || ''}
                                  placeholder={`File ${index + 1}`}
                                  onChange={(e) => setTitle(e.target.value)}
                                />
                              </FormControl>
                              <span className={styles.fileRowMeta}>
                                {isReplacing
                                  ? replacing?.checking
                                    ? 'Checking PDF...'
                                    : `Uploading replacement... ${replacing?.progress ?? 0}%`
                                  : meta}
                              </span>
                              <FormMessage />
                            </FormItem>
                            <div className={styles.fileRowActions}>
                              <Button type="button" variant="ghost" size="icon-sm" title="Preview PDF" aria-label="Preview PDF" onClick={() => { setPreviewPdfTitle(file.title || `File ${index + 1}`); setPreviewPdfUrl(file.fileUrl); }}>
                                <Eye size={14} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Replace PDF"
                                aria-label={`Replace the PDF for ${file.title || `file ${index + 1}`}`}
                                disabled={replacing !== null || isSubmitting}
                                onClick={() => clientKey && startReplace(clientKey)}
                              >
                                {isReplacing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                              </Button>
                              <Button type="button" variant="ghost" size="icon-sm" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => moveRow(-1)}>
                                <ArrowUp size={14} />
                              </Button>
                              <Button type="button" variant="ghost" size="icon-sm" title="Move down" aria-label="Move down" disabled={index === allFiles.length - 1} onClick={() => moveRow(1)}>
                                <ArrowDown size={14} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title={uploadedCount <= 1 ? 'A product needs at least one PDF. Use Replace instead.' : 'Remove'}
                                aria-label="Remove file"
                                disabled={uploadedCount <= 1 || isReplacing}
                                onClick={removeRow}
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.fileEntryEmpty}>
                            <div className={styles.fileEntryEmptyHeader}>
                              <input
                                className={styles.fileTitleInput}
                                aria-label={`Title of file ${index + 1}`}
                                value={file.title || ''}
                                placeholder={`File ${index + 1}`}
                                onChange={(e) => setTitle(e.target.value)}
                              />
                              {allFiles.length > 1 && (
                                <Button type="button" variant="ghost" size="icon-sm" title="Remove" aria-label="Remove file" onClick={removeRow}>
                                  <X size={14} />
                                </Button>
                              )}
                            </div>
                            <FileUploader
                              className={styles.compactUploader}
                              folder="products/files"
                              acceptedTypes="application/pdf"
                              maxSizeInMB={pdfMaxMb}
                              label={`Upload PDF (up to ${pdfMaxMb} MB, no password)`}
                              validateFile={(picked) => checkStudyNotesPdf(picked, pdfMaxMb)}
                              onError={(error) => toast.error(error.message)}
                              onSuccess={async (res) => {
                                if (!res.url) return;
                                handleFilesChange(prevFiles => prevFiles.map(f =>
                                  f.clientKey === clientKey
                                    ? { ...f, fileUrl: res.url, fileId: res.fileId, fileSizeBytes: res.size }
                                    : f
                                ));
                                // Stops the load-time backfill from counting this file a second time.
                                if (clientKey) backfilledKeysRef.current.add(clientKey);
                                try {
                                  // Counted on the server: the CDN sends no CORS headers, so the browser cannot read the PDF.
                                  const { pageCount, textPreview } = await postTeacherProductsPdfPageCount({ fileUrl: res.url });
                                  handleFilesChange(prevFiles => prevFiles.map(f =>
                                    f.clientKey === clientKey ? { ...f, pageCount } : f
                                  ));
                                  // The first file's text is enough context for "Suggest details from PDF".
                                  if (index === 0 && textPreview) {
                                    setExtractedPdfText(textPreview);
                                  }
                                } catch (err) {
                                  if (err instanceof PdfRejectedError) {
                                    handleFilesChange(prevFiles => prevFiles.map(f =>
                                      f.clientKey === clientKey
                                        ? { ...f, fileUrl: '', fileId: null, fileSizeBytes: null, pageCount: null }
                                        : f
                                    ));
                                    toast.error(err.message);
                                    return;
                                  }
                                  console.error("Failed to auto-detect PDF page count:", err);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {form.errors.files && typeof form.errors.files === 'string' && (
                  <p className={styles.errorMessage}>{form.errors.files}</p>
                )}
              </div>

              <div className={styles.grid2}>
                <FormItem name="pageCount">
                  <FormLabel>Total Pages</FormLabel>
                  <div className={styles.pageCountDisplay}>
                    {form.values.pageCount
                      ? `${form.values.pageCount} pages`
                      : (form.values.files || []).some(f => isRealFileUrl(f.fileUrl))
                        ? 'Page count unavailable'
                        : 'No PDFs uploaded'}
                  </div>
                  <FormDescription>Auto-calculated from uploaded PDFs.</FormDescription>
                  <FormMessage />
                </FormItem>

                <FormItem name="previewPages">
                  <FormLabel>Preview Pages</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g., 3"
                      value={form.values.previewPages || ''}
                      onChange={(e) => form.setValues(prev => ({ ...prev, previewPages: parseInt(e.target.value) || 0 }))}
                    />
                  </FormControl>
                  <FormDescription>Number of pages available for free preview.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </div>
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.readinessCard}>
              <h3 className={styles.readinessTitle}>
                {readiness.isReadyToSave ? (
                  <><CheckCircle size={18} className={styles.successIcon} /> Ready to save</>
                ) : (
                  <><AlertTriangle size={18} className={styles.warningIcon} /> Not ready yet</>
                )}
              </h3>

              {readiness.required.length > 0 && (
                <div className={`${styles.issueBox} ${styles.requiredBox}`}>
                  <h4>Required</h4>
                  <ul>
                    {readiness.required.map((issue, idx) => (
                      <li key={idx}><AlertTriangle size={13} /> {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isEditMode && readiness.fileIssue && (
                <div className={`${styles.issueBox} ${styles.requiredBox}`}>
                  <h4>{isPublished ? 'Missing on the live product' : 'Required to publish'}</h4>
                  <ul>
                    <li><AlertTriangle size={13} /> {readiness.fileIssue}</li>
                  </ul>
                </div>
              )}

              {readiness.recommended.length > 0 && (
                <div className={`${styles.issueBox} ${styles.recommendedBox}`}>
                  <h4>Recommended</h4>
                  <ul>
                    {readiness.recommended.map((issue, idx) => (
                      <li key={idx}><AlertTriangle size={13} /> {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.actionsCard}>
              {isPublished && (
                <p className={styles.liveNote}>This product is live. Saving updates it for students straight away.</p>
              )}
              <Button type="button" variant="outline" onClick={() => guard.leave('/teacher/products')} disabled={isSubmitting}>
                Cancel
              </Button>
              {!isEditMode || isPublished ? (
                <Button
                  type="button"
                  onClick={() => handleSave('save')}
                  disabled={!readiness.isReadyToSave || isSubmitting || replacing !== null}
                >
                  {isSubmittingAction === 'save' && <Spinner size="sm" />}
                  {isEditMode ? 'Save changes' : <>Save &amp; Continue to Files</>}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave('save')}
                    disabled={!readiness.isReadyToSave || isSubmitting || replacing !== null}
                  >
                    {isSubmittingAction === 'save' && <Spinner size="sm" />}
                    {productDetails?.status === 'archived' ? 'Save changes' : 'Save as Draft'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave('publish')}
                    disabled={!readiness.isReadyToPublish || isSubmitting || replacing !== null}
                    title={readiness.fileIssue || undefined}
                  >
                    {isSubmittingAction === 'publish' && <Spinner size="sm" />}
                    Save &amp; Publish
                  </Button>
                </>
              )}
            </div>
          </aside>
        </form>
      </Form>

      <input
        ref={replaceInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={handleReplaceFile}
      />
      {guard.dialog}

      {previewPdfUrl && (
        <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}><Spinner /></div>}>
          <LazyPdfViewer pdfUrl={previewPdfUrl} title={previewPdfTitle} onClose={() => setPreviewPdfUrl(null)} />
        </React.Suspense>
      )}
    </div>
  );
};
