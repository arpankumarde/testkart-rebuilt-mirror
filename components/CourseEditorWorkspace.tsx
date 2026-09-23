import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, ExternalLink, EyeOff, MoreHorizontal, Send } from "lucide-react";
import { useTeacherCourseDetailsQuery, useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import { useAuth } from "../helpers/useAuth";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import {
  countCourseLessons,
  formatCourseMinutes,
  getCourseReadiness,
  lessonHasContent,
  pluralize,
  sumLessonMinutes,
  type CourseReadinessKey,
} from "../helpers/courseDraft";
import { CourseCreationForm, type CourseDetailsFormHandle, type CourseDetailsValues } from "./CourseCreationForm";
import { CourseSectionBuilder } from "./CourseSectionBuilder";
import { CourseCardPreview } from "./CourseCardPreview";
import { CourseSubmitDialog } from "./CourseSubmitDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { WithdrawReviewButton } from "./WithdrawReviewButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import styles from "./CourseEditorWorkspace.module.css";

type EditorTab = "content" | "details";

// Links from the old three-step editor used ?step=details|curriculum|review.
const tabFromParams = (params: URLSearchParams): EditorTab =>
  (params.get("tab") ?? params.get("step")) === "details" ? "details" : "content";

const FIX_LABELS: Record<CourseReadinessKey, string> = {
  lessons: "Add",
  cover: "Add",
  description: "Write",
};

/*
 * The course editor: Content (chapters and lessons) and Details sit in tabs that
 * both stay mounted, so switching never loses typing. The side column shows the
 * card students will see and what is still needed before Submit for review.
 * Inside the admin panel it only edits: no submit, withdraw or unpublish.
 */
export const CourseEditorWorkspace = ({ courseId }: { courseId: number }) => {
  const adminEdit = useAdminContentEdit();
  const exitTo = adminEdit?.exitTo ?? "/teacher/courses";
  const rootClass = adminEdit ? styles.embedded : styles.page;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParams(searchParams);
  const filledByAi = searchParams.get("from") === "ai";

  const { authState } = useAuth();
  const teacherName = adminEdit
    ? adminEdit.teacherName
    : authState.type === "authenticated"
      ? authState.user.displayName
      : null;

  const { data: course, isPending, error } = useTeacherCourseDetailsQuery(!isNaN(courseId) ? courseId : null);
  const { publishCourseMutation, unpublishCourseMutation } = useTeacherCourseMutations();

  const detailsRef = useRef<CourseDetailsFormHandle>(null);
  const [draft, setDraft] = useState<CourseDetailsValues | null>(null);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [detailsUploading, setDetailsUploading] = useState(false);
  const [isSubmitOpen, setSubmitOpen] = useState(false);
  const [isUnpublishOpen, setUnpublishOpen] = useState(false);

  useEffect(() => {
    if (!detailsDirty && !detailsUploading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [detailsDirty, detailsUploading]);

  const setTab = (next: EditorTab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    params.delete("step");
    setSearchParams(params, { replace: true });
  };

  const goTo = (key: CourseReadinessKey) => {
    setSubmitOpen(false);
    if (key === "lessons") {
      setTab("content");
      return;
    }
    setTab("details");
    window.setTimeout(() => detailsRef.current?.focusField(key), 0);
  };

  const errorState = (title: string, message: string) => (
    <div className={rootClass}>
      <div className={styles.errorState} role="alert">
        <span className={styles.errorIcon} aria-hidden="true">
          <AlertCircle size={26} />
        </span>
        <h2 className={styles.errorTitle}>{title}</h2>
        <p className={styles.errorMessage}>{message}</p>
        <Button asChild variant="outline">
          <Link to={exitTo}>{adminEdit ? "Go back" : "Go to Courses"}</Link>
        </Button>
      </div>
    </div>
  );

  if (isNaN(courseId)) {
    return errorState("That course link is not valid", "Open the course again from your Courses list.");
  }

  // Only the first load shows a skeleton. A background refetch keeps the editor mounted.
  if (!course) {
    if (error) return errorState("Could not load this course", error.message);
    if (isPending) {
      return (
        <div className={rootClass}>
          <Skeleton style={{ height: "1rem", width: "80px" }} />
          <Skeleton style={{ height: "2rem", width: "320px" }} />
          <div className={styles.workspace}>
            <Skeleton style={{ height: "420px", width: "100%" }} />
            <Skeleton style={{ height: "320px", width: "100%" }} />
          </div>
        </div>
      );
    }
    return errorState("Could not open this course", "It may have been deleted, or it belongs to another account.");
  }

  const live = draft ?? {
    title: course.title,
    description: course.description,
    category: course.category ?? "",
    level: course.level,
    price: course.price,
    discountPrice: course.discountPrice,
    language: course.language,
    examName: course.examName ?? "",
    thumbnailImageUrl: course.thumbnailImageUrl,
    introVideoUrl: course.introVideoUrl,
  };

  const lessons = course.sections.flatMap((section) => section.lessons);
  const lessonsCount = countCourseLessons(course.sections);
  const totalMinutes = sumLessonMinutes(lessons);
  const lessonsWithoutContent = lessons.filter((lesson) => !lessonHasContent(lesson)).length;
  const readiness = getCourseReadiness({
    description: live.description,
    thumbnailImageUrl: live.thumbnailImageUrl,
    introVideoUrl: live.introVideoUrl,
    lessonsCount,
  });
  const doneCount = readiness.filter((item) => item.done).length;
  const isReady = doneCount === readiness.length;

  const isPublished = course.status === "published";
  const isInReview = !isPublished && course.inReview;
  const status = isPublished
    ? { label: "Live", className: styles.statusLive }
    : isInReview
      ? { label: "In review", className: styles.statusReview }
      : { label: "Draft", className: styles.statusDraft };

  const summary = [
    pluralize(course.sections.length, "chapter"),
    pluralize(lessonsCount, "lesson"),
    totalMinutes > 0 ? formatCourseMinutes(totalMinutes) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const submit = () =>
    publishCourseMutation.mutate({ courseId }, { onSuccess: () => setSubmitOpen(false) });

  const startSubmit = () => {
    if (isReady && !detailsDirty) {
      submit();
      return;
    }
    setSubmitOpen(true);
  };

  const saveDetails = async () => {
    const saved = (await detailsRef.current?.save()) ?? false;
    if (!saved) {
      setSubmitOpen(false);
      setTab("details");
    }
    return saved;
  };

  const shownTitle = live.title.trim() || "Untitled course";

  const viewCourse = (
    <Button asChild variant="outline">
      <a href={`/course/${course.slug}`} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16} /> View course
      </a>
    </Button>
  );

  return (
    <>
      {!adminEdit && (
        <Helmet>
          <title>{`Edit course: ${course.title} | Testkart`}</title>
          <meta name="description" content={`Edit the chapters, lessons and details of your course ${course.title}.`} />
        </Helmet>
      )}

      <div className={rootClass}>
        <header className={styles.header}>
          {!adminEdit && (
            <Link to="/teacher/courses" className={styles.backLink}>
              <ArrowLeft size={15} aria-hidden="true" />
              Courses
            </Link>
          )}
          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              {adminEdit ? (
                <h2 className={styles.title}>{shownTitle}</h2>
              ) : (
                <h1 className={styles.title}>{shownTitle}</h1>
              )}
              <p className={styles.meta}>
                <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                <span>{summary}</span>
              </p>
            </div>

            <div className={styles.actions}>
              {adminEdit ? (
                isPublished ? viewCourse : null
              ) : isPublished ? (
                <>
                  {viewCourse}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="More course actions" className={styles.moreButton}>
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={styles.menu}>
                      <DropdownMenuItem className={styles.dangerItem} onSelect={() => setUnpublishOpen(true)}>
                        <EyeOff size={16} /> Unpublish course
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : isInReview ? (
                <WithdrawReviewButton contentType="course" contentId={courseId} title={course.title} />
              ) : (
                <Button onClick={startSubmit} disabled={publishCourseMutation.isPending || detailsUploading}>
                  <Send size={16} />
                  {publishCourseMutation.isPending ? "Submitting..." : "Submit for review"}
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className={styles.workspace}>
          <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)} className={styles.main}>
            <TabsList className={styles.tabs} aria-label="Course editor sections">
              <TabsTrigger value="content" className={styles.tab}>
                Content
                <span className={styles.tabCount}>{lessonsCount}</span>
              </TabsTrigger>
              <TabsTrigger value="details" className={styles.tab}>
                Details
                {detailsDirty ? (
                  <span className={styles.unsavedDot} role="img" aria-label="unsaved changes" />
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" forceMount className={styles.panel}>
              <CourseSectionBuilder courseId={courseId} />
            </TabsContent>

            <TabsContent value="details" forceMount className={styles.panel}>
              <CourseCreationForm
                ref={detailsRef}
                key={course.id}
                course={course}
                chapterTitles={course.sections.map((section) => section.title)}
                notice={
                  filledByAi && !adminEdit ? (
                    <>
                      <strong>Filled in from your description.</strong> Check the wording and price, add a cover, then
                      add your chapters in Content.
                    </>
                  ) : null
                }
                onValuesChange={setDraft}
                onDirtyChange={setDetailsDirty}
                onUploadingChange={setDetailsUploading}
              />
            </TabsContent>
          </Tabs>

          <aside className={styles.aside} aria-label="Course summary">
            <CourseCardPreview
              title={live.title}
              category={live.category}
              language={live.language}
              level={live.level}
              thumbnailUrl={live.thumbnailImageUrl ?? null}
              hasIntroVideo={!!live.introVideoUrl}
              creatorName={teacherName}
              price={Number(live.price) || 0}
              discountPrice={live.discountPrice ?? null}
              lessonCount={lessonsCount}
              totalMinutes={totalMinutes}
              pageUrl={isPublished ? `/course/${course.slug}` : undefined}
            />

            {isPublished ? (
              <p className={styles.asideNote}>
                This course is live. Changes you save show to students straight away.
              </p>
            ) : isInReview ? (
              <p className={styles.asideNote}>
                {adminEdit
                  ? "This course is waiting for review. Saving changes does not approve it."
                  : "Our team is reviewing this course. We will email you when it is approved or needs changes."}
              </p>
            ) : (
              <section className={styles.readiness} aria-labelledby="course-readiness-heading">
                <div className={styles.readinessHead}>
                  <h2 id="course-readiness-heading" className={styles.readinessTitle}>
                    {adminEdit ? "Before it can go live" : "Before you submit"}
                  </h2>
                  <span className={styles.readinessCount}>
                    {doneCount} of {readiness.length} done
                  </span>
                </div>
                <ul className={styles.readinessList}>
                  {readiness.map((item) => (
                    <li key={item.key} className={item.done ? styles.itemDone : styles.itemTodo}>
                      {item.done ? (
                        <CheckCircle2 size={18} role="img" aria-label="Done" />
                      ) : (
                        <Circle size={18} role="img" aria-label="To do" />
                      )}
                      <span className={styles.itemLabel}>{item.label}</span>
                      {!item.done ? (
                        <button type="button" className={styles.itemFix} onClick={() => goTo(item.key)}>
                          {FIX_LABELS[item.key]}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {lessonsWithoutContent > 0 ? (
                  <p className={styles.softWarning}>
                    {pluralize(lessonsWithoutContent, "lesson")} {lessonsWithoutContent === 1 ? "has" : "have"} no file
                    or text yet. Students will see {lessonsWithoutContent === 1 ? "it" : "them"} empty.
                  </p>
                ) : null}
              </section>
            )}
          </aside>
        </div>
      </div>

      {!adminEdit && (
        <>
          <CourseSubmitDialog
            open={isSubmitOpen}
            onOpenChange={setSubmitOpen}
            readiness={readiness}
            hasUnsavedChanges={detailsDirty}
            isSubmitting={publishCourseMutation.isPending}
            aiContext={{
              title: live.title,
              category: live.category || undefined,
              level: live.level,
              language: live.language || undefined,
              examName: live.examName || undefined,
              chapterTitles: course.sections.map((section) => section.title),
            }}
            onSaveDetails={saveDetails}
            onUseDescription={(html) => detailsRef.current?.setDescription(html)}
            onFix={goTo}
            onSubmit={submit}
          />

          <ConsoleConfirmDialog
            open={isUnpublishOpen}
            onOpenChange={(open) => {
              if (!unpublishCourseMutation.isPending) setUnpublishOpen(open);
            }}
            tone="destructive"
            icon={<EyeOff size={20} />}
            title="Unpublish this course?"
            description={
              <>
                <strong>{course.title}</strong> goes back to draft. It disappears from the marketplace and is removed
                from every student's cart. Enrolled students keep access.
              </>
            }
            confirmLabel="Unpublish"
            pendingLabel="Unpublishing..."
            isPending={unpublishCourseMutation.isPending}
            onConfirm={() => unpublishCourseMutation.mutate({ courseId }, { onSuccess: () => setUnpublishOpen(false) })}
          />
        </>
      )}
    </>
  );
};
