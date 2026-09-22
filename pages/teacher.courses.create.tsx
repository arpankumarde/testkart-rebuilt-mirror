import React, { useId, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "../components/Spinner";
import { useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import type { InputType as CreateCourseInput } from "../endpoints/teacher/courses/create_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { SegmentedControl } from "../components/SegmentedControl";
import { ExamNamePicker } from "../components/ExamNamePicker";
import { CourseCardPreview } from "../components/CourseCardPreview";
import { AIContentPrompt } from "../components/AIContentPrompt";
import { useAuth } from "../helpers/useAuth";
import styles from "./teacher.courses.create.module.css";

type Mode = "ai" | "manual" | "creating";
type PriceMode = "free" | "paid";

const PRICE_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
] as const;

type AiCourseValues = {
  title: string;
  shortDescription?: string;
  description: string;
  examName?: string;
  category?: string;
  language?: string;
  suggestedPrice?: number;
  level?: string;
};

const StartForm: React.FC<{
  teacherName: string | null;
  isPending: boolean;
  onBack: () => void;
  onCreate: (values: { title: string; examName: string | null; price: number }) => void;
}> = ({ teacherName, isPending, onBack, onCreate }) => {
  const titleId = useId();
  const titleErrorId = useId();
  const priceErrorId = useId();
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [examName, setExamName] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("free");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  const priceValue = priceMode === "paid" ? Number(price) : 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (title.trim().length < 3) nextErrors.title = "Give the course a name of at least 3 characters.";
    if (priceMode === "paid" && !(priceValue > 0)) nextErrors.price = "Enter a price, or choose Free.";
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.price) return;
    onCreate({ title: title.trim(), examName: examName.trim() || null, price: priceValue });
  };

  return (
    <div className={styles.startWrap}>
      <div className={styles.start}>
        <div className={styles.startMain}>
          <button type="button" className={styles.backLink} onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" />
            Describe it for AI instead
          </button>
          <h1 className={styles.startTitle}>Start your course</h1>
          <p className={styles.startLead}>
            Name it to begin. Chapters, videos and the rest come next, and you can change anything later.
          </p>

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
                Exam <span className={styles.optional}>(optional)</span>
              </span>
              <ExamNamePicker value={examName} onChange={setExamName} />
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

  const [mode, setMode] = useState<Mode>("ai");
  const lastRequest = useRef<{ input: CreateCourseInput; fromAi: boolean } | null>(null);

  const create = (input: CreateCourseInput, fromAi: boolean) => {
    lastRequest.current = { input, fromAi };
    // The manual form stays on screen with its own pending button.
    if (fromAi) setMode("creating");
    createCourseMutation.mutate(input, {
      onSuccess: (data) => {
        navigate(`/teacher/courses/${data.id}/edit?${fromAi ? "tab=details&from=ai" : "tab=content"}`, {
          replace: true,
        });
      },
    });
  };

  const handleGenerated = (ai: AiCourseValues) => {
    const level = ai.level === "advanced" || ai.level === "intermediate" ? ai.level : "beginner";
    create(
      {
        title: ai.title?.trim() || "Untitled course",
        description: ai.description || ai.shortDescription || "",
        category: ai.category || "General",
        level,
        price: ai.suggestedPrice && ai.suggestedPrice > 0 ? ai.suggestedPrice : 0,
        language: ai.language || null,
        examName: ai.examName || null,
      },
      true
    );
  };

  const handleManualCreate = (values: { title: string; examName: string | null; price: number }) =>
    create({ ...values, category: "General", level: "beginner" }, false);

  return (
    <>
      <Helmet>
        <title>Create New Course | Testkart</title>
        <meta
          name="description"
          content="Create a new course on Testkart. Start building your curriculum and publish it to students."
        />
      </Helmet>
      {mode === "ai" ? (
        <AIContentPrompt
          contentType="course"
          teacherName={teacherName ?? undefined}
          onGenerated={handleGenerated}
          onSkip={() => setMode("manual")}
        />
      ) : mode === "manual" ? (
        <>
          {createCourseMutation.isError ? (
            <p className={styles.bannerError} role="alert">
              Could not create the course. Nothing was saved. Check your connection and try again.
            </p>
          ) : null}
          <StartForm
            teacherName={teacherName}
            isPending={createCourseMutation.isPending}
            onBack={() => {
              createCourseMutation.reset();
              setMode("ai");
            }}
            onCreate={handleManualCreate}
          />
        </>
      ) : (
        <div className={styles.status}>
          {createCourseMutation.isError ? (
            <>
              <p className={styles.bannerError} role="alert">
                Could not create the course. Nothing was saved.
              </p>
              <Button
                onClick={() => {
                  if (lastRequest.current) create(lastRequest.current.input, lastRequest.current.fromAi);
                }}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <Spinner size="lg" />
              <p className={styles.statusText}>Setting up your course...</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
