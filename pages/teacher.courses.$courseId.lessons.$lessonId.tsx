import React from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useTeacherCourseDetailsQuery } from '../helpers/useTeacherCoursesQuery';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { CourseLessonEditor, type LessonContentType } from '../components/CourseLessonEditor';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/Breadcrumb';
import styles from './teacher.courses.$courseId.lessons.$lessonId.module.css';

// The course editor opens lessons in a side panel; this page keeps older links working.
const curriculumPath = (courseId: number) => `/teacher/courses/${courseId}/edit?tab=content`;

const CONTENT_TYPES: LessonContentType[] = ['video', 'pdf', 'text', 'quiz'];

export default function TeacherCourseLessonPage() {
  const { courseId: courseIdParam, lessonId: lessonIdParam } = useParams<{courseId: string; lessonId: string}>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = parseInt(courseIdParam || "", 10);
  const isEditMode = lessonIdParam !== "new";
  const lessonId = isEditMode ? parseInt(lessonIdParam || "", 10) : undefined;

  const sectionIdQuery = searchParams.get("sectionId");
  const sectionId = sectionIdQuery ? parseInt(sectionIdQuery, 10) : undefined;
  const typeQuery = searchParams.get("type") as LessonContentType | null;
  const initialContentType = typeQuery && CONTENT_TYPES.includes(typeQuery) ? typeQuery : undefined;

  const { data: courseDetails, isPending, error } = useTeacherCourseDetailsQuery(
    !isNaN(courseId) ? courseId : null
  );

  if (isNaN(courseId) || (isEditMode && isNaN(lessonId as number)) || (!isEditMode && !sectionId)) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>That lesson link is not valid</h2>
        <p className={styles.errorMessage}>Open the lesson again from your course.</p>
        <Button asChild>
          <Link to="/teacher/courses">Go to Courses</Link>
        </Button>
      </div>
    );
  }

  // Only the first load shows a skeleton. A background refetch must not unmount
  // the editor, or unsaved typing and a running upload are lost.
  if (!courseDetails && isPending && !error) {
    return (
      <div className={styles.page}>
        <Skeleton style={{ height: "1.5rem", width: "200px", marginBottom: "var(--spacing-2)" }} />
        <Skeleton style={{ height: "2.5rem", width: "300px", marginBottom: "var(--spacing-4)" }} />
        <Skeleton style={{ height: "500px", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!courseDetails) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Course not found</h2>
        <p className={styles.errorMessage}>
          {error?.message || `We couldn't find a course with the ID ${courseId}.`}
        </p>
        <Button asChild>
          <Link to="/teacher/courses">Go to Courses</Link>
        </Button>
      </div>
    );
  }

  let lessonToEdit;
  let targetSectionId = sectionId;

  if (isEditMode) {
    for (const section of courseDetails.sections || []) {
      const found = section.lessons.find((l: any) => l.id === lessonId);
      if (found) {
        lessonToEdit = found;
        targetSectionId = section.id;
        break;
      }
    }
  }

  const sectionMissing = !isEditMode && !(courseDetails.sections || []).some((s) => s.id === sectionId);

  if ((isEditMode && !lessonToEdit) || sectionMissing) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>{sectionMissing ? 'Chapter not found' : 'Lesson not found'}</h2>
        <p className={styles.errorMessage}>
          {sectionMissing
            ? `We couldn't find that chapter in this course.`
            : `We couldn't find a lesson with the ID ${lessonId} in this course.`}
        </p>
        <Button asChild>
          <Link to={curriculumPath(courseId)}>Back to Course</Link>
        </Button>
      </div>
    );
  }

  const returnToCurriculum = () => {
    navigate(curriculumPath(courseId));
  };

  const pageTitle = isEditMode ? "Edit lesson" : "New lesson";

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} - ${courseDetails.title} | Testkart`}</title>
        <meta name="description" content={`Manage lesson content for the course ${courseDetails.title}`} />
      </Helmet>

      <div className={styles.page}>
        <Breadcrumb className={styles.breadcrumb}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/teacher/courses">Courses</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={curriculumPath(courseId)}>{courseDetails.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className={styles.header}>
          <h1 className={styles.title}>{pageTitle}</h1>
        </div>

        <div className={styles.formCard}>
          <CourseLessonEditor
            key={isEditMode ? `lesson-${lessonId}` : `new-${targetSectionId}`}
            courseId={courseId}
            sectionId={targetSectionId!}
            lesson={lessonToEdit}
            initialContentType={initialContentType}
            onDone={returnToCurriculum}
          />
        </div>
      </div>
    </>
  );
}
