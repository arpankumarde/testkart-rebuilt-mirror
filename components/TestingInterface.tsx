import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, ArrowLeft, ArrowRight, Lock, Eraser, Info, Flag } from 'lucide-react';
import { Button } from './Button';
import { Dialog, DialogTrigger } from './Dialog';
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
}

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
}) => {
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isSubjectSubmitDialogOpen, setIsSubjectSubmitDialogOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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
      return `📝 You can attempt ${section.maxAttemptsAllowed} out of ${section.questions.length} questions in ${section.name}. (${answered} answered so far)`;
    }

    if (currentSubjectGroup.maxAttemptsAllowed !== null && currentSubjectGroup.maxAttemptsAllowed !== undefined) {
      const answered = currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length;
      return `📝 You can attempt ${currentSubjectGroup.maxAttemptsAllowed} out of ${currentSubjectGroup.questions.length} questions in ${currentSubjectGroup.name}. (${answered} answered so far)`;
    }

    return null;
  }, [currentQuestion, currentSubjectGroup, answeredIds]);

  // Build lock banner message when applicable
  const lockBannerMessage = useMemo(() => {
    if (!currentQuestion || !currentSubjectGroup) return null;

    // Subject-wise timing: subject is submitted
    if (subjectWiseTiming && isCurrentSubjectSubmitted) {
      return `This subject has been submitted and is now locked.`;
    }

    // Question-wise timing: question is expired
    if (questionWiseTiming && expiredQuestionIds.has(currentQuestion.id)) {
      return `Time's up for this question. It is now locked.`;
    }

    if (!currentQuestionLocked) return null;

    // Check section-level limit
    const section = currentSubjectGroup.sections.find(s => s.id === currentQuestion.sectionId);
    if (section?.maxAttemptsAllowed !== null && section?.maxAttemptsAllowed !== undefined) {
      const answered = section.questions.filter(q => answeredIds.has(q.id)).length;
      return `You have reached the maximum attempts for this section (${answered}/${section.maxAttemptsAllowed}).`;
    }

    // Subject-level limit fallback
    if (currentSubjectGroup.maxAttemptsAllowed !== null) {
      const answered = currentSubjectGroup.questions.filter(q => answeredIds.has(q.id)).length;
      return `You have reached the maximum attempts for this subject (${answered}/${currentSubjectGroup.maxAttemptsAllowed}).`;
    }

    return null;
  }, [
    currentQuestionLocked,
    currentQuestion,
    currentSubjectGroup,
    answeredIds,
    subjectWiseTiming,
    isCurrentSubjectSubmitted,
  ]);

  // Timer display for subject-wise mode
  const subjectTimerDisplay = useMemo(() => {
    if (!subjectWiseTiming) return null;
    const state = subjectTimerStates[selectedSubject];
    if (!state) return null;
    return {
      remaining: state.remaining,
      isWarning: state.remaining < 300,
      isSubmitted: state.submitted,
    };
  }, [subjectWiseTiming, subjectTimerStates, selectedSubject]);

  const prevDisabled = questionWiseTiming || isFirstQuestion || (subjectWiseTiming && isCurrentSubjectSubmitted && currentQuestionIndexInSubject === 0);
  const nextDisabled = subjectWiseTiming && currentQuestionIndexInSubject === currentSubjectQuestions.length - 1;
  const clearDisabled = !currentQuestion || !answers.has(currentQuestion.id) || currentQuestionLocked || isCurrentSubjectSubmitted;
  const isCurrentMarked = currentQuestion ? markedForReview.has(currentQuestion.id) : false;

  const showNextSubjectBtn = subjectWiseTiming && currentQuestionIndexInSubject === currentSubjectQuestions.length - 1 && !isCurrentSubjectSubmitted;

  const navigationButtons = (
    <div className={styles.navigationButtons}>
      <Button variant="outline" onClick={handlePrevious} disabled={prevDisabled} className={styles.navButtonIconOnly}>
        <ArrowLeft size={16} /> <span className={styles.navText}>Previous</span>
      </Button>
      <div className={styles.navButtonsRight}>
        <Button
          variant="outline"
          onClick={handleMarkForReviewAndNext}
          disabled={!currentQuestion || currentQuestionLocked || isCurrentSubjectSubmitted}
          className={isCurrentMarked ? styles.markedReviewBtn : ''}
        >
          <Flag size={16} fill={isCurrentMarked ? "currentColor" : "none"} />
          <span className={styles.navText}>{isCurrentMarked ? 'Unmark & Next' : 'Mark for Review & Next'}</span>
          <span className={styles.mobileNavText}>Review</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => currentQuestion && onAnswerChange(currentQuestion.id, undefined)} 
          disabled={clearDisabled}
        >
          <Eraser size={16} /> <span className={styles.navText}>Clear Response</span><span className={styles.mobileNavText}>Clear</span>
        </Button>
        {isLastQuestion ? (
          <Button variant="destructive" onClick={() => setIsSubmitDialogOpen(true)}>
            <span className={styles.navText}>Submit Test</span><span className={styles.mobileNavText}>Submit</span>
          </Button>
        ) : showNextSubjectBtn ? (
          <Button onClick={() => setIsSubjectSubmitDialogOpen(true)} className={styles.nextSubjectBtn}>
            <span className={styles.navText}>Next Subject</span><span className={styles.mobileNavText}>Next Subject</span> <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={nextDisabled} className={styles.navButtonIconOnly}>
            <span className={styles.navText}>Next</span> <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`${styles.testingContainer} ${styles.noSelect}`}>
      {/* Anti-cheating watermark */}
      <div className={styles.watermark}>
        <div className={styles.watermarkText}>{teacherName} | Testkart</div>
      </div>

      <header className={`${styles.testHeader} ${isHeaderCollapsed && isMobile ? styles.headerCollapsed : ''}`}>
        <div className={styles.headerLeft}>
          <h2 className={styles.testTitle}>{testItemTitle}</h2>
          <div className={styles.progressWrapper}>
            <span className={styles.progressText}>
              Question {currentQuestionIndexInSubject + 1} of {currentSubjectQuestions.length}
              {subjectGroups.length > 1 && (
                <span className={styles.subjectLabel}> - {selectedSubject}</span>
              )}
            </span>
            <span className={styles.overallProgress}>
              ({currentQuestionIndex + 1}/{questions.length} overall)
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timersWrapper}>
            {questionWiseTiming && questionTimerSeconds !== undefined && (
              <div className={`${styles.timer} ${styles.questionTimer} ${questionTimerSeconds < 10 ? styles.timerWarning : ''}`}>
                <Clock size={18} />
                <span className={styles.timerLabel}>Question:</span>
                <span>{formatTime(questionTimerSeconds)}</span>
              </div>
            )}
            {subjectWiseTiming && subjectTimerDisplay ? (
              <div className={`${styles.timer} ${subjectTimerDisplay.isWarning ? styles.timerWarning : ''} ${subjectTimerDisplay.isSubmitted ? styles.timerSubmitted : ''}`}>
                <Clock size={18} />
                <span className={styles.timerLabel}>Subject:</span>
                <span>{subjectTimerDisplay.isSubmitted ? 'Done' : formatTime(subjectTimerDisplay.remaining)}</span>
              </div>
            ) : (
              <div className={`${styles.timer} ${questionWiseTiming ? styles.secondaryTimer : ''} ${!isNoTimeLimit && timeRemaining < 300 ? styles.timerWarning : ''}`}>
                <Clock size={18} />
                {isNoTimeLimit ? (
                  <span className={styles.timerLabel}>Elapsed:</span>
                ) : questionWiseTiming ? (
                  <span className={styles.timerLabel}>Overall:</span>
                ) : null}
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
          {subjectWiseTiming && !isCurrentSubjectSubmitted && onSubjectSubmit && (
            <Button variant="outline" onClick={() => setIsSubjectSubmitDialogOpen(true)} className={styles.submitSubjectBtn}>
              Submit Subject
            </Button>
          )}
          <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className={styles.headerSubmitTestBtn}>Submit Test</Button>
            </DialogTrigger>
          </Dialog>
          <TestingInterfaceSubmitDialog
            open={isSubmitDialogOpen}
            onOpenChange={setIsSubmitDialogOpen}
            totalQuestions={questions.length}
            answeredCount={answers.size}
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
        </div>
        {isMobile && (
          <div className={styles.mobilePaletteWrapper}>
            <TestingInterfacePalette
              variant="mobile"
              collapsed={isHeaderCollapsed}
              subjectStats={subjectStats}
              subjectGroups={subjectGroups}
              selectedSubject={selectedSubject}
              currentSubjectIndex={currentSubjectIndex}
              currentQuestion={currentQuestion}
              answeredIds={answeredIds}
              markedForReview={markedForReview}
              visitedQuestionIds={visitedQuestionIds}
              onSubjectChange={handleSubjectChange}
              onQuestionNavigateInSubject={handleQuestionNavigateInSubject}
              mobileButtonRefs={mobileButtonRefs}
              subjectWiseTiming={subjectWiseTiming}
              subjectTimerStates={subjectTimerStates}
              questionWiseTiming={questionWiseTiming}
              expiredQuestionIds={expiredQuestionIds}
            />
          </div>
        )}
      </header>

      <main className={styles.testBody}>
        <div className={styles.questionArea}>
          {currentQuestion && (
            <div key={currentQuestion.id} className={styles.questionScrollArea}>
              <div className={styles.questionHeader}>
                <h3 className={styles.questionText}>
                  <span className={styles.questionNumber}>{currentQuestionIndexInSubject + 1}.</span>
                  <MathMLContent html={currentQuestion.questionText} />
                </h3>
                {(currentQuestion.positiveMarks !== null || currentQuestion.negativeMarks !== null) && (
                  <div className={styles.questionMarksIndicator}>
                    {currentQuestion.positiveMarks !== null && <span className={styles.positiveMarks}>+{currentQuestion.positiveMarks}</span>}
                    {currentQuestion.positiveMarks !== null && currentQuestion.negativeMarks !== null && <span>|</span>}
                    {currentQuestion.negativeMarks !== null && <span className={styles.negativeMarks}>-{currentQuestion.negativeMarks}</span>}
                  </div>
                )}
              </div>
              {maxAttemptsInfoMessage && (
                <div className={styles.maxAttemptsInfoBanner}>
                  <Info size={14} />
                  <span>{maxAttemptsInfoMessage}</span>
                </div>
              )}
              {(currentQuestionLocked || isCurrentSubjectSubmitted) && lockBannerMessage && (
                <div className={styles.lockBanner}>
                  <Lock size={14} />
                  <span>{lockBannerMessage}</span>
                </div>
              )}
              <div className={(currentQuestionLocked || isCurrentSubjectSubmitted) ? styles.lockedQuestion : undefined}>
                <QuestionRenderer
                  question={currentQuestion}
                  answer={answers.get(currentQuestion.id)}
                  onAnswerChange={(answer) => onAnswerChange(currentQuestion.id, answer)}
                  className={styles.questionRenderer}
                />
              </div>
            </div>
          )}
          {!isMobile && navigationButtons}
        </div>

        {!isMobile && (
          <TestingInterfacePalette
            variant="desktop"
            subjectStats={subjectStats}
            subjectGroups={subjectGroups}
            selectedSubject={selectedSubject}
            currentSubjectIndex={currentSubjectIndex}
            currentQuestion={currentQuestion}
            answeredIds={answeredIds}
            markedForReview={markedForReview}
            visitedQuestionIds={visitedQuestionIds}
            onSubjectChange={handleSubjectChange}
            onQuestionNavigateInSubject={handleQuestionNavigateInSubject}
            subjectWiseTiming={subjectWiseTiming}
            subjectTimerStates={subjectTimerStates}
            questionWiseTiming={questionWiseTiming}
            expiredQuestionIds={expiredQuestionIds}
          />
        )}
      </main>

      {isMobile && (
        <footer className={styles.navigationFooter}>
          {navigationButtons}
        </footer>
      )}

      <ScientificCalculator isEnabled={calculatorEnabled} />
    </div>
  );
};

