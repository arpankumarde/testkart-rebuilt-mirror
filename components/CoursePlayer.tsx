import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Check, CheckCircle, PlayCircle, ChevronLeft, ChevronRight, ChevronDown, X, FileText, HelpCircle, ArrowLeft, AlertCircle, Shield, Star, BookOpen, Clock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { VideoPreview } from './VideoPreview';
import { GumletEmbedPlayer } from './GumletEmbedPlayer';
import { StudentQuizViewer } from './StudentQuizViewer';
import { CourseCompletionCelebration } from './CourseCompletionCelebration';
import { PdfReader } from './PdfReader';
import { ReviewDialog } from './ReviewDialog';
import { useStudentEnrolledCoursesQuery } from '../helpers/useStudentCoursesQuery';
import { useSignedVideoUrl } from '../helpers/useSignedVideoUrl';
import { useProtectedDocument } from '../helpers/useProtectedDocument';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import type { OutputType as LessonsOutputType } from '../endpoints/student/course/lessons_GET.schema';
import type { OutputType as ProgressOutputType } from '../endpoints/student/course/progress_GET.schema';

import styles from './CoursePlayer.module.css';

type Lesson = LessonsOutputType['sections'][0]['lessons'][0];

interface CoursePlayerProps {
  courseData: LessonsOutputType;
  progressData: ProgressOutputType;
  activeLesson: Lesson;
  setActiveLesson: (lesson: Lesson) => void;
  onToggleComplete: (lessonId: number, isCompleted: boolean) => void;
  isCompleting: boolean;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

const LESSON_TYPES: Record<string, { label: string; Icon: IconComponent }> = {
  video: { label: 'Video', Icon: PlayCircle },
  text: { label: 'Reading', Icon: BookOpen },
  quiz: { label: 'Quiz', Icon: HelpCircle },
  pdf: { label: 'PDF', Icon: FileText },
};

const lessonType = (contentType: string) => LESSON_TYPES[contentType] ?? LESSON_TYPES.video;

const formatDuration = (minutes: number | null | undefined): string | null => {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const DESKTOP_QUERY = '(min-width: 1024px)';

const isDesktop = () => typeof window === 'undefined' || window.matchMedia(DESKTOP_QUERY).matches;

const isYouTubeUrl = (url: string): boolean => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

const LessonContent: React.FC<{ 
  lesson: Lesson;
  courseId: number;
  onVideoCompleted: () => void;
  onQuizCompleted: (score: number, total: number) => void;
}> = ({ lesson, courseId, onVideoCompleted, onQuizCompleted }) => {
  const isVideoLesson = lesson.contentType === 'video';
  const isYouTube = isVideoLesson && !!lesson.contentUrl && isYouTubeUrl(lesson.contentUrl);

  // Only fetch signed URL for non-YouTube R2 video lessons
  const { signedUrl, player, gumletState, isLoading: isLoadingSignedUrl, error: signedUrlError } = useSignedVideoUrl({
    courseId: isVideoLesson && !isYouTube ? courseId : null,
    lessonId: isVideoLesson && !isYouTube ? lesson.id : null,
    videoUrl: isVideoLesson && !isYouTube ? lesson.contentUrl : null,
    enabled: isVideoLesson && !isYouTube && !!lesson.contentUrl,
  });

  const isPdfLesson = lesson.contentType === 'pdf';
  // The web never receives a PDF lesson's file link; its pages come rendered and watermarked from the server.
  const { source: pdfSource, isLoading: isLoadingPdf, error: pdfError, refetch: refetchPdf } = useProtectedDocument(
    isPdfLesson ? { type: 'lesson', courseId, lessonId: lesson.id } : null,
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  switch (lesson.contentType) {
    case 'video':
      // YouTube videos: play directly without signing
      if (isYouTube && lesson.contentUrl) {
        return (
          <div className={styles.videoContainer}>
            <VideoPreview
              videoUrl={lesson.contentUrl}
              title={lesson.title}
              className={styles.videoPlayerWrapper}
              mode="player"
              onVideoCompleted={onVideoCompleted}
            />
          </div>
        );
      }

      // R2 videos need a signed URL; DRM videos play only in the Gumlet embed
      if (isLoadingSignedUrl) {
        return (
          <div className={styles.videoContainer}>
            <div className={styles.videoLoadingState}>
              <Shield size={48} className={styles.loadingIcon} />
              <p>Loading secure video...</p>
            </div>
          </div>
        );
      }

      if (player === 'gumlet' && gumletState === 'processing') {
        return (
          <div className={styles.videoContainer}>
            <div className={styles.videoLoadingState}>
              <Shield size={48} className={styles.loadingIcon} />
              <p>This video is being prepared for secure playback. It will start here automatically once it is ready.</p>
            </div>
          </div>
        );
      }

      if (signedUrlError || !signedUrl) {
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>Video Not Available</h2>
            <p>Unable to load video. Please try refreshing the page or contact the course instructor.</p>
          </div>
        );
      }

      if (player === 'gumlet') {
        return (
          <div className={styles.videoContainer} onContextMenu={handleContextMenu}>
            <GumletEmbedPlayer
              key={signedUrl}
              embedUrl={signedUrl}
              title={lesson.title}
              className={styles.videoPlayerWrapper}
              onEnded={onVideoCompleted}
            />
          </div>
        );
      }

      return (
        <div className={styles.videoContainer} onContextMenu={handleContextMenu}>
          <VideoPreview
            videoUrl={signedUrl}
            title={lesson.title}
            className={styles.videoPlayerWrapper}
            mode="player"
            onVideoCompleted={onVideoCompleted}
            controlsList="nodownload"
          />
        </div>
      );
    case 'text':
      return (
        <article className={styles.textContent} dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(lesson.textContent)) }} />
      );
    case 'quiz':
      if (!lesson.textContent) {
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>Quiz Not Available</h2>
            <p>No quiz data found for this lesson. Please contact the course instructor.</p>
          </div>
        );
      }
      try {
        return (
          <div className={styles.quizContainer}>
            <StudentQuizViewer 
              quizData={lesson.textContent} 
              lessonTitle={lesson.title}
              onQuizCompleted={onQuizCompleted}
            />
          </div>
        );
      } catch (error) {
        console.error('Error loading quiz:', error);
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>Error Loading Quiz</h2>
            <p>There was a problem loading this quiz. Please try refreshing the page or contact the course instructor.</p>
          </div>
        );
      }
    case 'pdf':
      return (
        <PdfReader
          key={lesson.id}
          className={styles.pdfReader}
          title={lesson.title}
          source={pdfSource}
          loading={isLoadingPdf}
          error={pdfError ? `${pdfError.message || 'Unable to load this PDF.'} Try again, or contact the course instructor if it keeps failing.` : null}
          onRetry={refetchPdf}
          restricted
          openInNewTabHref={`/student/courses/${courseId}/read/${lesson.id}`}
        />
      );
    default:
      return <div className={styles.textContent}>Unsupported lesson type.</div>;
  }
};

