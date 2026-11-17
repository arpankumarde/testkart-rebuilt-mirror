import React, { useId, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { BookOpen, Film, Layers } from "lucide-react";
import { Spinner } from "../components/Spinner";
import { useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import type { InputType as CreateCourseInput } from "../endpoints/teacher/courses/create_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import { addSuggestedExam } from "../helpers/itemExams";
import { CourseCardPreview } from "../components/CourseCardPreview";
import { TeacherAIFillPanel, type TeacherAIFillValues } from "../components/TeacherAIFillPanel";
import { TeacherFlowTop } from "../components/TeacherFlowTop";
import type { TeacherFlowStep } from "../components/TeacherFlowSteps";
import { usePublishesWithoutReview } from "../helpers/usePublishesWithoutReview";
import { useAuth } from "../helpers/useAuth";
import styles from "./teacher.courses.create.module.css";

type CourseCreateRequest = CreateCourseInput & { examNames?: string[] };

/** What the AI suggested beyond the title; sent with the create call and checked in the Details step. */
type AiExtras = Pick<CreateCourseInput, "description" | "level" | "language" | "price" | "examName"> & {
  examNames: string[];
};

const NEXT_UP = [
  { icon: Layers, text: "Add chapters to split the course into parts." },
  { icon: Film, text: "Add lessons to each chapter: videos, PDFs or text." },
  { icon: BookOpen, text: "A course needs at least one video lesson before it can go live." },
];

/*
 * The first page of the Lessons step. Chapters and lessons are saved against a
 * course, so the teacher names it here, the draft is created, and the editor
 * opens on the same step with the chapter builder (CourseEditorWorkspace).
 * Exams, price, description and cover come later, in the Details step.
 */
const StartForm: React.FC<{
  teacherName: string | null;
  isPending: boolean;
  failed: boolean;
  initialTitle?: string;
  previewPrice: number;
  onAiFilled: (values: TeacherAIFillValues) => void;
  onCreate: (title: string) => void;
}> = ({ teacherName, isPending, failed, initialTitle, previewPrice, onAiFilled, onCreate }) => {
  const sectionId = useId();
  const titleId = useId();
  const titleErrorId = useId();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3) {
      setTitleError("Give the course a name of at least 3 characters.");
      return;
    }
    onCreate(title.trim());
  };

  return (
    <div className={styles.startWrap}>
      <div className={styles.start}>
        <div className={styles.startMain}>
          <TeacherAIFillPanel
            contentType="course"
            fills="title, exams, price and description"
            placeholder="e.g., Full Class 10 Physics course in Hindi with chapter-wise video lessons"
            onGenerated={onAiFilled}
          />

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <section className={styles.section} aria-labelledby={sectionId}>
              <div className={styles.sectionHead}>
                <h2 id={sectionId} className={styles.sectionTitle}>
                  Chapters and lessons
                </h2>
                <span className={styles.sectionHint}>Name the course to start building its lessons.</span>
              </div>

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
                    if (titleError) setTitleError(null);
                  }}
                  placeholder="e.g., Class 10 Physics, full syllabus"
                  aria-invalid={!!titleError}
                  aria-describedby={titleError ? titleErrorId : undefined}
                />
                {titleError ? (
                  <p id={titleErrorId} className={styles.fieldError}>
                    {titleError}
                  </p>
                ) : null}
              </div>

              <ul className={styles.nextList}>
                {NEXT_UP.map(({ icon: Icon, text }) => (
                  <li key={text} className={styles.nextItem}>
                    <span className={styles.nextIcon} aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            {failed ? (
              <p className={styles.error} role="alert">
                Could not create the course. Nothing was saved. Check your connection and try again.
              </p>
            ) : null}

            <div className={styles.actions}>
              <p className={styles.actionsNote}>
                Exams, price and cover come in Details. Nothing goes live until you publish it.
              </p>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" /> : null}
                {isPending ? "Creating..." : "Start adding lessons"}
              </Button>
            </div>
          </form>
        </div>

        <CourseCardPreview
          title={title}
          thumbnailUrl={null}
          hasIntroVideo={false}
          creatorName={teacherName}
          price={previewPrice}
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
  const publishesDirectly = usePublishesWithoutReview();

  // AI fills the title here and the rest for the Details step; nothing is created until the teacher presses Start.
  const [aiFill, setAiFill] = useState<{ key: number; title: string; extras: AiExtras } | null>(null);

  // The course does not exist yet, so no step links anywhere; the editor carries the same track on.
  const steps: TeacherFlowStep[] = [
    { key: "lessons", label: "Lessons", hint: "Chapters and videos", tone: "lavender", state: "current" },
    { key: "details", label: "Details", hint: "Exams, price and cover", tone: "mint", state: "todo" },
    { key: "publish", label: "Publish", hint: publishesDirectly ? "Go live" : "Send for review", tone: "peach", state: "todo" },
  ];

  const handleAiFilled = (ai: TeacherAIFillValues) => {
    const level = ai.level === "advanced" || ai.level === "intermediate" ? ai.level : "beginner";
    const examNames = addSuggestedExam([], ai.examName, officialExams);
    setAiFill((prev) => ({
      key: (prev?.key ?? 0) + 1,
      title: ai.title?.trim() ?? "",
      extras: {
        description: ai.description || ai.shortDescription || "",
        level,
        language: ai.language || null,
        price: ai.suggestedPrice && ai.suggestedPrice > 0 ? ai.suggestedPrice : 0,
        examName: examNames[0] ?? null,
        examNames,
      },
    }));
  };

  const handleCreate = (title: string) => {
    const input: CourseCreateRequest = { level: "beginner", price: 0, ...aiFill?.extras, title };
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
      <div className={`${styles.page} tk-flow`}>
        <h1 className={styles.srOnly}>Create a course</h1>
        <TeacherFlowTop back="/teacher/courses" label="Course steps" steps={steps} />
        <StartForm
          key={aiFill?.key ?? 0}
          teacherName={teacherName}
          isPending={createCourseMutation.isPending}
          failed={createCourseMutation.isError}
          initialTitle={aiFill?.title}
          previewPrice={aiFill?.extras.price ?? 0}
          onAiFilled={handleAiFilled}
          onCreate={handleCreate}
        />
      </div>
    </>
  );
}