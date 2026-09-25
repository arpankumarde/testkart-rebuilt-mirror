import React, { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStudentCourseLessonsQuery, useStudentCourseProgressQuery } from '../helpers/useStudentCoursesQuery';
import { useCourseEnrollment } from '../helpers/useCourseEnrollment';
import { CoursePlayer } from '../components/CoursePlayer';
import { CoursePlayerSkeleton } from '../components/CoursePlayerSkeleton';
import { Button } from '../components/Button';
import type { OutputType as LessonsOutputType } from '../endpoints/student/course/lessons_GET.schema';
import styles from './student.courses.$courseId.module.css';

type Lesson = LessonsOutputType['sections'][0]['lessons'][0];

const lastLessonKey = (courseId: number) => `tk-course-last-lesson:${courseId}`;

const readLastLesson = (courseId: number): number | null => {
  try {
    const value = Number(window.localStorage.getItem(lastLessonKey(courseId)));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const saveLastLesson = (courseId: number, lessonId: number) => {
  try {
    window.localStorage.setItem(lastLessonKey(courseId), String(lessonId));
  } catch {
    // Private mode or blocked storage: the course reopens at the first incomplete lesson.
  }
};

const StudentCoursePlayerPage: React.FC = () => {
  const { courseId: courseIdStr } = useParams<{courseId: string;}>();
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonParam = Number(searchParams.get('lesson'));

  const { data: lessonsData, isPending: isLessonsPending, error: lessonsError } = useStudentCourseLessonsQuery(courseId);
  const { data: progressData, isPending: isProgressPending, error: progressError } = useStudentCourseProgressQuery(courseId);
  const { markCompleteMutation, markIncompleteMutation } = useCourseEnrollment();

  const allLessons = useMemo(() => {
    return lessonsData?.sections.flatMap((section) => section.lessons) ?? [];
  }, [lessonsData]);

  // The lesson in the URL wins, then the last one opened on this device, then the first incomplete one.
  const activeLesson = useMemo<Lesson | null>(() => {
    if (!courseId || allLessons.length === 0 || !progressData) return null;
    const fromUrl = allLessons.find((lesson) => lesson.id === lessonParam);
    if (fromUrl) return fromUrl;
    const lastId = readLastLesson(courseId);
    const fromStorage = allLessons.find((lesson) => lesson.id === lastId);
    if (fromStorage) return fromStorage;
    const completedIds = new Set(progressData.completedLessonIds);
    return allLessons.find((lesson) => !completedIds.has(lesson.id)) ?? allLessons[0];
  }, [courseId, allLessons, progressData, lessonParam]);

  const setActiveLesson = (lesson: Lesson) => {
    const next = new URLSearchParams(searchParams);
    next.set('lesson', String(lesson.id));
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!courseId || !activeLesson) return;
    saveLastLesson(courseId, activeLesson.id);
    if (lessonParam !== activeLesson.id) {
      const next = new URLSearchParams(searchParams);
      next.set('lesson', String(activeLesson.id));
      setSearchParams(next, { replace: true });
    }
  }, [courseId, activeLesson, lessonParam, searchParams, setSearchParams]);

  const handleToggleComplete = (lessonId: number, isCompleted: boolean) => {
    const mutation = isCompleted ? markIncompleteMutation : markCompleteMutation;
    mutation.mutate({ lessonId }, {
      onError: () => {
        toast.error('Your progress was not saved. Check your connection and try again.');
      }
    });
  };

  if (!courseId || isNaN(courseId)) {
    return (
      <div className={styles.errorContainer} role="alert">
        <span className={styles.errorIcon} aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <h2>That course link is not valid</h2>
        <p>The address is missing a course id. Open the course from your courses list instead.</p>
        <Button asChild>
          <Link to="/student/courses"><ArrowLeft size={16} /> Back to courses</Link>
        </Button>
      </div>);

  }

  const error = lessonsError || progressError;
  if (error) {
    return (
      <div className={styles.errorContainer} role="alert">
        <span className={styles.errorIcon} aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <h2>Could not load this course</h2>
        <p>The request did not come back. Check your connection and open it again.</p>
        <Button asChild>
          <Link to="/student/courses"><ArrowLeft size={16} /> Back to courses</Link>
        </Button>
      </div>);

  }

  if (lessonsData && progressData && allLessons.length === 0) {
    return (
      <div className={styles.errorContainer}>
        <h2>No lessons yet</h2>
        <p>The teacher has not added lessons to this course yet. Check back later.</p>
        <Button asChild>
          <Link to="/student/courses"><ArrowLeft size={16} /> Back to courses</Link>
        </Button>
      </div>);

  }

  // Only the first load shows the skeleton; a progress refresh after marking a lesson keeps the lesson playing.
  if (isLessonsPending || isProgressPending || !lessonsData || !progressData || !activeLesson) {
    return <CoursePlayerSkeleton />;
  }

  return (
    <>
      <Helmet>
        <title>{`Learning: ${lessonsData.course.title} | Testkart`}</title>
        <meta name="description" content={`Continue learning ${lessonsData.course.title} on Testkart.`} />
      </Helmet>
      <div className={styles.pageWrapper}>
        <CoursePlayer
          courseData={lessonsData}
          progressData={progressData}
          activeLesson={activeLesson}
          setActiveLesson={setActiveLesson}
          onToggleComplete={handleToggleComplete}
          isCompleting={markCompleteMutation.isPending || markIncompleteMutation.isPending} />

      </div>
    </>);

};

export default StudentCoursePlayerPage;
