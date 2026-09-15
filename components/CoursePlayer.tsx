import React, { useState, useMemo, Suspense } from 'react';
import { CheckCircle, Lock, PlayCircle, ChevronLeft, ChevronRight, Menu, X, FileText, HelpCircle, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './Button';
import { VideoPreview } from './VideoPreview';
import { StudentQuizViewer } from './StudentQuizViewer';
import { CourseCompletionCelebration } from './CourseCompletionCelebration';
import { useSignedVideoUrl } from '../helpers/useSignedVideoUrl';
import { useSignedPdfUrl } from '../helpers/useSignedPdfUrl';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import type { OutputType as LessonsOutputType } from '../endpoints/student/course/lessons_GET.schema';
import type { OutputType as ProgressOutputType } from '../endpoints/student/course/progress_GET.schema';

import styles from './CoursePlayer.module.css';

const CoursePlayerPdfViewer = React.lazy(() => import('./CoursePlayerPdfViewer'));

type Lesson = LessonsOutputType['sections'][0]['lessons'][0];

interface CoursePlayerProps {
  courseData: LessonsOutputType;
  progressData: ProgressOutputType;
  activeLesson: Lesson;
  setActiveLesson: (lesson: Lesson) => void;
  onToggleComplete: (lessonId: number, isCompleted: boolean) => void;
  isCompleting: boolean;
}

// Helper to detect YouTube URLs
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
  const { signedUrl, isLoading: isLoadingSignedUrl, error: signedUrlError } = useSignedVideoUrl({
    courseId: isVideoLesson && !isYouTube ? courseId : null,
    lessonId: isVideoLesson && !isYouTube ? lesson.id : null,
    videoUrl: isVideoLesson && !isYouTube ? lesson.contentUrl : null,
    enabled: isVideoLesson && !isYouTube && !!lesson.contentUrl,
  });

  const isPdfLesson = lesson.contentType === 'pdf';
  const { signedUrl: signedPdfUrl, isLoading: isLoadingPdf, error: pdfError } = useSignedPdfUrl({
    courseId: isPdfLesson ? courseId : null,
    lessonId: isPdfLesson ? lesson.id : null,
    enabled: isPdfLesson && !!lesson.contentUrl,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.error('Content download is not allowed');
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

      // R2 videos: require signed URL
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

      if (signedUrlError || !signedUrl) {
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>Video Not Available</h2>
            <p>Unable to load video. Please try refreshing the page or contact the course instructor.</p>
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
        <div className={styles.textContent} dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(lesson.textContent)) }} />
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
      if (!lesson.contentUrl) {
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>PDF Not Available</h2>
            <p>No PDF file found for this lesson. Please contact the course instructor.</p>
          </div>
        );
      }

      if (isLoadingPdf) {
        return (
          <div className={styles.pdfContainer}>
            <div className={styles.pdfLoadingState}>
              <Shield size={48} className={styles.loadingIcon} />
              <p>Loading secure PDF...</p>
            </div>
          </div>
        );
      }

      if (pdfError || !signedPdfUrl) {
        return (
          <div className={styles.errorPlaceholder}>
            <AlertCircle size={48} />
            <h2>PDF Not Available</h2>
            <p>Unable to load PDF. Please try refreshing the page or contact the course instructor.</p>
          </div>
        );
      }

      return (
        <Suspense fallback={<div className={styles.pdfContainer}><div className={styles.pdfLoadingState}><Shield size={48} className={styles.loadingIcon} /><p>Loading PDF viewer...</p></div></div>}>
          <CoursePlayerPdfViewer lesson={lesson} signedUrl={signedPdfUrl} handleContextMenu={handleContextMenu} />
        </Suspense>
      );
    default:
      return <div className={styles.textContent}>Unsupported lesson type.</div>;
  }
};

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseData,
  progressData,
  activeLesson,
  setActiveLesson,
  onToggleComplete,
  isCompleting,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Track content completion (video watched or quiz submitted) per lesson
  const [contentCompleted, setContentCompleted] = useState<Record<number, boolean>>({});

  const allLessons = useMemo(() => courseData.sections.flatMap(s => s.lessons), [courseData]);
  const completedLessonIds = useMemo(() => new Set(progressData.completedLessonIds), [progressData]);

  const totalLessons = allLessons.length;
  const progress = totalLessons > 0 ? (completedLessonIds.size / totalLessons) * 100 : 0;
  
  // Check if course is completed
  const isCourseCompleted = totalLessons > 0 && completedLessonIds.size === totalLessons;

  // Check if a lesson is locked (all previous lessons must be completed)
  const isLessonLocked = (lesson: Lesson): boolean => {
    const lessonIndex = allLessons.findIndex(l => l.id === lesson.id);
    if (lessonIndex === 0) return false; // First lesson is never locked
    
    // Check if all previous lessons are completed
    for (let i = 0; i < lessonIndex; i++) {
      if (!completedLessonIds.has(allLessons[i].id)) {
        return true;
      }
    }
    return false;
  };

  // Check if current active lesson is locked
  const isActiveLessonLocked = isLessonLocked(activeLesson);

  const findNextLesson = () => {
    const currentIndex = allLessons.findIndex(l => l.id === activeLesson.id);
    return currentIndex !== -1 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  };

  const findPrevLesson = () => {
    const currentIndex = allLessons.findIndex(l => l.id === activeLesson.id);
    return currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  };

  const nextLesson = findNextLesson();
  const prevLesson = findPrevLesson();
  const isCurrentLessonCompleted = completedLessonIds.has(activeLesson.id);

  // Check if content has been completed for the active lesson
  const hasContentCompleted = contentCompleted[activeLesson.id] || false;

  // Determine if mark as complete button should be enabled
  const canMarkAsComplete = (() => {
    // If already completed, can always toggle back
    if (isCurrentLessonCompleted) return true;
    
    // For text and PDF, can mark as complete immediately
    if (activeLesson.contentType === 'text' || activeLesson.contentType === 'pdf') {
      return true;
    }
    
    // For video and quiz, must complete content first
    return hasContentCompleted;
  })();

  const getMarkCompleteTooltip = (): string => {
    if (isCurrentLessonCompleted) return '';
    if (activeLesson.contentType === 'video' && !hasContentCompleted) {
      return 'Watch the full video to mark as complete';
    }
    if (activeLesson.contentType === 'quiz' && !hasContentCompleted) {
      return 'Submit the quiz to mark as complete';
    }
    return '';
  };

  const handleLessonClick = (lesson: Lesson) => {
    // Prevent clicking locked lessons
    if (isLessonLocked(lesson)) {
      return;
    }
    
    setActiveLesson(lesson);
    // Auto-close sidebar on mobile after selecting a lesson
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleVideoCompleted = () => {
    setContentCompleted(prev => ({ ...prev, [activeLesson.id]: true }));
  };

  const handleQuizCompleted = (score: number, total: number) => {
    setContentCompleted(prev => ({ ...prev, [activeLesson.id]: true }));
  };

  const getLessonIcon = (lesson: Lesson) => {
    if (isLessonLocked(lesson)) {
      return <Lock size={16} />;
    }
    
    switch (lesson.contentType) {
      case 'video': return <PlayCircle size={16} />;
      case 'text': return <FileText size={16} />;
      case 'quiz': return <HelpCircle size={16} />;
      case 'pdf': return <FileText size={16} />;
      default: return <PlayCircle size={16} />;
    }
  };

  return (
    <>
      {showCelebration && (
        <CourseCompletionCelebration
          courseName={courseData.course.title}
          courseSlug={courseData.course.slug}
          totalLessons={totalLessons}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
      <div className={`${styles.playerLayout} ${!isSidebarOpen ? styles.sidebarClosed : ''}`}>
      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className={styles.backdrop} 
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderTop}>
            <Button variant="ghost" size="icon" className={styles.backButton} asChild>
              <Link to="/student/courses" aria-label="Back to My Courses">
                <ArrowLeft size={20} />
              </Link>
            </Button>
            <h3 className={styles.sidebarTitle}>{courseData.course.title}</h3>
            <Button variant="ghost" size="icon" className={styles.closeSidebarButton} onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
              <X size={20} />
            </Button>
          </div>
          <div className={styles.progressContainer}>
            <span>{Math.round(progress)}% Complete</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className={styles.curriculum}>
          {courseData.sections.map(section => (
            <div key={section.id} className={styles.section}>
              <h4 className={styles.sectionTitle}>{section.title}</h4>
              <ul className={styles.lessonsList}>
                {section.lessons.map(lesson => {
                  const isCompleted = completedLessonIds.has(lesson.id);
                  const isActive = lesson.id === activeLesson.id;
                  const isLocked = isLessonLocked(lesson);
                  return (
                    <li
                      key={lesson.id}
                      className={`${styles.lessonItem} ${isActive ? styles.active : ''} ${isLocked ? styles.locked : ''}`}
                      onClick={() => handleLessonClick(lesson)}
                      title={isLocked ? 'Complete previous lessons to unlock' : ''}
                    >
                      <div className={styles.lessonStatusIcon}>
                        {isCompleted ? (
                          <CheckCircle size={16} className={styles.completedIcon} />
                        ) : (
                          getLessonIcon(lesson)
                        )}
                      </div>
                      <div className={styles.lessonDetails}>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                        <span className={styles.lessonMeta}>{lesson.durationMinutes} min</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.contentHeader}>
          <Button variant="ghost" size="icon" className={styles.menuToggle} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <h1>{activeLesson.title}</h1>
        </div>
        <div className={styles.contentArea}>
          {isActiveLessonLocked ? (
            <div className={styles.lockedContent}>
              <Lock size={64} />
              <h2>Lesson Locked</h2>
              <p>Complete previous lessons to unlock this content</p>
            </div>
          ) : (
            <LessonContent 
              lesson={activeLesson}
              courseId={courseData.course.id}
              onVideoCompleted={handleVideoCompleted}
              onQuizCompleted={handleQuizCompleted}
            />
          )}
        </div>
        <div className={styles.contentFooter}>
          <Button variant="outline" onClick={() => prevLesson && setActiveLesson(prevLesson)} disabled={!prevLesson}>
            <ChevronLeft size={16} /> Previous
          </Button>
          
          <div className={styles.completeButtonWrapper}>
            <Button
              variant={isCurrentLessonCompleted ? 'secondary' : 'primary'}
              onClick={() => {
                onToggleComplete(activeLesson.id, isCurrentLessonCompleted);
                if (!isCurrentLessonCompleted) {
                  if (completedLessonIds.size === totalLessons - 1) {
                    setShowCelebration(true);
                  }
                  // Auto-navigate to next lesson only when marking as complete (not unmarking)
                  if (nextLesson && !isLessonLocked(nextLesson)) {
                    setActiveLesson(nextLesson);
                  }
                }
              }}
              disabled={isCompleting || !canMarkAsComplete || isActiveLessonLocked}
              title={getMarkCompleteTooltip()}
            >
              <CheckCircle size={16} />
              {isCompleting ? 'Updating...' : (isCurrentLessonCompleted ? 'Mark as Incomplete' : 'Mark as Complete')}
            </Button>
            {!canMarkAsComplete && !isCurrentLessonCompleted && !isActiveLessonLocked && (
              <span className={styles.completeHint}>{getMarkCompleteTooltip()}</span>
            )}
          </div>
          
          {isCurrentLessonCompleted && (
            <Button 
              variant="outline" 
              onClick={() => nextLesson && setActiveLesson(nextLesson)} 
              disabled={!nextLesson || (nextLesson && isLessonLocked(nextLesson))}
            >
              Next <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </main>
    </div>
    </>
  );
};