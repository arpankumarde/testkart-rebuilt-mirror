import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { AutoComplete, type Option } from "../components/AutoComplete";
import { ExamNamePicker } from "../components/ExamNamePicker";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "../components/Form";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ThumbnailUploader } from "../components/ThumbnailUploader";
import { TeacherFormHeader } from "../components/TeacherFormHeader";
import { TestSeriesCardPreview } from "../components/TestSeriesCardPreview";
import { AIRewriteButton } from "../components/AIRewriteButton";
import { AIListGenerateButton } from "../components/AIListGenerateButton";
import { RichTextEditor } from "../components/RichTextEditor";
import { useTeacherTestItemsQuery, useTeacherTestsQuery } from "../helpers/useTeacherTestsQuery";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import { buildPublicAssetUrl } from "../helpers/shareLinks";
import {
  dropBlankEntries,
  isBlankHtml,
  parseStringList,
  pickFirstIssue,
} from "../helpers/testSeriesEditing";
import type { TeacherTest } from "../endpoints/teacher/tests/list_GET.schema";
import styles from "./teacher.create-test.basic-info.module.css";

const languageOptions: Option[] = [
  "Assamese", "Bengali", "Bodo", "Dogri", "English", "Gujarati", "Hindi",
  "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri",
  "Marathi", "Multilingual", "Nepali", "Odia", "Punjabi", "Sanskrit",
  "Santali", "Sindhi", "Tamil", "Telugu", "Urdu",
].map((lang) => ({ value: lang, label: lang, displayText: lang }));

const SHORT_BIO_MAX = 200;

// List rows may be blank while the teacher is still typing. Blank rows are
// dropped on save instead of failing a per-row rule no message could show.
const formSchema = z
  .object({
    title: z.string().trim().min(3, "Use at least 3 characters."),
    examName: z.string(),
    language: z.string().trim().min(1, "Pick a language or type your own."),
    description: z
      .string()
      .trim()
      .min(10, "Write at least 10 characters.")
      .max(SHORT_BIO_MAX, `Keep it to ${SHORT_BIO_MAX} characters.`),
    isFree: z.boolean(),
    price: z.number({ invalid_type_error: "Enter a price." }).min(0, "Price cannot be negative."),
    discountPrice: z
      .number({ invalid_type_error: "Enter a number or leave it empty." })
      .min(0, "Discounted price cannot be negative.")
      .nullable(),
    whatYouLearn: z.array(z.string()),
    requirements: z.array(z.string()),
    longDescription: z.string(),
    thumbnailUrl: z.string(),
    thumbnailFileId: z.string().nullable(),
  })
  .refine((v) => !v.isFree || (v.price === 0 && !v.discountPrice), {
    message: "A free series has no price or discount.",
    path: ["isFree"],
  })
  .refine((v) => v.isFree || v.discountPrice === null || v.discountPrice <= v.price, {
    message: "Must not be more than the price.",
    path: ["discountPrice"],
  });

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  title: "",
  examName: "",
  language: "",
  description: "",
  isFree: false,
  price: 0,
  discountPrice: null,
  whatYouLearn: [],
  requirements: [],
  longDescription: "",
  thumbnailUrl: "",
  thumbnailFileId: null,
};

const FIELD_ORDER = [
  "title", "examName", "language", "description", "price", "discountPrice", "isFree",
  "whatYouLearn", "requirements", "longDescription", "thumbnailUrl",
];

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  examName: "Exam",
  language: "Language",
  description: "Short bio",
  price: "Price",
  discountPrice: "Discounted price",
  isFree: "Free series",
  whatYouLearn: "What students will master",
  requirements: "Requirements",
  longDescription: "Full description",
  thumbnailUrl: "Thumbnail",
};

type ListField = "whatYouLearn" | "requirements";

const toFormValues = (series: TeacherTest): FormValues => ({
  title: series.title ?? "",
  examName: series.examName ?? "",
  language: series.language ?? "",
  description: series.description ?? "",
  isFree: !!series.isFree,
  price: series.isFree ? 0 : Number(series.price) || 0,
  discountPrice: series.isFree || series.discountPrice == null ? null : Number(series.discountPrice),
  whatYouLearn: parseStringList(series.whatYouLearn),
  requirements: parseStringList(series.requirements),
  longDescription: series.longDescription ?? "",
  thumbnailUrl: series.thumbnailUrl ?? "",
  thumbnailFileId: series.thumbnailFileId ?? null,
});

