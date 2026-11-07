import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Clock, ArrowLeft, ArrowRight, Lock, Eraser, Info, Flag, PanelRightClose, PanelRightOpen, Pause } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { useIsMobile } from '../helpers/useIsMobile';
import { MathMLContent } from './MathMLContent';
import { ScientificCalculator } from './ScientificCalculator';
import { QuestionData, QuestionAnswer } from '../helpers/questionAnswerTypes';
import {
  ExtendedQuestionData,
  SubjectTimerState,
  castToExtendedQuestions,
  buildSubjectGroups,
  buildSubjectStats,
  isQuestionLocked,
  isSubjectSubmitted,
} from '../helpers/testingInterfaceTypes';
import { QuestionRenderer } from './QuestionRenderer';
import { TestingInterfacePalette } from './TestingInterfacePalette';
import { TestingInterfaceSubmitDialog } from './TestingInterfaceSubmitDialog';
import { SubjectSubmitDialog } from './SubjectSubmitDialog';
import styles from './TestingInterface.module.css';

interface TestingInterfaceProps {
  testItemTitle: string;
  teacherName: string;
  questions: QuestionData[];
  answers: Map<number, QuestionAnswer>;
  timeRemaining: number;
  currentQuestionIndex: number;
  onAnswerChange: (questionId: number, answer: QuestionAnswer | undefined) => void;
  onQuestionNavigate: (index: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  calculatorEnabled: boolean;
  markedForReview?: Set<number>;
  visitedQuestionIds?: Set<number>;
  onToggleMarkForReview?: (questionId: number) => void;
  // Subject-wise timing
  subjectWiseTiming?: boolean;
  subjectTimerStates?: SubjectTimerState;
  onSubjectSubmit?: (subjectName: string) => void;
  activeSubjectName?: string;
  // Question-wise timing
  questionWiseTiming?: boolean;
  questionTimerSeconds?: number;
  expiredQuestionIds?: Set<number>;
  isNoTimeLimit?: boolean;
  // Saves the attempt and leaves; the student can resume it later
  onPause?: () => void;
  // Lets the caller open the submit dialog itself (a live test opens it once every limit is reached)
  submitDialogOpen?: boolean;
  onSubmitDialogOpenChange?: (open: boolean) => void;
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

const hasNamedSections = (group: { sections: { id: number | null }[] } | undefined) =>
  !!group && (group.sections.length > 1 || (group.sections.length === 1 && group.sections[0].id !== null));

export const TestingInterface: React.FC<TestingInterfaceProps> = ({
  testItemTitle,
  teacherName,
  questions: rawQuestions,
  answers,
  timeRemaining,
  currentQuestionIndex,
  onAnswerChange,
  onQuestionNavigate,
  onSubmit,
  isSubmitting,
  calculatorEnabled,
  markedForReview = new Set(),
  visitedQuestionIds = new Set(),
  onToggleMarkForReview = () => {},
  subjectWiseTiming = false,
  subjectTimerStates = {},
  onSubjectSubmit,
  activeSubjectName: externalActiveSubjectName,
  questionWiseTiming = false,
  questionTimerSeconds,
  expiredQuestionIds = new Set(),
  isNoTimeLimit = false,
  onPause,
  submitDialogOpen,
  onSubmitDialogOpenChange,
}) => {
  const [internalSubmitDialogOpen, setInternalSubmitDialogOpen] = useState(false);
  const isSubmitDialogOpen = submitDialogOpen ?? internalSubmitDialogOpen;
  const setIsSubmitDialogOpen = (open: boolean) => {
    if (onSubmitDialogOpenChange) onSubmitDialogOpenChange(open);
    else setInternalSubmitDialogOpen(open);
  };
  const [isSubjectSubmitDialogOpen, setIsSubjectSubmitDialogOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  // Desktop only: the side palette folds to a rail so the question gets the width.
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const paletteRegionId = useId();
  const isMobile = useIsMobile();
  const mobileButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cast questions to extended type (endpoint returns extra fields not in base QuestionData)
  const questions = useMemo(() => castToExtendedQuestions(rawQuestions), [rawQuestions]);

  // Build subject groups with nested sections
  const subjectGroups = useMemo(() => buildSubjectGroups(questions), [questions]);

  // Determine current subject based on current question index
  const currentQuestion: ExtendedQuestionData | undefined = questions[currentQuestionIndex];
  const currentSubjectName = currentQuestion?.subjectName || 'General Questions';

  const [selectedSubject, setSelectedSubject] = useState<string>(currentSubjectName);

  // Update selected subject when navigating to a different question's subject
  useEffect(() => {
    if (!subjectWiseTiming && currentSubjectName !== selectedSubject) {
      setSelectedSubject(currentSubjectName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, currentSubjectName, subjectWiseTiming]);

  // When subject-wise timing is active and the active subject changes externally
  // (e.g. after a subject expires), sync the selected subject
  useEffect(() => {
    if (subjectWiseTiming && externalActiveSubjectName && externalActiveSubjectName !== selectedSubject) {
      setSelectedSubject(externalActiveSubjectName);
    }
  }, [subjectWiseTiming, externalActiveSubjectName, selectedSubject]);

  // Get current subject group
  const currentSubjectGroup = useMemo(
    () => subjectGroups.find(group => group.name === selectedSubject) ?? subjectGroups[0],
    [subjectGroups, selectedSubject]
  );

  // Flat list of questions for the selected subject (ordered by section then question)
  const currentSubjectQuestions = currentSubjectGroup?.questions ?? [];

  // Set of answered question IDs for efficient lookups
  const answeredIds = useMemo(() => new Set(answers.keys()), [answers]);

  // Subject stats for palette and submit dialog
  const subjectStats = useMemo(
    () => buildSubjectStats(subjectGroups, answeredIds, subjectWiseTiming ? subjectTimerStates : undefined),
    [subjectGroups, answeredIds, subjectWiseTiming, subjectTimerStates]
  );

  // Index of current question within its subject's flat list
  const currentQuestionIndexInSubject = useMemo(
    () => currentSubjectQuestions.findIndex(q => q.id === currentQuestion?.id),
    [currentSubjectQuestions, currentQuestion]
  );

  // Index of current subject in the groups array
  const currentSubjectIndex = useMemo(
    () => subjectGroups.findIndex(group => group.name === selectedSubject),
    [subjectGroups, selectedSubject]
  );

  // Determine whether the current question is locked due to attempt limits
  const currentQuestionLocked = useMemo(() => {
    if (!currentQuestion || !currentSubjectGroup) return false;
    // Lock if the subject itself is submitted (subject-wise timing)
    if (subjectWiseTiming && isSubjectSubmitted(selectedSubject, subjectTimerStates)) return true;
    // Lock if question has expired (question-wise timing)
    if (questionWiseTiming && expiredQuestionIds.has(currentQuestion.id)) return true;
    return isQuestionLocked(currentQuestion, currentSubjectGroup, answeredIds);
  }, [currentQuestion, currentSubjectGroup, answeredIds, subjectWiseTiming, selectedSubject, subjectTimerStates, questionWiseTiming, expiredQuestionIds]);

  // Whether the currently selected subject is submitted (subject-wise timing)
  const isCurrentSubjectSubmitted = subjectWiseTiming
    ? isSubjectSubmitted(selectedSubject, subjectTimerStates)
    : false;

  // Auto-hide header on scroll (mobile only)
  useEffect(() => {
    if (!isMobile) {
      setIsHeaderCollapsed(false);
      return;
    }

    let touchStartY = 0;
    let lastScroll = document.scrollingElement?.scrollTop ?? window.scrollY;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 30) {
        setIsHeaderCollapsed(true);
      } else if (e.deltaY < -20) {
        setIsHeaderCollapsed(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const delta = touchStartY - currentY;
      if (delta > 30) {
        setIsHeaderCollapsed(true);
        touchStartY = currentY;
      } else if (delta < -20) {
        setIsHeaderCollapsed(false);
        touchStartY = currentY;
      }
    };

    const handleScroll = () => {
      const currentScrollY = document.scrollingElement?.scrollTop ?? window.scrollY;
      if (currentScrollY > lastScroll + 30) {
        setIsHeaderCollapsed(true);
        lastScroll = currentScrollY;
      } else if (currentScrollY < lastScroll - 10 || currentScrollY <= 0) {
        setIsHeaderCollapsed(false);
        lastScroll = currentScrollY;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile]);

  // Auto-scroll current question into view in mobile palette
  useEffect(() => {
    if (
      isMobile &&
      currentQuestionIndexInSubject >= 0 &&
      mobileButtonRefs.current[currentQuestionIndexInSubject]
    ) {
      mobileButtonRefs.current[currentQuestionIndexInSubject]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentQuestionIndexInSubject, isMobile, selectedSubject]);

  // Block right-click and keyboard shortcuts during testing
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'p')) ||
        e.key === 'PrintScreen' ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSubmitConfirm = () => {
    setIsSubmitDialogOpen(false);
    onSubmit();
  };

  const handleSubjectSubmitConfirm = () => {
    setIsSubjectSubmitDialogOpen(false);
    onSubjectSubmit?.(selectedSubject);
  };

  /**
   * Navigate to a subject, skipping submitted ones if subjectWiseTiming is true.
   */
  const handleSubjectChange = (subjectName: string) => {
    // Prevent navigating to different subjects in subject-wise timing mode
    if (subjectWiseTiming && subjectName !== externalActiveSubjectName) {
      console.log('[handleSubjectChange] Blocked navigation to different subject:', subjectName);
      return;
    }
    setSelectedSubject(subjectName);
    const subjectGroup = subjectGroups.find(g => g.name === subjectName);
    if (subjectGroup && subjectGroup.questions.length > 0) {
      const firstQuestion = subjectGroup.questions[0];
      const globalIndex = questions.findIndex(q => q.id === firstQuestion.id);
      if (globalIndex >= 0) {
        onQuestionNavigate(globalIndex);
      }
    }
  };

  const handleQuestionNavigateInSubject = (indexInSubject: number) => {
    const question = currentSubjectQuestions[indexInSubject];
    if (question) {
      const globalIndex = questions.findIndex(q => q.id === question.id);
      if (globalIndex >= 0) {
        onQuestionNavigate(globalIndex);
      }
    }
  };

  /**
   * Find the next subject index that is not submitted.
   */
  const findNextUnsubmittedSubjectIndex = (fromIndex: number, direction: 1 | -1): number => {
    if (subjectWiseTiming) return -1; // Never cross subject boundaries automatically
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < subjectGroups.length) {
      const subject = subjectGroups[idx];
      if (!subjectWiseTiming || !isSubjectSubmitted(subject.name, subjectTimerStates)) {
        return idx;
      }
      idx += direction;
    }
    return -1;
  };

  const handleNext = () => {
    const isLastInSubject = currentQuestionIndexInSubject === currentSubjectQuestions.length - 1;
    if (isLastInSubject) {
      if (subjectWiseTiming) return;
      const nextSubjectIndex = findNextUnsubmittedSubjectIndex(currentSubjectIndex, 1);
      if (nextSubjectIndex >= 0) {
        const nextSubject = subjectGroups[nextSubjectIndex];
        setSelectedSubject(nextSubject.name);
        const firstQuestion = nextSubject.questions[0];
        const globalIndex = questions.findIndex(q => q.id === firstQuestion.id);
        if (globalIndex >= 0) {
          onQuestionNavigate(globalIndex);
        }
      }
    } else {
      handleQuestionNavigateInSubject(currentQuestionIndexInSubject + 1);
    }
  };

  const handleMarkForReviewAndNext = () => {
    if (currentQuestion) {
      onToggleMarkForReview(currentQuestion.id);
      handleNext();
    }
  };

  const handlePrevious = () => {
    const isFirstInSubject = currentQuestionIndexInSubject === 0;
    if (isFirstInSubject) {
      if (subjectWiseTiming) return;
      const prevSubjectIndex = findNextUnsubmittedSubjectIndex(currentSubjectIndex, -1);
      if (prevSubjectIndex >= 0) {
        const prevSubject = subjectGroups[prevSubjectIndex];
        setSelectedSubject(prevSubject.name);
        const lastQuestion = prevSubject.questions[prevSubject.questions.length - 1];
        const globalIndex = questions.findIndex(q => q.id === lastQuestion.id);
        if (globalIndex >= 0) {
          onQuestionNavigate(globalIndex);
        }
      }
    } else {
      handleQuestionNavigateInSubject(currentQuestionIndexInSubject - 1);
    }
  };

  // First question: first question index AND no previous unsubmitted subject
  const isFirstQuestion = subjectWiseTiming
    ? currentQuestionIndexInSubject === 0
    : currentQuestionIndexInSubject === 0 && findNextUnsubmittedSubjectIndex(currentSubjectIndex, -1) === -1;

  // Last question: last question in subject AND no next unsubmitted subject
  const isLastQuestion = subjectWiseTiming
    ? false
    : currentQuestionIndexInSubject === currentSubjectQuestions.length - 1 && findNextUnsubmittedSubjectIndex(currentSubjectIndex, 1) === -1;

  const maxAttemptsInfoMessage = useMemo(() => {
    if (!currentQuestion || !currentSubjectGroup) return null;

    const section = currentSubjectGroup.sections.find(s => s.id === currentQuestion.sectionId);
    if (section && section.maxAttemptsAllowed !== null && section.maxAttemptsAllowed !== undefined) {
      const answered = section.questions.filter(q => answeredIds.has(q.id)).length;
      return `Answer any ${section.maxAttemptsAllowed} of ${section.questions.length} in ${section.name}. ${answered} answered so far.`;
    }

    if (currentSubjectGroup.maxAttemptsAllowed !== null && currentSubjectGroup.maxAttemptsAllowed !== undefined) {
      const answered = currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length;
      return `Answer any ${currentSubjectGroup.maxAttemptsAllowed} of ${currentSubjectGroup.questions.length} in ${currentSubjectGroup.name}. ${answered} answered so far.`;
    }

    return null;
  }, [currentQuestion, currentSubjectGroup, answeredIds]);

  const lockBannerMessage = useMemo(() => {
    if (!currentQuestion || !currentSubjectGroup) return null;

    if (subjectWiseTiming && isCurrentSubjectSubmitted) {
      return 'This subject is submitted, so its answers are locked.';
    }

    if (questionWiseTiming && expiredQuestionIds.has(currentQuestion.id)) {
      return "Time's up for this question, so it is locked.";
    }

    if (!currentQuestionLocked) return null;

    const section = currentSubjectGroup.sections.find(s => s.id === currentQuestion.sectionId);
    if (section?.maxAttemptsAllowed !== null && section?.maxAttemptsAllowed !== undefined) {
      const answered = section.questions.filter(q => answeredIds.has(q.id)).length;
      return `You have answered the most allowed in this section (${answered}/${section.maxAttemptsAllowed}). Clear an answer to pick this one instead.`;
    }

    if (currentSubjectGroup.maxAttemptsAllowed !== null) {
      const answered = currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length;
      return `You have answered the most allowed in this subject (${answered}/${currentSubjectGroup.maxAttemptsAllowed}). Clear an answer to pick this one instead.`;
    }

    return null;
  }, [
    currentQuestionLocked,
    currentQuestion,
    currentSubjectGroup,
    answeredIds,
    subjectWiseTiming,
    isCurrentSubjectSubmitted,
    questionWiseTiming,
    expiredQuestionIds,
  ]);

  // Timer display for subject-wise mode
  const subjectTimerDisplay = useMemo(() => {
    if (!subjectWiseTiming) return null;
    const state = subjectTimerStates[selectedSubject];
    if (!state) return null;
    return {
      remaining: state.remaining,
      isSubmitted: state.submitted,
    };
  }, [subjectWiseTiming, subjectTimerStates, selectedSubject]);

  // Calm until the last five minutes, then butter, then peach for the final minute.
  const timerToneClass = (seconds: number, soonAt = 300, urgentAt = 60) =>
    seconds <= urgentAt ? styles.timerUrgent : seconds <= soonAt ? styles.timerSoon : '';

  const prevDisabled = questionWiseTiming || isFirstQuestion || (subjectWiseTiming && isCurrentSubjectSubmitted && currentQuestionIndexInSubject === 0);
  const nextDisabled = subjectWiseTiming && currentQuestionIndexInSubject === currentSubjectQuestions.length - 1;
  const clearDisabled = !currentQuestion || !answers.has(currentQuestion.id) || currentQuestionLocked || isCurrentSubjectSubmitted;
  const isCurrentMarked = currentQuestion ? markedForReview.has(currentQuestion.id) : false;
  const isAnswerLocked = currentQuestionLocked || isCurrentSubjectSubmitted;

  const showNextSubjectBtn = subjectWiseTiming && currentQuestionIndexInSubject === currentSubjectQuestions.length - 1 && !isCurrentSubjectSubmitted;

  const answeredTotal = answers.size;
  const answeredPercent = questions.length > 0 ? Math.round((answeredTotal / questions.length) * 100) : 0;

  const currentSectionName = useMemo(() => {
    if (!currentQuestion || !hasNamedSections(currentSubjectGroup)) return null;
    return currentSubjectGroup?.sections.find(s => s.id === currentQuestion.sectionId)?.name ?? null;
  }, [currentQuestion, currentSubjectGroup]);

  const navigationButtons = (
    <div className={styles.navigationButtons}>
      <Button
        variant="outline"
        onClick={handlePrevious}
        disabled={prevDisabled}
        className={styles.navButtonIconOnly}
        aria-label="Previous question"
      >
        <ArrowLeft size={16} /> <span className={styles.navText}>Previous</span>
      </Button>
      <div className={styles.navButtonsRight}>
        <Button
          variant="ghost"
          onClick={() => currentQuestion && onAnswerChange(currentQuestion.id, undefined)}
          disabled={clearDisabled}
          className={styles.clearBtn}
        >
          <Eraser size={16} /> <span className={styles.navText}>Clear response</span><span className={styles.mobileNavText}>Clear</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleMarkForReviewAndNext}
          disabled={!currentQuestion || isAnswerLocked}
          className={`${styles.reviewBtn} ${isCurrentMarked ? styles.markedReviewBtn : ''}`}
          aria-pressed={isCurrentMarked}
        >
          <Flag size={16} fill={isCurrentMarked ? 'currentColor' : 'none'} />
          <span className={styles.navText}>{isCurrentMarked ? 'Unmark & next' : 'Mark for review & next'}</span>
          <span className={styles.mobileNavText}>{isCurrentMarked ? 'Unmark' : 'Review'}</span>
        </Button>
        {isLastQuestion ? (
          <Button variant="destructive" onClick={() => setIsSubmitDialogOpen(true)} className={`${styles.nextBtn} ${styles.submitBtn}`}>
            <span className={styles.navText}>Submit test</span><span className={styles.mobileNavText}>Submit</span>
          </Button>
        ) : showNextSubjectBtn ? (
          <Button onClick={() => setIsSubjectSubmitDialogOpen(true)} className={styles.nextBtn}>
            <span className={styles.navText}>Next subject</span><span className={styles.mobileNavText}>Next subject</span> <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={nextDisabled} className={styles.nextBtn}>
            <span className={styles.navText}>Save & next</span><span className={styles.mobileNavText}>Next</span> <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );

  const paletteProps = {
    subjectStats,
    subjectGroups,
    selectedSubject,
    currentSubjectIndex,
    currentQuestion,
    answeredIds,
    markedForReview,
    visitedQuestionIds,
    onSubjectChange: handleSubjectChange,
    onQuestionNavigateInSubject: handleQuestionNavigateInSubject,
    subjectWiseTiming,
    subjectTimerStates,
    questionWiseTiming,
    expiredQuestionIds,
  };

  return (
    <div className={`${styles.testingContainer} ${styles.noSelect} tk-student tk-flow`}>
      {/* Anti-cheating watermark */}
      <div className={styles.watermark} aria-hidden="true">
        <div className={styles.watermarkText}>{teacherName} | Testkart</div>
      </div>

      <header className={`${styles.testHeader} ${isHeaderCollapsed && isMobile ? styles.headerCollapsed : ''}`}>
        <div className={styles.headerMain}>
          <div className={styles.headerLeft}>
            <h1 className={styles.testTitle} title={testItemTitle}>{testItemTitle}</h1>
            {subjectGroups.length > 1 && (
              <span className={styles.subjectChip}>{selectedSubject}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <div className={styles.timersWrapper} role="timer">
              {questionWiseTiming && questionTimerSeconds !== undefined && (
                <div className={`${styles.timer} ${styles.timerSmall} ${timerToneClass(questionTimerSeconds, 20, 10)}`}>
                  <span className={styles.timerLabel}>This question</span>
                  <span className={styles.timerValue}>{formatTime(questionTimerSeconds)}</span>
                </div>
              )}
              {subjectWiseTiming && subjectTimerDisplay ? (
                <div className={`${styles.timer} ${subjectTimerDisplay.isSubmitted ? styles.timerDone : timerToneClass(subjectTimerDisplay.remaining)}`}>
                  <Clock size={18} aria-hidden="true" />
                  <span className={styles.timerLabel}>Subject</span>
                  <span className={styles.timerValue}>{subjectTimerDisplay.isSubmitted ? 'Done' : formatTime(subjectTimerDisplay.remaining)}</span>
                </div>
              ) : (
                <div className={`${styles.timer} ${questionWiseTiming ? styles.timerSmall : ''} ${isNoTimeLimit ? '' : timerToneClass(timeRemaining)}`}>
                  <Clock size={18} aria-hidden="true" />
                  <span className={styles.timerLabel}>
                    {isNoTimeLimit ? 'Time taken' : questionWiseTiming ? 'Overall' : 'Time left'}
                  </span>
                  <span className={styles.timerValue}>{formatTime(timeRemaining)}</span>
                </div>
              )}
            </div>
            <div className={styles.headerActions}>
              {subjectWiseTiming && !isCurrentSubjectSubmitted && onSubjectSubmit && (
                <Button variant="outline" size="sm" onClick={() => setIsSubjectSubmitDialogOpen(true)} className={styles.headerBtn}>
                  Submit subject
                </Button>
              )}
              {onPause && (
                <Button variant="outline" size="sm" onClick={onPause} disabled={isSubmitting} className={styles.headerBtn}>
                  <Pause size={14} /> Pause
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setIsSubmitDialogOpen(true)} className={`${styles.headerBtn} ${styles.submitBtn}`}>
                Submit test
              </Button>
            </div>
          </div>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredTotal}
          aria-valuetext={`${answeredTotal} of ${questions.length} answered`}
        >
          <span className={styles.progressFill} style={{ width: `${answeredPercent}%` }} />
        </div>
        {isMobile && (
          <div className={styles.mobilePaletteWrapper}>
            <TestingInterfacePalette
              variant="mobile"
              collapsed={isHeaderCollapsed}
              mobileButtonRefs={mobileButtonRefs}
              {...paletteProps}
            />
          </div>
        )}
      </header>

      <main className={styles.testBody}>
        <section className={styles.questionArea} aria-label="Question">
          <div className={styles.questionScrollArea}>
            {currentQuestion && (
              <article key={currentQuestion.id} className={styles.questionCard}>
                <div className={styles.questionMeta}>
                  <span className={styles.questionCounter}>
                    Question {currentQuestionIndexInSubject + 1}
                    <span className={styles.questionCounterOf}> of {currentSubjectQuestions.length}</span>
                  </span>
                  {currentSectionName && <span className={styles.sectionChip}>{currentSectionName}</span>}
                  {(currentQuestion.positiveMarks != null || currentQuestion.negativeMarks != null) && (
                    <span className={styles.marks} aria-label="Marks for this question">
                      {currentQuestion.positiveMarks != null && (
                        <span className={styles.positiveMarks}>+{currentQuestion.positiveMarks}</span>
                      )}
                      {currentQuestion.negativeMarks != null && (
                        <span className={styles.negativeMarks}>-{currentQuestion.negativeMarks}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className={styles.questionText}>
                  <MathMLContent html={currentQuestion.questionText} />
                </div>
                {maxAttemptsInfoMessage && !(isAnswerLocked && lockBannerMessage) && (
                  <div className={styles.maxAttemptsInfoBanner}>
                    <Info size={16} aria-hidden="true" />
                    <span>{maxAttemptsInfoMessage}</span>
                  </div>
                )}
                {isAnswerLocked && lockBannerMessage && (
                  <div className={styles.lockBanner} role="status">
                    <Lock size={16} aria-hidden="true" />
                    <span>{lockBannerMessage}</span>
                  </div>
                )}
                <div className={isAnswerLocked ? styles.lockedQuestion : undefined}>
                  <QuestionRenderer
                    question={currentQuestion}
                    answer={answers.get(currentQuestion.id)}
                    onAnswerChange={(answer) => onAnswerChange(currentQuestion.id, answer)}
                  />
                </div>
              </article>
            )}
          </div>
          {!isMobile && navigationButtons}
        </section>

        {!isMobile && (
          <aside
            className={`${styles.paletteDock} ${isPaletteCollapsed ? styles.paletteDockCollapsed : ''}`}
            aria-label="Question palette"
          >
            {/* Stays mounted while collapsed, so counts and scroll position survive a toggle. */}
            <div id={paletteRegionId} className={styles.paletteDockInner}>
              <div className={styles.paletteDockBar}>
                <span className={styles.paletteDockTitle}>All questions</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsPaletteCollapsed(true)}
                  aria-expanded={true}
                  aria-controls={paletteRegionId}
                  aria-label="Hide question palette"
                  title="Hide question palette"
                >
                  <PanelRightClose size={16} />
                </Button>
              </div>
              <TestingInterfacePalette variant="desktop" {...paletteProps} />
            </div>
            {isPaletteCollapsed && (
              <div className={styles.paletteRail}>
                <button
                  type="button"
                  className={styles.paletteRailButton}
                  onClick={() => setIsPaletteCollapsed(false)}
                  aria-expanded={false}
                  aria-controls={paletteRegionId}
                  aria-label="Show question palette"
                  title="Show question palette"
                >
                  <PanelRightOpen size={18} aria-hidden="true" />
                  <span className={styles.paletteRailLabel} aria-hidden="true">All questions</span>
                </button>
              </div>
            )}
          </aside>
        )}
      </main>

      {isMobile && (
        <footer className={styles.navigationFooter}>
          {navigationButtons}
        </footer>
      )}

      <TestingInterfaceSubmitDialog
        open={isSubmitDialogOpen}
        onOpenChange={setIsSubmitDialogOpen}
        totalQuestions={questions.length}
        answeredCount={answeredTotal}
        markedCount={markedForReview.size}
        subjectGroups={subjectStats}
        isSubmitting={isSubmitting}
        onConfirm={handleSubmitConfirm}
      />
      {subjectWiseTiming && onSubjectSubmit && (
        <SubjectSubmitDialog
          open={isSubjectSubmitDialogOpen}
          onOpenChange={setIsSubjectSubmitDialogOpen}
          subjectName={selectedSubject}
          totalQuestions={currentSubjectQuestions.length}
          answeredCount={currentSubjectQuestions.filter(q => answeredIds.has(q.id)).length}
          onConfirm={handleSubjectSubmitConfirm}
        />
      )}

      <ScientificCalculator isEnabled={calculatorEnabled} />
    </div>
  );
};

export const TestingSkeleton = () => (
  <div className={`${styles.testingContainer} tk-student`}>
    <header className={styles.testHeader}>
      <div className={styles.headerMain}>
        <div className={styles.headerLeft}>
          <Skeleton style={{ width: '240px', height: '1.5rem' }} />
        </div>
        <div className={styles.headerRight}>
          <Skeleton style={{ width: '120px', height: '2.5rem' }} />
          <Skeleton style={{ width: '110px', height: '2.25rem' }} />
        </div>
      </div>
    </header>
    <main className={styles.testBody}>
      <div className={styles.questionArea}>
        <div className={styles.questionScrollArea}>
          <div className={styles.questionCard}>
            <Skeleton style={{ width: '120px', height: '1.25rem', marginBottom: 'var(--spacing-4)' }} />
            <Skeleton style={{ width: '85%', height: '1.75rem', marginBottom: 'var(--spacing-6)' }} />
            <div className={styles.skeletonOptions}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} style={{ width: '100%', height: '3.25rem', borderRadius: '0.875rem' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.paletteSkeletonWrap}>
        <Skeleton style={{ width: '120px', height: '1.25rem', marginBottom: 'var(--spacing-4)' }} />
        <div className={styles.paletteGridSkeleton}>
          {[...Array(20)].map((_, i) => (
            <Skeleton key={i} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem' }} />
          ))}
        </div>
      </div>
    </main>
  </div>
);