export const TestingSkeleton = () => (
  <div className={styles.testingContainer}>
    <header className={styles.testHeader}>
      <div className={styles.headerLeft}>
        <Skeleton style={{ width: '250px', height: '2rem' }} />
        <Skeleton style={{ width: '150px', height: '1.25rem', marginTop: 'var(--spacing-2)' }} />
      </div>
      <div className={styles.headerRight}>
        <Skeleton style={{ width: '100px', height: '2.5rem' }} />
        <Skeleton style={{ width: '120px', height: '2.5rem' }} />
      </div>
    </header>
    <main className={styles.testBody}>
      <div className={styles.questionArea}>
        <Skeleton style={{ width: '80%', height: '2rem', marginBottom: 'var(--spacing-6)' }} />
        <div className={styles.optionsGroup}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.optionLabel}>
              <Skeleton style={{ width: '1.25rem', height: '1.25rem', borderRadius: 'var(--radius-full)' }} />
              <Skeleton style={{ width: '60%', height: '1.25rem' }} />
            </div>
          ))}
        </div>
        <div className={styles.navigationButtons}>
          <Skeleton style={{ width: '120px', height: '2.5rem' }} />
          <Skeleton style={{ width: '120px', height: '2.5rem' }} />
        </div>
      </div>
      <div className={styles.paletteSkeletonWrap}>
        <Skeleton style={{ width: '100px', height: '1.5rem', marginBottom: 'var(--spacing-4)' }} />
        <div className={styles.paletteGridSkeleton}>
          {[...Array(20)].map((_, i) => (
            <Skeleton key={i} style={{ width: '2.5rem', height: '2.5rem' }} />
          ))}
        </div>
      </div>
    </main>
  </div>
);