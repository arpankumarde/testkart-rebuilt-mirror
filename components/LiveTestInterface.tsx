import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, HelpCircle, ArrowLeft, ArrowRight, Frown, AlertTriangle, Info, Lock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLiveTestsDetails } from '../endpoints/live-tests/details_GET.schema';
import { useTestQuestionsQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../helpers/useTestAttemptMutations';
import { OutputType as SubmitOutputType, postStudentTestItemSubmitAttempt } from '../endpoints/student/test-item/submit-attempt_POST.schema';
import { useAuth } from '../helpers/useAuth';
import { Button } from './Button';
import { Progress } from './Progress';
import { Skeleton } from './Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from './Dialog';
import { useIsMobile } from '../helpers/useIsMobile';
import { Badge } from './Badge';
import { MathMLContent } from './MathMLContent';
import { QuestionAnswer, convertAnswerForSubmission } from '../helpers/questionAnswerTypes';
import { castToExtendedQuestions, buildSubjectGroups, isQuestionLocked } from '../helpers/testingInterfaceTypes';
import { QuestionRenderer } from './QuestionRenderer';
import styles from './LiveTestInterface.module.css';

type Stage = 'pre-test' | 'testing' | 'results';

interface LiveTestInterfaceProps {
  liveTestId: number;
  liveTestTitle: string;
  testItemId: number;
  durationMinutes: number;
  totalQuestions: number;
  teacherName: string;
  className?: string;
}

export const LiveTestInterface: React.FC<LiveTestInterfaceProps> = ({
  liveTestId,
  liveTestTitle,
  testItemId,
  durationMinutes,
  totalQuestions,
  teacherName,
  className,
}) => {

  const [stage, setStage] = useState<Stage>('pre-test');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, QuestionAnswer>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60);
  const [results, setResults] = useState<SubmitOutputType | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);

  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { authState } = useAuth();

  const latestStateRef = useRef({
    stage,
    attemptId,
    hasQuestions: false,
    answersMap: answers,
  });

  useEffect(() => {
    latestStateRef.current = {
      stage,
      attemptId,
      hasQuestions: !!questionsQuery.data,
      answersMap: answers,
    };
  });

  const canFetchQuestions = attemptId !== null;
  const questionsQuery = useTestQuestionsQuery(canFetchQuestions ? testItemId : undefined, attemptId);
  const startAttemptMutation = useStartAttemptMutation(testItemId);
  const submitAttemptMutation = useSubmitAttemptMutation(attemptId ?? 0);

  useEffect(() => {
    if (stage !== 'testing' || !questionsQuery.isSuccess) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, questionsQuery.isSuccess]);

  const handleStartTest = () => {
    startAttemptMutation.mutate({ testItemId }, {
      onSuccess: (data) => {
        setAttemptId(data.attemptId);
        setStage('testing');
        queryClient.invalidateQueries({ queryKey: ['liveTestDetails', liveTestId] });
      },
      onError: (error) => {
        console.error('Error starting live test attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not start the test.'}`);
      },
    });
  };

  const handleSubmit = useCallback(() => {
    if (!attemptId || !questionsQuery.data) return;
    
    const formattedAnswers = Array.from(answers.entries())
      .map(([questionId, answer]) => convertAnswerForSubmission(questionId, answer))
      .filter((a): a is NonNullable<typeof a> => a !== null);
    
    submitAttemptMutation.mutate({ attemptId, answers: formattedAnswers }, {
      onSuccess: (data) => {
        setResults(data);
        setStage('results');
        setIsSubmitDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['liveTestDetails', liveTestId] });
        queryClient.invalidateQueries({ queryKey: ['liveTestLeaderboard', liveTestId] });
      },
      onError: (error) => {
        console.error('Error submitting live test attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not submit the test.'}`);
      },
    });
  }, [attemptId, answers, questionsQuery.data, submitAttemptMutation, queryClient, liveTestId]);

  const handleAutoSubmit = useCallback(() => {
    alert("Time's up! Your test is being submitted automatically.");
    handleSubmit();
  }, [handleSubmit]);

  useEffect(() => {
    if (stage !== 'testing') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stage]);

  useEffect(() => {
    return () => {
      const { stage, attemptId, hasQuestions, answersMap } = latestStateRef.current;
      if (stage === 'testing' && attemptId && hasQuestions) {
        const formattedAnswers = Array.from(answersMap.entries())
          .map(([questionId, answer]) => convertAnswerForSubmission(questionId, answer as QuestionAnswer))
          .filter((a): a is NonNullable<typeof a> => a !== null);
        postStudentTestItemSubmitAttempt({ attemptId, answers: formattedAnswers }).catch((err) => {
          console.error('[Cleanup] Auto-submit failed:', err);
        });
      }
    };
  }, []);

  const handleAnswerChange = (questionId: number, answer: QuestionAnswer | undefined) => {
    if (answer === undefined) {
      const newAnswers = new Map(answers);
      newAnswers.delete(questionId);
      setAnswers(newAnswers);
    } else {
      const newAnswers = new Map(answers).set(questionId, answer);
      setAnswers(newAnswers);

      const currentExtended = extendedQuestions.find(q => q.id === questionId);
      if (!currentExtended) return;
      
      const subjectIndex = subjectGroups.findIndex(g => g.name === (currentExtended.subjectName || 'General Questions'));
      if (subjectIndex === -1) return;
      
      const currentSubjectGroup = subjectGroups[subjectIndex];
      const section = currentSubjectGroup.sections.find(s => s.id === currentExtended.sectionId);
      
      let isSubjectCompleted = false;
      
      if (section && section.maxAttemptsAllowed !== null) {
        const answeredInSection = section.questions.filter(q => newAnswers.has(q.id)).length;
        if (answeredInSection >= section.maxAttemptsAllowed) {
          const otherAvailableSections = currentSubjectGroup.sections.some(s => {
            if (s.id === section.id) return false;
            if (s.maxAttemptsAllowed === null) return true;
            const answered = s.questions.filter(q => newAnswers.has(q.id)).length;
            return answered < s.maxAttemptsAllowed;
          });
          if (!otherAvailableSections) {
            isSubjectCompleted = true;
          }
        }
      } else if (currentSubjectGroup.maxAttemptsAllowed !== null) {
        const answeredInSubject = currentSubjectGroup.questions.filter(q => newAnswers.has(q.id)).length;
        if (answeredInSubject >= currentSubjectGroup.maxAttemptsAllowed) {
          isSubjectCompleted = true;
        }
      }

      if (isSubjectCompleted) {
        if (subjectIndex + 1 < subjectGroups.length) {
          const nextSubject = subjectGroups[subjectIndex + 1];
          if (nextSubject.questions.length > 0) {
            const nextQuestionId = nextSubject.questions[0].id;
            const nextQuestionIndex = extendedQuestions.findIndex(q => q.id === nextQuestionId);
            if (nextQuestionIndex !== -1) {
              setCurrentQuestionIndex(nextQuestionIndex);
            }
          }
        } else {
          setIsSubmitDialogOpen(true);
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const questionsData = questionsQuery.data?.questions ?? [];
  const extendedQuestions = useMemo(() => castToExtendedQuestions(questionsData as any), [questionsData]);
  const subjectGroups = useMemo(() => buildSubjectGroups(extendedQuestions), [extendedQuestions]);

  const currentQuestion = questionsData[currentQuestionIndex];
  const answeredCount = answers.size;

  // Block right-click and keyboard shortcuts during testing
  useEffect(() => {
    if (stage !== 'testing') return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S, Ctrl+P, PrintScreen, F12
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
  }, [stage]);

  const renderPreTest = () => (
    <div className={styles.preTestContainer}>
      <h1 className={styles.preTestTitle}>{liveTestTitle}</h1>
      <div className={styles.preTestDetails}>
        <div>
          <Clock className={styles.detailIcon} />
          <span>{durationMinutes} Minutes</span>
        </div>
        <div>
          <HelpCircle className={styles.detailIcon} />
          <span>{totalQuestions} Questions</span>
        </div>
      </div>
      <div className={styles.instructions}>
        <h3>Instructions</h3>
        <p>This is a live, competitive test. Once you start, the timer cannot be paused. The test will be submitted automatically when the timer runs out. Good luck!</p>
      </div>
      <div className={styles.liveTestWarning}>
        <AlertTriangle size={24} className={styles.warningIcon} />
        <p>
          <strong>Important:</strong> You can attempt this live test only once. Once you start, the timer begins immediately and cannot be paused. Make sure you are fully prepared before starting.
        </p>
      </div>
      <Button
        size="lg"
        onClick={handleStartTest}
        disabled={startAttemptMutation.isPending}
      >
        {startAttemptMutation.isPending ? 'Starting...' : 'Start Test'}
      </Button>
    </div>
  );

  const renderTesting = () => {
    if (questionsQuery.isFetching) return <TestSkeleton />;
    if (questionsQuery.isError || !questionsQuery.data) {
      return <div className={styles.error}>Failed to load questions. Please try again.</div>;
    }

    const answeredKeys = new Set(answers.keys());

    const currentExtended = extendedQuestions[currentQuestionIndex];
    const currentSubjectGroup = currentExtended 
      ? subjectGroups.find(g => g.name === (currentExtended.subjectName || 'General Questions'))
      : null;

    let maxAttemptsInfoMessage: string | null = null;
    let sectionName = 'section';
    if (currentExtended && currentSubjectGroup) {
      const section = currentSubjectGroup.sections.find(s => s.id === currentExtended.sectionId);
      if (section?.maxAttemptsAllowed !== null && section?.maxAttemptsAllowed !== undefined) {
        sectionName = 'section';
        const answeredInSection = section.questions.filter(q => answers.has(q.id)).length;
        maxAttemptsInfoMessage = `You can attempt ${section.maxAttemptsAllowed} out of ${section.questions.length} questions in ${section.name}. (${answeredInSection} answered so far)`;
      } else if (currentSubjectGroup.maxAttemptsAllowed !== null) {
        sectionName = 'subject';
        const answeredInSubject = currentSubjectGroup.questions.filter(q => answers.has(q.id)).length;
        maxAttemptsInfoMessage = `You can attempt ${currentSubjectGroup.maxAttemptsAllowed} out of ${currentSubjectGroup.questions.length} questions in ${currentSubjectGroup.name}. (${answeredInSubject} answered so far)`;
      }
    }

    const isCurrentLocked = currentExtended && currentSubjectGroup 
      ? isQuestionLocked(currentExtended, currentSubjectGroup, answeredKeys)
      : false;

    const questionPalette = (
      <div className={styles.palette}>
        <h4>Question Palette</h4>
        <div className={styles.paletteGrid}>
          {questionsData.map((q, index) => {
            const extQ = extendedQuestions[index];
            const sg = extQ ? subjectGroups.find(g => g.name === (extQ.subjectName || 'General Questions')) : null;
            const locked = extQ && sg ? isQuestionLocked(extQ, sg, answeredKeys) : false;
            return (
              <button
                key={q.id}
                className={`${styles.paletteItem} ${index === currentQuestionIndex ? styles.current : ''} ${answers.has(q.id) ? styles.answered : styles.unanswered} ${locked ? styles.locked : ''}`}
                onClick={() => setCurrentQuestionIndex(index)}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>
    );

    const questionPaletteMobile = (
      <div className={styles.paletteMobile}>
        <div className={styles.paletteMobileScroll}>
          {subjectGroups.map((group) => (
            <React.Fragment key={group.name}>
              <span className={styles.subjectLabelMobile}>{group.name}</span>
              {group.questions.map((q) => {
                const index = extendedQuestions.findIndex(ext => ext.id === q.id);
                const locked = isQuestionLocked(q, group, answeredKeys);
                return (
                  <button
                    key={q.id}
                    className={`${styles.paletteItemMobile} ${index === currentQuestionIndex ? styles.current : ''} ${answers.has(q.id) ? styles.answered : styles.unanswered} ${locked ? styles.locked : ''}`}
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );

    const navigationButtons = (
      <div className={styles.navigationButtons}>
        <Button variant="outline" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
          <ArrowLeft size={16} /> Previous
        </Button>
        <Button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} disabled={currentQuestionIndex === questionsData.length - 1}>
          Next <ArrowRight size={16} />
        </Button>
      </div>
    );

    return (
      <div className={`${styles.testingContainer} ${styles.noSelect}`}>
        {/* Anti-cheating watermark */}
        <div className={styles.watermark}>
          <div className={styles.watermarkText}>
            {teacherName} | Testkart
          </div>
        </div>
        <header className={styles.testHeader}>
          <div className={styles.headerLeft}>
            <h2 className={styles.testTitle}>{liveTestTitle}</h2>
            <span className={styles.progressText}>Question {currentQuestionIndex + 1} of {questionsData.length}</span>
          </div>
          <div className={styles.headerRight}>
            <div className={`${styles.timer} ${timeRemaining < 300 ? styles.timerWarning : ''}`}>
              <Clock size={18} />
              <span>{formatTime(timeRemaining)}</span>
            </div>
            <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
              <DialogTrigger asChild><Button variant="destructive">Submit Test</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Submission</DialogTitle>
                  <DialogDescription>Are you sure you want to submit your test?</DialogDescription>
                </DialogHeader>
                <div className={styles.submitSummary}>
                  <p>Answered: {answeredCount}</p>
                  <p>Unanswered: {questionsData.length - answeredCount}</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Go Back</Button></DialogClose>
                  <Button variant="destructive" onClick={handleSubmit} disabled={submitAttemptMutation.isPending}>
                    {submitAttemptMutation.isPending ? 'Submitting...' : 'Submit Test'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>
        {isMobile && questionPaletteMobile}
        <main className={styles.testBody}>
          <div className={styles.questionArea}>
            {currentQuestion && (
              <div key={currentQuestion.id}>
                <h3 className={styles.questionText}>
                  <span className={styles.questionNumber}>{currentQuestionIndex + 1}.</span>
                  <MathMLContent html={currentQuestion.questionText} />
                </h3>
                {maxAttemptsInfoMessage && (
                  <div className={styles.maxAttemptsInfoBanner}>
                    <Info size={14} />
                    <span>{maxAttemptsInfoMessage}</span>
                  </div>
                )}
                {isCurrentLocked && (
                  <div className={styles.lockBanner}>
                    <Lock size={14} />
                    <span>You have reached the maximum attempts for this {sectionName}.</span>
                  </div>
                )}
                <div className={isCurrentLocked ? styles.lockedQuestion : undefined}>
                  <QuestionRenderer
                    question={currentQuestion as any}
                    answer={answers.get(currentQuestion.id)}
                    onAnswerChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
                    className={styles.optionsGroup}
                  />
                </div>
              </div>
            )}
            {!isMobile && navigationButtons}
          </div>
          {!isMobile && questionPalette}
        </main>
        {isMobile && <footer className={styles.navigationFooter}>{navigationButtons}</footer>}
      </div>
    );
  };

  const renderResults = () => {
    if (!results || !questionsQuery.data?.questions) {
      return <div className={styles.error}>Could not load results.</div>;
    }

    const timeTakenSeconds = (durationMinutes * 60) - timeRemaining;
    const timeTakenFormatted = `${Math.floor(timeTakenSeconds / 60)}m ${timeTakenSeconds % 60}s`;
    const resultsMap = new Map(results.results.map(r => [r.questionId, r]));

    return (
      <div className={styles.resultsContainer}>
        <div className={styles.resultsHeader}>
          <h1>Test Results</h1>
          <Button variant="outline" asChild>
            <Link to={`/mock-test/live/${liveTestId}`}>Back to Test Details</Link>
          </Button>
        </div>
        <div className={styles.scoreCard}>
          <h2>Your Score</h2>
          <p className={styles.scorePercentage}>{results.score.toFixed(2)}%</p>
          <p className={styles.scoreFraction}>{results.correctAnswers} / {results.totalQuestions}</p>
          <Progress value={results.score} className={styles.scoreProgress} />
        </div>
        <div className={styles.performanceBreakdown}>
          <div className={styles.breakdownItem}><CheckCircle className={styles.correctIcon} /><div><p>{results.correctAnswers}</p><span>Correct</span></div></div>
          <div className={styles.breakdownItem}><XCircle className={styles.incorrectIcon} /><div><p>{results.totalQuestions - results.correctAnswers}</p><span>Incorrect</span></div></div>
          <div className={styles.breakdownItem}><Clock className={styles.timeIcon} /><div><p>{timeTakenFormatted}</p><span>Time Taken</span></div></div>
        </div>

      </div>
    );
  };

  const renderContent = () => {
    switch (stage) {
      case 'pre-test': return renderPreTest();
      case 'testing': return renderTesting();
      case 'results': return renderResults();
      default: return null;
    }
  };

  return <div className={`${styles.container} ${className || ''}`}>{renderContent()}</div>;
};

const TestSkeleton = () => (
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
      <div className={styles.palette}>
        <Skeleton style={{ width: '100px', height: '1.5rem', marginBottom: 'var(--spacing-4)' }} />
        <div className={styles.paletteGrid}>
          {[...Array(20)].map((_, i) => <Skeleton key={i} style={{ width: '2.5rem', height: '2.5rem' }} />)}
        </div>
      </div>
    </main>
  </div>
);