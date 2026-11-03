import React, { useId, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/Spinner";
import { useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import type { InputType as CreateCourseInput } from "../endpoints/teacher/courses/create_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { SegmentedControl } from "../components/SegmentedControl";
import { ExamMultiPicker } from "../components/ExamMultiPicker";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import { addSuggestedExam } from "../helpers/itemExams";
import { CourseCardPreview } from "../components/CourseCardPreview";
import { TeacherAIFillPanel, type TeacherAIFillValues } from "../components/TeacherAIFillPanel";
import { useAuth } from "../helpers/useAuth";
import styles from "./teacher.courses.create.module.css";

type PriceMode = "free" | "paid";
type CourseCreateRequest = CreateCourseInput & { examNames?: string[] };
type StartValues = {
  title: string;
  examName: string | null;
  examNames: string[];
  price: number;
};

const PRICE_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
] as const;

/** What the AI suggested beyond the start form's own fields; sent with the create call. */
type AiExtras = Pick<CreateCourseInput, "description" | "level" | "language">;

const StartForm: React.FC<{
  teacherName: string | null;
  isPending: boolean;
  initial?: StartValues;
  onAiFilled: (values: TeacherAIFillValues) => void;
  onCreate: (values: StartValues) => void;
}> = ({ teacherName, isPending, initial, onAiFilled, onCreate }) => {
  const titleId = useId();
  const titleErrorId = useId();
  const priceErrorId = useId();
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [examNames, setExamNames] = useState<string[]>(initial?.examNames ?? []);
  const [priceMode, setPriceMode] = useState<PriceMode>(initial && initial.price > 0 ? "paid" : "free");
  const [price, setPrice] = useState(initial && initial.price > 0 ? String(initial.price) : "");
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  const priceValue = priceMode === "paid" ? Number(price) : 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (title.trim().length < 3) nextErrors.title = "Give the course a name of at least 3 characters.";
    if (priceMode === "paid" && !(priceValue > 0)) nextErrors.price = "Enter a price, or choose Free.";
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.price) return;
    onCreate({ title: title.trim(), examName: examNames[0] ?? null, examNames, price: priceValue });
  };

  return (
    <div className={styles.startWrap}>
      <div className={styles.start}>
        <div className={styles.startMain}>
          <h1 className={styles.startTitle}>Start your course</h1>
          <p className={styles.startLead}>
            Name it to begin. Chapters and videos come next - a course needs at least one video lesson before it
            can go live. You can change anything later.
          </p>

          <TeacherAIFillPanel
            contentType="course"
            fills="title, exams, price and description"
            placeholder="e.g., Full Class 10 Physics course in Hindi with chapter-wise video lessons"
            onGenerated={onAiFilled}
          />

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor={titleId} className={styles.label}>
                Course title
              </label>
              <Input
                id={titleId}
                autoFocus
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                placeholder="e.g., Class 10 Physics, full syllabus"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? titleErrorId : undefined}
              />
              {errors.title ? (
                <p id={titleErrorId} className={styles.error}>
                  {errors.title}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Exams <span className={styles.optional}>(optional)</span>
              </span>
              <ExamMultiPicker value={examNames} onChange={setExamNames} />
            </div>

            <div className={styles.field}>
              <span className={styles.label} aria-hidden="true">
                Price
              </span>
              <div className={styles.priceRow}>
                <SegmentedControl
                  aria-label="Free or paid"
                  value={priceMode}
                  onValueChange={(mode) => {
                    setPriceMode(mode);
                    setErrors((prev) => ({ ...prev, price: undefined }));
                    if (mode === "paid") window.setTimeout(() => priceInputRef.current?.focus(), 0);
                  }}
                  options={PRICE_OPTIONS}
                />
                {priceMode === "paid" ? (
                  <div className={styles.rupeeInput}>
                    <span className={styles.rupee} aria-hidden="true">
                      ₹
                    </span>
                    <Input
                      ref={priceInputRef}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="499"
                      aria-label="Price in rupees"
                      value={price}
                      onChange={(event) => {
                        setPrice(event.target.value);
                        if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                      }}
                      aria-invalid={!!errors.price}
                      aria-describedby={errors.price ? priceErrorId : undefined}
                    />
                  </div>
                ) : null}
              </div>
              {errors.price ? (
                <p id={priceErrorId} className={styles.error}>
                  {errors.price}
                </p>
              ) : null}
            </div>

            <Button type="submit" size="lg" disabled={isPending} className={styles.submit}>
              {isPending ? <Spinner size="sm" /> : null}
              {isPending ? "Creating..." : "Create course"}
            </Button>
          </form>
        </div>

        <CourseCardPreview
          title={title}
          thumbnailUrl={null}
          hasIntroVideo={false}
          creatorName={teacherName}
          price={Number.isFinite(priceValue) ? priceValue : 0}
          lessonCount={null}
          totalMinutes={0}
          className={styles.preview}
        />
      </div>
    </div>
  );
};

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { createCourseMutation } = useTeacherCourseMutations();
  const { authState } = useAuth();
  const teacherName = authState.type === "authenticated" ? authState.user.displayName : null;
  const { officialExams } = useExamNameSuggestions();

  // AI fills the start form for the teacher to check; nothing is created until they press Create.
  const [aiFill, setAiFill] = useState<{ key: number; values: StartValues; extras: AiExtras } | null>(null);

  const handleAiFilled = (ai: TeacherAIFillValues) => {
    const level = ai.level === "advanced" || ai.level === "intermediate" ? ai.level : "beginner";
    const examNames = addSuggestedExam([], ai.examName, officialExams);
    setAiFill((prev) => ({
      key: (prev?.key ?? 0) + 1,
      values: {
        title: ai.title?.trim() ?? "",
        examName: examNames[0] ?? null,
        examNames,
        price: ai.suggestedPrice && ai.suggestedPrice > 0 ? ai.suggestedPrice : 0,
      },
      extras: { description: ai.description || ai.shortDescription || "", level, language: ai.language || null },
    }));
  };

  const handleCreate = (values: StartValues) => {
    const input: CourseCreateRequest = { level: "beginner", ...aiFill?.extras, ...values };
    createCourseMutation.mutate(input, {
      onSuccess: (data) => {
        navigate(`/teacher/courses/${data.id}/edit?tab=content`, { replace: true });
      },
    });
  };

  return (
    <>
      <Helmet>
        <title>Create New Course | Testkart</title>
        <meta
          name="description"
          content="Create a new course on Testkart. Start building your curriculum and publish it to students."
        />
      </Helmet>
      {createCourseMutation.isError ? (
        <p className={styles.bannerError} role="alert">
          Could not create the course. Nothing was saved. Check your connection and try again.
        </p>
      ) : null}
      <StartForm
        key={aiFill?.key ?? 0}
        teacherName={teacherName}
        isPending={createCourseMutation.isPending}
        initial={aiFill?.values}
        onAiFilled={handleAiFilled}
        onCreate={handleCreate}
      />
    </>
  );
}