const UpNext: React.FC<{ lesson: Lesson | null; onOpen: (lesson: Lesson) => void }> = ({ lesson, onOpen }) => {
  if (!lesson) return null;
  const { label, Icon } = lessonType(lesson.contentType);
  return (
    <button type="button" className={styles.upNext} onClick={() => onOpen(lesson)}>
      <span className={styles.upNextText}>
        <span className={styles.upNextLabel}>Up next</span>
        <span className={styles.upNextTitle}>{lesson.title}</span>
        <span className={styles.upNextMeta}>
          <Icon size={14} aria-hidden />
          {label}
        </span>
      </span>
      <ChevronRight size={20} className={styles.upNextArrow} aria-hidden="true" />
    </button>
  );
};

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseData,
  progressData,
  activeLesson,
  setActiveLesson,
  onToggleComplete,
  isCompleting,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(() => new Set());
  // Content finished in this visit (video watched to the end or quiz submitted), per lesson
  const [contentCompleted, setContentCompleted] = useState<Record<number, boolean>>({});

  const curriculumRef = useRef<HTMLElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // The student's own review comes from the enrolled-courses list, which the review mutation refreshes,
  // so saving a review never reloads the lessons and interrupts the lesson in progress.
  const enrolledCoursesQuery = useStudentEnrolledCoursesQuery();
  const enrolledCourse = enrolledCoursesQuery.data?.enrolledCourses.find(c => c.id === courseData.course.id);
  const hasReviewed = !!enrolledCourse?.hasReviewed;

  const openReview = () => {
    setShowCelebration(false);
    setIsReviewOpen(true);
  };

  const allLessons = useMemo(() => courseData.sections.flatMap(s => s.lessons), [courseData]);
  const lessonIndexById = useMemo(() => new Map(allLessons.map((l, i) => [l.id, i])), [allLessons]);
  const completedLessonIds = useMemo(() => new Set(progressData.completedLessonIds), [progressData]);

  const totalLessons = allLessons.length;
  // Count only lessons still in the course, so a removed lesson cannot push progress past 100%
  const completedCount = allLessons.filter(l => completedLessonIds.has(l.id)).length;
  const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const activeIndex = lessonIndexById.get(activeLesson.id) ?? 0;
  const activeSection = courseData.sections.find(s => s.id === activeLesson.sectionId);
  const nextLesson = activeIndex < totalLessons - 1 ? allLessons[activeIndex + 1] : null;
  const prevLesson = activeIndex > 0 ? allLessons[activeIndex - 1] : null;
  const isCurrentLessonCompleted = completedLessonIds.has(activeLesson.id);
  const hasContentCompleted = contentCompleted[activeLesson.id] || false;

  // Any lesson can be opened in any order. Marking a video or quiz complete still needs the content finished.
  const canMarkAsComplete =
    isCurrentLessonCompleted ||
    activeLesson.contentType === 'text' ||
    activeLesson.contentType === 'pdf' ||
    hasContentCompleted;

  const markCompleteHint = (() => {
    if (canMarkAsComplete) return '';
    if (activeLesson.contentType === 'video') return 'Watch the full video to mark it complete';
    if (activeLesson.contentType === 'quiz') return 'Submit the quiz to mark it complete';
    return '';
  })();

  // Celebrate when the last lesson gets completed during this visit, however it was completed
  const prevCompletedCountRef = useRef(completedCount);
  useEffect(() => {
    if (totalLessons > 0 && prevCompletedCountRef.current < totalLessons && completedCount === totalLessons) {
      setShowCelebration(true);
    }
    prevCompletedCountRef.current = completedCount;
  }, [completedCount, totalLessons]);

  useEffect(() => {
    setCollapsedSections(prev => {
      if (!prev.has(activeLesson.sectionId)) return prev;
      const next = new Set(prev);
      next.delete(activeLesson.sectionId);
      return next;
    });
    if (contentAreaRef.current) contentAreaRef.current.scrollTop = 0;
  }, [activeLesson.id, activeLesson.sectionId]);

  // Keep the active lesson visible in the curriculum without scrolling anything else on the page
  useEffect(() => {
    const list = curriculumRef.current;
    const row = activeRowRef.current;
    if (!list || !row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < listRect.top) {
      list.scrollTop += rowRect.top - listRect.top - 12;
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTop += rowRect.bottom - listRect.bottom + 12;
    }
  }, [activeLesson.id, isSidebarOpen, collapsedSections]);

  const goToLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    if (!isDesktop()) setIsSidebarOpen(false);
  };

  const toggleSection = (sectionId: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Finishing a video or submitting a quiz completes the lesson; the student stays on it
  const completeFromContent = (lessonId: number) => {
    setContentCompleted(prev => ({ ...prev, [lessonId]: true }));
    if (!completedLessonIds.has(lessonId) && !isCompleting) {
      onToggleComplete(lessonId, false);
    }
  };

  const handleCompleteClick = () => {
    if (isCurrentLessonCompleted) {
      onToggleComplete(activeLesson.id, true);
      return;
    }
    onToggleComplete(activeLesson.id, false);
    if (nextLesson) goToLesson(nextLesson);
  };

  const stageClass =
    activeLesson.contentType === 'video' ? styles.stageVideo
    : activeLesson.contentType === 'text' ? styles.stageText
    : styles.stageFill;

  const activeType = lessonType(activeLesson.contentType);
  const activeDuration = formatDuration(activeLesson.durationMinutes);

  return (
    <>
      {showCelebration && (
        <CourseCompletionCelebration
          courseName={courseData.course.title}
          courseSlug={courseData.course.slug}
          totalLessons={totalLessons}
          onDismiss={() => setShowCelebration(false)}
          onRateCourse={hasReviewed ? undefined : openReview}
        />
      )}
      <ReviewDialog
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        courseId={courseData.course.id}
        testPackageTitle={courseData.course.title}
        initialRating={enrolledCourse?.reviewRating ?? null}
        initialReviewText={enrolledCourse?.reviewText ?? null}
      />
      <div className={`${styles.playerLayout} ${!isSidebarOpen ? styles.sidebarClosed : ''}`}>
        {isSidebarOpen && (
          <div
            className={styles.backdrop}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside className={styles.sidebar} aria-label="Course content">
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarHeaderTop}>
              <Link to="/student/courses" className={styles.backLink}>
                <ArrowLeft size={16} aria-hidden="true" />
                My courses
              </Link>
              <Button variant="ghost" size="icon-sm" onClick={() => setIsSidebarOpen(false)} aria-label="Hide course content">
                <X size={18} />
              </Button>
            </div>
            <h2 className={styles.courseTitle}>{courseData.course.title}</h2>
            <div className={styles.progressBlock}>
              <div className={styles.progressText}>
                <span>
                  <strong>{completedCount}</strong> of {totalLessons} lessons completed
                </span>
                <span className={styles.progressPercent}>{progress}%</span>
              </div>
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-label="Course progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <nav className={styles.curriculum} ref={curriculumRef} aria-label="Lessons">
            {courseData.sections.map(section => {
              const isCollapsed = collapsedSections.has(section.id);
              const sectionDone = section.lessons.filter(l => completedLessonIds.has(l.id)).length;
              const sectionDuration = formatDuration(section.lessons.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0));
              return (
                <div key={section.id} className={styles.section}>
                  <button
                    type="button"
                    className={styles.sectionHeader}
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className={styles.sectionHeading}>
                      <span className={styles.sectionTitle}>{section.title}</span>
                      <span className={styles.sectionMeta}>
                        <span>{sectionDone} of {section.lessons.length} done</span>
                        {sectionDuration && (
                          <span className={styles.metaItem}>
                            <Clock size={12} aria-hidden="true" />
                            {sectionDuration}
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`${styles.sectionChevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
                    />
                  </button>
                  {!isCollapsed && (
                    <ol className={styles.lessonsList}>
                      {section.lessons.map(lesson => {
                        const isCompleted = completedLessonIds.has(lesson.id);
                        const isActive = lesson.id === activeLesson.id;
                        const { label, Icon } = lessonType(lesson.contentType);
                        const duration = formatDuration(lesson.durationMinutes);
                        return (
                          <li key={lesson.id} className={`${styles.lessonRow} ${isCompleted ? styles.railDone : ''}`}>
                            <button
                              type="button"
                              ref={isActive ? activeRowRef : undefined}
                              className={`${styles.lessonItem} ${isActive ? styles.active : ''}`}
                              onClick={() => goToLesson(lesson)}
                              aria-current={isActive ? 'step' : undefined}
                            >
                              <span className={`${styles.lessonMarker} ${isCompleted ? styles.markerDone : ''}`} aria-hidden="true">
                                {isCompleted ? <Check size={14} strokeWidth={3} /> : (lessonIndexById.get(lesson.id) ?? 0) + 1}
                              </span>
                              <span className={styles.lessonDetails}>
                                <span className={styles.lessonTitle}>{lesson.title}</span>
                                <span className={styles.lessonMeta}>
                                  <span className={styles.metaItem}>
                                    <Icon size={13} aria-hidden />
                                    {label}
                                  </span>
                                  {duration && <span>{duration}</span>}
                                  {isCompleted && <span className={styles.srOnly}>Completed</span>}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className={styles.mainContent}>
          <header className={styles.contentHeader}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(open => !open)}
              aria-label={isSidebarOpen ? 'Hide course content' : 'Show course content'}
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </Button>
            <div className={styles.headerText}>
              <span className={styles.headerMeta}>
                <span className={styles.lessonCount}>Lesson {activeIndex + 1} of {totalLessons}</span>
                {activeSection && <span className={styles.headerSection}>{activeSection.title}</span>}
              </span>
              <h1>{activeLesson.title}</h1>
            </div>
            {!enrolledCoursesQuery.isPending && (
              <Button
                variant="outline"
                size="sm"
                className={styles.rateButton}
                onClick={openReview}
                aria-label={hasReviewed ? 'Edit your review of this course' : 'Rate this course'}
              >
                <Star size={16} fill={hasReviewed ? 'currentColor' : 'none'} />
                <span className={styles.rateLabel}>{hasReviewed ? 'Edit review' : 'Rate this course'}</span>
              </Button>
            )}
          </header>

          <div className={styles.contentArea} ref={contentAreaRef}>
            <div className={`${styles.stage} ${stageClass}`}>
              <LessonContent
                key={activeLesson.id}
                lesson={activeLesson}
                courseId={courseData.course.id}
                onVideoCompleted={() => completeFromContent(activeLesson.id)}
                onQuizCompleted={() => completeFromContent(activeLesson.id)}
              />
            </div>

            {activeLesson.contentType === 'video' && (
              <section className={styles.lessonInfo} aria-label="About this lesson">
                <h2 className={styles.lessonInfoTitle}>{activeLesson.title}</h2>
                <div className={styles.lessonInfoMeta}>
                  <span className={styles.metaItem}>
                    <activeType.Icon size={15} aria-hidden />
                    {activeType.label}
                  </span>
                  {activeDuration && (
                    <span className={styles.metaItem}>
                      <Clock size={15} aria-hidden="true" />
                      {activeDuration}
                    </span>
                  )}
                  {isCurrentLessonCompleted && (
                    <span className={`${styles.metaItem} ${styles.doneText}`}>
                      <CheckCircle size={15} aria-hidden="true" />
                      Completed
                    </span>
                  )}
                </div>
                {activeLesson.description && <p className={styles.lessonDescription}>{activeLesson.description}</p>}
                <UpNext lesson={nextLesson} onOpen={goToLesson} />
              </section>
            )}

            {activeLesson.contentType === 'text' && (
              <div className={styles.textFooter}>
                <UpNext lesson={nextLesson} onOpen={goToLesson} />
              </div>
            )}
          </div>

          <footer className={styles.contentFooter}>
            <Button variant="outline" onClick={() => prevLesson && goToLesson(prevLesson)} disabled={!prevLesson} aria-label="Previous lesson">
              <ChevronLeft size={16} />
              <span className={styles.navLabel}>Previous</span>
            </Button>

            <div className={styles.completeButtonWrapper}>
              <Button
                variant={isCurrentLessonCompleted ? 'secondary' : 'primary'}
                onClick={handleCompleteClick}
                disabled={isCompleting || !canMarkAsComplete}
                title={markCompleteHint}
              >
                <CheckCircle size={16} />
                {isCompleting ? 'Updating...' : (isCurrentLessonCompleted ? 'Mark as incomplete' : 'Mark as complete')}
              </Button>
              {markCompleteHint && <span className={styles.completeHint}>{markCompleteHint}</span>}
            </div>

            <Button variant="outline" onClick={() => nextLesson && goToLesson(nextLesson)} disabled={!nextLesson} aria-label="Next lesson">
              <span className={styles.navLabel}>Next</span>
              <ChevronRight size={16} />
            </Button>
          </footer>
        </main>
      </div>
    </>
  );
};
