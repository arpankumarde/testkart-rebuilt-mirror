import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useTeacherCourseDetailsQuery } from '../helpers/useTeacherCoursesQuery';
import { CourseCreationForm } from '../components/CourseCreationForm';
import { CourseSectionBuilder } from '../components/CourseSectionBuilder';
import { CoursePublishReview } from '../components/CoursePublishReview';
import { CourseCreationProgress } from '../components/CourseCreationProgress';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { ConsoleConfirmDialog } from '../components/ConsoleConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { AlertCircle } from "lucide-react";
import styles from "./teacher.courses.$courseId.edit.module.css";

const STEP_KEYS = ["details", "curriculum", "review"] as const;

const stepFromParam = (value: string | null): number => {
  const index = STEP_KEYS.indexOf(value as (typeof STEP_KEYS)[number]);
  return index === -1 ? 1 : index + 1;
};

const EditCourseSkeleton: React.FC = () => (
  <div className={styles.page}>
    <Skeleton style={{ height: "1rem", width: "80px" }} />
    <Skeleton style={{ height: "2rem", width: "320px" }} />
    <Skeleton style={{ height: "3rem", width: "100%" }} />
    <Skeleton style={{ height: "400px", width: "100%" }} />
  </div>
);

const CourseError: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className={styles.page}>
    <div className={styles.errorState} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">
        <AlertCircle size={26} />
      </span>
      <h2 className={styles.errorTitle}>{title}</h2>
      <p className={styles.errorMessage}>{message}</p>
      <Button asChild variant="outline">
        <Link to="/teacher/courses">Go to Courses</Link>
      </Button>
    </div>
  </div>
);

export default function EditCoursePage() {
  const { courseId: courseIdParam } = useParams<{courseId: string;}>();
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;
  const [searchParams, setSearchParams] = useSearchParams();
  const step = stepFromParam(searchParams.get("step"));

  const { data: courseData, isPending, error } = useTeacherCourseDetailsQuery(
    !isNaN(courseId) ? courseId : null
  );

  const [detailsDirty, setDetailsDirty] = useState(false);
  const [detailsUploading, setDetailsUploading] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  const hasUnsavedDetails = step === 1 && detailsDirty;
  const isUploading = step === 1 && detailsUploading;

  useEffect(() => {
    if (!hasUnsavedDetails && !isUploading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedDetails, isUploading]);

  const applyStep = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("step", STEP_KEYS[next - 1]);
    setSearchParams(params);
  };

  const goToStep = (next: number, options?: { skipGuard?: boolean }) => {
    if (next === step || next < 1 || next > STEP_KEYS.length) return;
    if (isUploading) return;
    if (!options?.skipGuard && hasUnsavedDetails) {
      setPendingStep(next);
      return;
    }
    applyStep(next);
  };

  if (isNaN(courseId)) {
    return (
      <CourseError
        title="That course link is not valid"
        message="Open the course again from your Courses list."
      />
    );
  }

  // Only the first load shows a skeleton. A background refetch keeps the editor mounted.
  if (!courseData) {
    if (error) {
      return <CourseError title="Could not load this course" message={error.message} />;
    }
    if (isPending) {
      return <EditCourseSkeleton />;
    }
    return (
      <CourseError
        title="Could not open this course"
        message="It may have been deleted, or it belongs to another account."
      />
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <CourseCreationForm
            key={courseData.id}
            course={courseData}
            onSuccess={() => goToStep(2, { skipGuard: true })}
            onDirtyChange={setDetailsDirty}
            onUploadingChange={setDetailsUploading}
          />
        );
      case 2:
        return <CourseSectionBuilder courseId={courseId} />;
      case 3:
        return <CoursePublishReview courseId={courseId} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>{`Edit Course: ${courseData.title} | Testkart`}</title>
        <meta
          name="description"
          content={`Edit the details, curriculum, and settings for your course: ${courseData.title}.`} />

      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/courses"
          backLabel="Courses"
          title="Edit course"
          subtitle={courseData.title}
        />

        <CourseCreationProgress
          currentStep={step}
          courseId={courseId}
          onStepClick={(next) => goToStep(next)}
          disabled={isUploading}
        />

        <main className={styles.mainContent}>
          {renderStepContent()}
        </main>

        <nav className={styles.navigationButtons} aria-label="Course steps">
          {step > 1 ? (
            <Button variant="outline" onClick={() => goToStep(step - 1)} disabled={isUploading}>
              Previous
            </Button>
          ) : (
            <span className={styles.navSpacer} />
          )}
          {step < STEP_KEYS.length && (
            <Button onClick={() => goToStep(step + 1)} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Next"}
            </Button>
          )}
        </nav>
      </div>

      <ConsoleConfirmDialog
        open={pendingStep !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStep(null);
        }}
        tone="destructive"
        title="Discard unsaved changes?"
        description="Your edits to the course details are not saved. Keep editing and use Save Changes, or leave this step and lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          const next = pendingStep;
          setPendingStep(null);
          setDetailsDirty(false);
          if (next !== null) applyStep(next);
        }}
      />
    </>);

}
