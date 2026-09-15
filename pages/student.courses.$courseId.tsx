import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStudentCourseLessonsQuery, useStudentCourseProgressQuery } from '../helpers/useStudentCoursesQuery';
import { useCourseEnrollment } from '../helpers/useCourseEnrollment';
import { CoursePlayer } from '../components/CoursePlayer';
import { CoursePlayerSkeleton } from '../components/CoursePlayerSkeleton';
import { Button } from '../components/Button';
import type { OutputType as LessonsOutputType } from '../endpoints/student/course/lessons_GET.schema';
import styles from './student.courses.$courseId.module.css';

type Lesson = LessonsOutputType['sections'][0]['lessons'][0];

const StudentCoursePlayerPage: React.FC = () => {
  const { courseId: courseIdStr } = useParams<{courseId: string;}>();
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : null;

  const { data: lessonsData, isFetching: isFetchingLessons, error: lessonsError } = useStudentCourseLessonsQuery(courseId);
  const { data: progressData, isFetching: isFetchingProgress, error: progressError } = useStudentCourseProgressQuery(courseId);
  const { markCompleteMutation, markIncompleteMutation } = useCourseEnrollment();

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const allLessons = useMemo(() => {
    return lessonsData?.sections.flatMap((section) => section.lessons) ?? [];
  }, [lessonsData]);

  useEffect(() => {
    if (allLessons.length > 0 && progressData) {
      const completedIds = new Set(progressData.completedLessonIds);

      // Find the first incomplete lesson
      const firstIncomplete = allLessons.find((lesson) => !completedIds.has(lesson.id));

      // If an active lesson is already set, don't change it unless it's null
      if (!activeLesson) {
        setActiveLesson(firstIncomplete || allLessons[0]);
      }
    }
  }, [allLessons, progressData, activeLesson]);

  const handleToggleComplete = (lessonId: number, isCompleted: boolean) => {
    // If currently completed, we're unmarking it (use markIncompleteMutation)
    // If currently incomplete, we're marking it complete (use markCompleteMutation)
    const mutation = isCompleted ? markIncompleteMutation : markCompleteMutation;
    
    mutation.mutate({ lessonId }, {
      onSuccess: () => {
        // Only auto-navigate to next lesson when marking as complete
        if (!isCompleted) {
          const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
          if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
            const nextLesson = allLessons[currentIndex + 1];
            setActiveLesson(nextLesson);
          }
        }
      },
      onError: (error) => {
        console.error(`Failed to ${isCompleted ? 'unmark' : 'mark'} lesson:`, error);
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

  if (isFetchingLessons || isFetchingProgress) {
    return <CoursePlayerSkeleton />;
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

  if (!lessonsData || !progressData || !activeLesson) {
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