const Page = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const parsedId = Number.parseInt(searchParams.get("testId") ?? "", 10);
  const testId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  // Series are created on teacher.create-test; this page only edits one.
  useEffect(() => {
    if (testId === null) navigate("/teacher/create-test", { replace: true });
  }, [testId, navigate]);

  // Refetch on arrival: the form is seeded once from this data, so it has to be current.
  const {
    data: tests,
    isFetching: isTestsFetching,
    isError: isTestsError,
    refetch: refetchTests,
  } = useTeacherTestsQuery({ refetchOnMount: "always" });
  const testPackage = testId !== null ? tests?.find((t) => t.id === testId) : undefined;

  // Real item titles give the storefront copy buttons something to write from.
  const { data: testItemsForContext } = useTeacherTestItemsQuery(testId);
  const itemTitles = testItemsForContext?.map((item) => item.title).filter(Boolean) ?? [];
  const aiSubjects = itemTitles.length > 0 ? itemTitles : undefined;

  const { isLoading: isExamListLoading } = useExamNameSuggestions();

  const { useUpdateTestMutation } = useTeacherTestMutations();
  const updateTestMutation = useUpdateTestMutation();

  const form = useForm({ schema: formSchema, defaultValues: EMPTY_VALUES });
  const { values, setValues } = form;

  const [seededTestId, setSeededTestId] = useState<number | null>(null);
  const [baseline, setBaseline] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // The paid price from before a switch to Free, put back if the teacher switches again.
  const paidPriceRef = useRef<{ price: number; discountPrice: number | null } | null>(null);

  // Seed once per series, after the arrival refetch settles. A later refetch
  // (a mutation elsewhere invalidating the list) must never overwrite edits.
  useEffect(() => {
    if (testId === null || !testPackage || isTestsFetching || seededTestId === testId) return;
    const seeded = toFormValues(testPackage);
    setValues(seeded);
    setBaseline(JSON.stringify(seeded));
    setSeededTestId(testId);
  }, [testId, testPackage, isTestsFetching, seededTestId, setValues]);

  const isSeeded = testId !== null && seededTestId === testId;
  const isDirty = isSeeded && JSON.stringify(values) !== baseline;
  const isSaving = updateTestMutation.isPending;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const reviewPath = `/teacher/create-test/${testId}/review`;

  const leaveToReview = () => {
    if (isDirty && !window.confirm("Discard your unsaved changes to this series?")) return;
    navigate(reviewPath);
  };

  // Scrolls a field to the middle of the view and focuses its first control. An
  // empty list has no input yet, so its Add item button takes focus instead.
  const revealField = (field: string) => {
    const wrapper = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (!wrapper) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wrapper.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    const target =
      wrapper.querySelector<HTMLElement>(
        "input:not([disabled]):not([type='file']), textarea:not([disabled]), [contenteditable='true']"
      ) ??
      wrapper.querySelector<HTMLElement>("[data-list-add]") ??
      wrapper.querySelector<HTMLElement>("button:not([disabled])");
    target?.focus({ preventScroll: true });
  };

  // Deep links name a field in ?focus= - the review step's "Add thumbnail" sends
  // thumbnailUrl. Reveal it once, after the seeded form has laid out.
  const focusField = searchParams.get("focus");
  const focusHandledRef = useRef(false);
  useEffect(() => {
    if (!isSeeded || focusHandledRef.current || !focusField || !FIELD_ORDER.includes(focusField)) return;
    const timer = window.setTimeout(() => {
      focusHandledRef.current = true;
      revealField(focusField);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isSeeded, focusField]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (testId === null || isSaving) return;

    const result = formSchema.safeParse(values);
    if (!result.success) {
      form.validateForm();
      const issue = pickFirstIssue(result.error.issues, FIELD_ORDER);
      if (issue) {
        const field = String(issue.path[0] ?? "");
        toast.error(`${FIELD_LABELS[field] ?? "Series details"}: ${issue.message}`);
        revealField(field);
      }
      return;
    }

    const v = result.data;
    const savedSnapshot = JSON.stringify(values);
    updateTestMutation.mutate(
      {
        testId,
        title: v.title,
        description: v.description,
        examName: v.examName.trim() || null,
        language: v.language,
        isFree: v.isFree,
        price: v.isFree ? 0 : v.price,
        discountPrice: v.isFree ? null : v.discountPrice,
        whatYouLearn: dropBlankEntries(v.whatYouLearn),
        requirements: dropBlankEntries(v.requirements),
        longDescription: isBlankHtml(v.longDescription) ? null : v.longDescription,
        thumbnailUrl: v.thumbnailUrl || null,
        thumbnailFileId: v.thumbnailFileId || null,
      },
      {
        onSuccess: () => {
          setBaseline(savedSnapshot);
          toast.success("Series details saved.");
          navigate(reviewPath);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save the series details."),
      }
    );
  };

  const setAccess = (isFree: boolean) =>
    setValues((p) => {
      if (p.isFree === isFree) return p;
      if (isFree) {
        paidPriceRef.current = { price: p.price, discountPrice: p.discountPrice };
        return { ...p, isFree: true, price: 0, discountPrice: null };
      }
      const paid = paidPriceRef.current;
      return {
        ...p,
        isFree: false,
        price: paid?.price ?? p.price,
        discountPrice: paid?.discountPrice ?? p.discountPrice,
      };
    });

  const updateListRow = (key: ListField, index: number, text: string) =>
    setValues((p) => {
      const next = [...p[key]];
      next[index] = text;
      return { ...p, [key]: next };
    });

  const removeListRow = (key: ListField, index: number) =>
    setValues((p) => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));

  const addListRow = (key: ListField) =>
    setValues((p) => ({ ...p, [key]: [...p[key], ""] }));

  if (testId === null) return null;

  if (!isSeeded) {
    if (!isTestsFetching && !testPackage && (tests || isTestsError)) {
      const notFound = !!tests;
      return (
        <div className={styles.page}>
          <TeacherFormHeader backTo="/teacher/test-series" backLabel="Test series" title="Edit series details" />
          <div className={styles.statePanel}>
            <h2>{notFound ? "This test series could not be found" : "Could not load this test series"}</h2>
            <p>
              {notFound
                ? "It may be in the Trash, or it belongs to another account."
                : "Check your connection and try again."}
            </p>
            {notFound ? (
              <Button asChild variant="outline">
                <Link to="/teacher/test-series">Go to test series</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => refetchTests()}>
                Try again
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "1rem", width: "5rem" }} />
        <Skeleton style={{ height: "2rem", width: "18rem" }} />
        <div className={styles.workspace}>
          <div className={styles.grid}>
            <div className={styles.sheetSkeleton}>
              <Skeleton style={{ height: "2.5rem" }} />
              <Skeleton style={{ height: "2.5rem" }} />
              <Skeleton style={{ height: "6rem" }} />
              <Skeleton style={{ height: "2.5rem" }} />
            </div>
            <Skeleton style={{ height: "28rem", borderRadius: "var(--radius-lg)" }} />
          </div>
        </div>
      </div>
    );
  }

  const bioLength = values.description.length;
  const bioTooLong = bioLength > SHORT_BIO_MAX;
  const highlights = dropBlankEntries(values.whatYouLearn)?.length ?? 0;
  const requirementCount = dropBlankEntries(values.requirements)?.length ?? 0;

  const checklist = [
    { field: "title", label: "Title", done: values.title.trim().length >= 3 },
    { field: "examName", label: "Exam", done: values.examName.trim() !== "" },
    { field: "language", label: "Language", done: values.language.trim() !== "" },
    { field: "description", label: "Short bio", done: values.description.trim().length >= 10 },
    { field: "whatYouLearn", label: "What students will master", done: highlights > 0 },
    { field: "requirements", label: "Requirements", done: requirementCount > 0 },
    { field: "longDescription", label: "Full description", done: !isBlankHtml(values.longDescription) },
    { field: "thumbnailUrl", label: "Thumbnail", done: values.thumbnailUrl !== "" },
  ];
  const gaps = checklist.filter((item) => !item.done);

  const isLive = !!testPackage?.isPublished;
  const statusLabel = isLive ? "Live" : testPackage?.wasEverPublished ? "Unpublished" : "Draft";
  const statusVariant = isLive ? "success" : testPackage?.wasEverPublished ? "warning" : "outline";
  const publicUrl =
    testPackage && isLive && testPackage.slug ? buildPublicAssetUrl("test-series", testPackage.slug) : undefined;

  const renderList = (key: ListField, placeholder: string) => (
    <div className={styles.dynamicList}>
      {values[key].map((item, index) => (
        <div key={index} className={styles.dynamicListRow}>
          <Input
            placeholder={placeholder}
            value={item}
            aria-label={`${FIELD_LABELS[key]} ${index + 1}`}
            onChange={(e) => updateListRow(key, index, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            onClick={() => removeListRow(key, index)}
            aria-label={`Remove ${FIELD_LABELS[key].toLowerCase()} ${index + 1}`}
          >
            <X size={16} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={styles.dynamicListAdd}
        onClick={() => addListRow(key)}
        data-list-add
      >
        <Plus size={16} /> Add item
      </Button>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Edit series details | Testkart</title>
        <meta name="description" content="Edit the details, pricing and storefront copy of your test series." />
      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader
          onBack={leaveToReview}
          backLabel="Review"
          title="Edit series details"
          subtitle={testPackage?.title ?? values.title}
        >
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </TeacherFormHeader>

        <Form {...form}>
          <form ref={formRef} onSubmit={handleSubmit} className={styles.workspace} noValidate>
            <div className={styles.grid}>
              <div className={styles.mainColumn}>
                <div className={styles.sheet}>
                  <section className={styles.block} aria-labelledby="series-basics-title">
                    <div className={styles.blockGuide}>
                      <h2 id="series-basics-title" className={styles.blockTitle}>Basics</h2>
                      <p className={styles.blockHint}>What students see when they browse.</p>
                    </div>

                    <div className={styles.blockFields}>
                      <FormItem name="title" data-field="title">
                        <div className={styles.labelWithAI}>
                          <FormLabel>Title</FormLabel>
                          <AIRewriteButton
                            field="title"
                            contentType="test"
                            currentValue={values.title}
                            context={{ examName: values.examName || undefined, language: values.language || undefined }}
                            onAccept={(suggestion) => setValues((p) => ({ ...p, title: suggestion }))}
                          />
                        </div>
                        <FormControl>
                          <Input
                            placeholder="e.g., SSC CGL Tier 1 Full Mock Tests"
                            value={values.title}
                            onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <div className={styles.row}>
                        <FormItem name="examName" data-field="examName">
                          <FormLabel>Exam</FormLabel>
                          {/* AutoComplete keeps its first `value` as the selection, so a blur
                              before the exam list arrives clears the saved exam. Mount the
                              picker once the list is in. */}
                          <FormControl>
                            <ExamNamePicker
                              key={isExamListLoading ? "loading" : "ready"}
                              disabled={isExamListLoading}
                              value={values.examName}
                              onChange={(examName) => setValues((p) => ({ ...p, examName }))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>

                        <FormItem name="language" data-field="language">
                          <FormLabel>Language</FormLabel>
                          <FormControl>
                            <AutoComplete
                              options={languageOptions}
                              emptyMessage="No languages found"
                              placeholder="e.g., English, Hindi, Tamil"
                              inputValue={values.language}
                              onInputValueChange={(language) => setValues((p) => ({ ...p, language: language || "" }))}
                              onValueChange={(option) => setValues((p) => ({ ...p, language: option.value || "" }))}
                              allowFreeForm
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>

                      <FormItem name="description" data-field="description">
                        <div className={styles.labelWithAI}>
                          <FormLabel>Short bio</FormLabel>
                          <AIRewriteButton
                            field="shortDescription"
                            contentType="test"
                            currentValue={values.description}
                            allowEmpty
                            context={{
                              examName: values.examName || undefined,
                              language: values.language || undefined,
                              title: values.title || undefined,
                              subjects: aiSubjects,
                            }}
                            onAccept={(suggestion) => setValues((p) => ({ ...p, description: suggestion }))}
                          />
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="A line or two about what this series covers"
                            rows={3}
                            maxLength={SHORT_BIO_MAX}
                            value={values.description}
                            onChange={(e) => setValues((p) => ({ ...p, description: e.target.value }))}
                          />
                        </FormControl>
                        <FormDescription className={bioTooLong ? styles.counterOver : undefined}>
                          {bioLength}/{SHORT_BIO_MAX} characters
                          {bioTooLong ? ` - shorten it by ${bioLength - SHORT_BIO_MAX} to save` : ""}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    </div>
                  </section>

                  <section className={styles.block} aria-labelledby="series-pricing-title">
                    <div className={styles.blockGuide}>
                      <h2 id="series-pricing-title" className={styles.blockTitle}>Pricing</h2>
                      <p className={styles.blockHint}>
                        {isLive ? "Price changes apply to new purchases." : "You can change this at any time."}
                      </p>
                    </div>

                    <div className={styles.blockFields}>
                      <div className={styles.pricingRow}>
                        <FormItem name="isFree" data-field="isFree">
                          <FormLabel id="series-access-label" htmlFor={undefined}>
                            Access
                          </FormLabel>
                          <div className={styles.access} role="radiogroup" aria-labelledby="series-access-label">
                            <input
                              type="radio"
                              id="series-access-paid"
                              name="series-access"
                              className={styles.accessInput}
                              checked={!values.isFree}
                              onChange={() => setAccess(false)}
                            />
                            <label htmlFor="series-access-paid" className={styles.accessLabel}>
                              Paid
                            </label>
                            <input
                              type="radio"
                              id="series-access-free"
                              name="series-access"
                              className={styles.accessInput}
                              checked={values.isFree}
                              onChange={() => setAccess(true)}
                            />
                            <label htmlFor="series-access-free" className={styles.accessLabel}>
                              Free
                            </label>
                          </div>
                          <FormMessage />
                        </FormItem>

                        {values.isFree ? (
                          <p className={styles.freeNote}>Students enrol without paying.</p>
                        ) : (
                          <>
                            <FormItem name="price" data-field="price">
                              <FormLabel>Price (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 299"
                                  value={values.price}
                                  onChange={(e) => setValues((p) => ({ ...p, price: Number(e.target.value) }))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>

                            <FormItem name="discountPrice" data-field="discountPrice">
                              <FormLabel>Discounted price (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="Optional"
                                  value={values.discountPrice ?? ""}
                                  onChange={(e) =>
                                    setValues((p) => ({
                                      ...p,
                                      discountPrice: e.target.value === "" ? null : Number(e.target.value),
                                    }))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className={styles.block} aria-labelledby="series-storefront-title">
                    <div className={styles.blockGuide}>
                      <h2 id="series-storefront-title" className={styles.blockTitle}>Storefront details</h2>
                      <p className={styles.blockHint}>Optional. Anything left empty stays hidden on the series page.</p>
                    </div>

                    <div className={`${styles.blockFields} ${styles.blockFieldsLoose}`}>
                      <div className={styles.listPair}>
                        <FormItem name="whatYouLearn" data-field="whatYouLearn">
                          <div className={styles.labelWithAI}>
                            <FormLabel>What students will master</FormLabel>
                            <AIListGenerateButton
                              field="whatYouLearn"
                              context={{
                                title: values.title || undefined,
                                examName: values.examName || undefined,
                                shortDescription: values.description || undefined,
                                longDescription: values.longDescription || undefined,
                                subjects: aiSubjects,
                                existingItems: dropBlankEntries(values.whatYouLearn) ?? [],
                              }}
                              onGenerate={(items) =>
                                setValues((p) => ({ ...p, whatYouLearn: [...(dropBlankEntries(p.whatYouLearn) ?? []), ...items] }))
                              }
                            />
                          </div>
                          {renderList("whatYouLearn", "e.g., Master every topic in the syllabus")}
                          <FormMessage />
                        </FormItem>

                        <FormItem name="requirements" data-field="requirements">
                          <div className={styles.labelWithAI}>
                            <FormLabel>Requirements</FormLabel>
                            <AIListGenerateButton
                              field="requirements"
                              context={{
                                title: values.title || undefined,
                                examName: values.examName || undefined,
                                shortDescription: values.description || undefined,
                                longDescription: values.longDescription || undefined,
                                subjects: aiSubjects,
                                existingItems: dropBlankEntries(values.requirements) ?? [],
                              }}
                              onGenerate={(items) =>
                                setValues((p) => ({ ...p, requirements: [...(dropBlankEntries(p.requirements) ?? []), ...items] }))
                              }
                            />
                          </div>
                          {renderList("requirements", "e.g., Basic understanding of the exam syllabus")}
                          <FormMessage />
                        </FormItem>
                      </div>

                      <FormItem name="longDescription" data-field="longDescription">
                        <div className={styles.labelWithAI}>
                          <FormLabel>Full description</FormLabel>
                          <AIRewriteButton
                            field="description"
                            contentType="test"
                            currentValue={values.longDescription}
                            allowEmpty
                            context={{
                              examName: values.examName || undefined,
                              language: values.language || undefined,
                              title: values.title || undefined,
                              subjects: aiSubjects,
                            }}
                            onAccept={(suggestion) => setValues((p) => ({ ...p, longDescription: suggestion }))}
                          />
                        </div>
                        <FormControl>
                          <RichTextEditor
                            placeholder="Describe the series in full"
                            value={values.longDescription}
                            onChange={(html) => setValues((p) => ({ ...p, longDescription: html }))}
                            disableMediaUpload
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <FormItem name="thumbnailUrl" data-field="thumbnailUrl" className={styles.thumbnailField}>
                        <FormLabel>Thumbnail</FormLabel>
                        <FormControl>
                          <ThumbnailUploader
                            value={values.thumbnailUrl || undefined}
                            currentFileId={values.thumbnailFileId ?? undefined}
                            onChange={(url, fileId) =>
                              setValues((p) => ({ ...p, thumbnailUrl: url, thumbnailFileId: fileId || null }))
                            }
                            folder="test-thumbnails"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                  </section>
                </div>

                <div className={styles.saveBar}>
                  <p className={`${styles.saveNote} ${isDirty ? styles.saveNoteDirty : ""}`} aria-live="polite">
                    {isDirty
                      ? "You have unsaved changes."
                      : isLive
                        ? "This series is live. Saved changes show on the storefront right away."
                        : "Nothing goes live until you publish the series."}
                  </p>
                  <Button type="button" variant="outline" onClick={leaveToReview} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>

              <aside className={styles.rail} aria-label="Storefront preview">
                <TestSeriesCardPreview
                  title={values.title}
                  examName={values.examName}
                  language={values.language}
                  thumbnailUrl={values.thumbnailUrl}
                  creatorName={testPackage?.creatorName ?? null}
                  isFree={values.isFree}
                  price={values.price}
                  discountPrice={values.discountPrice}
                  testCount={Number(testPackage?.totalTests ?? testPackage?.testItemsCount ?? 0)}
                  freeTestCount={Number(testPackage?.freeTestsCount ?? 0)}
                  questionCount={Number(testPackage?.totalQuestions ?? 0)}
                  durationMinutes={
                    testPackage && testPackage.durationMinutes != null ? Number(testPackage.durationMinutes) : null
                  }
                  pageUrl={publicUrl}
                />

                <section className={styles.checklist} aria-labelledby="series-checklist-title">
                  <div className={styles.checklistHead}>
                    <h2 id="series-checklist-title" className={styles.checklistTitle}>Listing checklist</h2>
                    <span className={styles.checklistCount}>
                      {checklist.length - gaps.length} of {checklist.length}
                    </span>
                  </div>
                  <div className={styles.meter} aria-hidden="true">
                    {checklist.map((item) => (
                      <span
                        key={item.field}
                        className={item.done ? `${styles.meterStep} ${styles.meterStepDone}` : styles.meterStep}
                      />
                    ))}
                  </div>
                  {gaps.length > 0 ? (
                    <ul className={styles.gaps}>
                      {gaps.map((item) => (
                        <li key={item.field}>
                          <button
                            type="button"
                            className={styles.gapButton}
                            onClick={() => revealField(item.field)}
                            aria-label={`Add ${item.label.toLowerCase()}`}
                          >
                            <Plus size={14} aria-hidden="true" />
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.checklistDone}>Every part of the listing is filled in.</p>
                  )}
                </section>
              </aside>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
};

export default Page;