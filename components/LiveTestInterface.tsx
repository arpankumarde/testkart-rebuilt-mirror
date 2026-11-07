import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, HelpCircle, AlertTriangle, History } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import superjson from 'superjson';
import { useTestQuestionsQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../helpers/useTestAttemptMutations';
import { OutputType as SubmitOutputType } from '../endpoints/student/test-item/submit-attempt_POST.schema';
import { getStudentTestItemSavedAttempt, SavedAttempt } from '../endpoints/student/test-item/saved-attempt_GET.schema';
import {
  postStudentTestItemSaveProgress,
  SAVE_PROGRESS_URL,
  InputType as SaveProgressInput,
} from '../endpoints/student/test-item/save-progress_POST.schema';
import { postStudentTestItemResumeAttempt } from '../endpoints/student/test-item/resume-attempt_POST.schema';
import { AttemptProgressState, emptyProgressState } from '../helpers/testAttemptProgressState';
import { Button } from './Button';
import { Progress } from './Progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import { QuestionAnswer, QuestionData, convertAnswerForSubmission } from '../helpers/questionAnswerTypes';
import { castToExtendedQuestions, buildSubjectGroups } from '../helpers/testingInterfaceTypes';
import { TestingInterface, TestingSkeleton } from './TestingInterface';
import { ExamColourKey } from './TestPreTestScreen';
import { liveTestPath } from '../helpers/liveTestRoutes';
import styles from './LiveTestInterface.module.css';

type Stage = 'pre-test' | 'testing' | 'results';

const savedAttemptQueryKey = (testItemId: number) => ['savedTestAttempt', testItemId] as const;
const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 10000;

function describeSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return 'under a minute';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function formatClockTime(value: Date): string {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function secondsUntil(deadline: number | null): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

// Sends the save even while the page is unloading.
function sendProgressOnExit(payload: SaveProgressInput) {
  try {
    fetch(SAVE_PROGRESS_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: superjson.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // Nothing more can be done while the page goes away.
  }
}

interface LiveTestInterfaceProps {
  liveTestId: number;
  liveTestSlug: string;
  liveTestTitle: string;
  testItemId: number;
  durationMinutes: number;
  totalQuestions: number;
  teacherName: string;
  endTime?: Date;
  className?: string;
}

export const LiveTestInterface: React.FC<LiveTestInterfaceProps> = ({
  liveTestId,
  liveTestSlug,
  liveTestTitle,
  testItemId,
  durationMinutes,
  totalQuestions,
  teacherName,
  endTime,
  className,
}) => {

  const [stage, setStage] = useState<Stage>('pre-test');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, QuestionAnswer>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60);
  const [results, setResults] = useState<SubmitOutputType | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [visitedQuestionIds, setVisitedQuestionIds] = useState<Set<number>>(new Set());

  // A live attempt can be continued after a refresh or crash, never restarted,
  // and its clock never pauses. deadlineRef is when time runs out, set from the
  // server's count of seconds left. restoreState holds the saved answers until
  // the questions load; progressReady then turns on the timer and autosave.
  const [restoreState, setRestoreState] = useState<AttemptProgressState | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  // Set once the attempt is saved for leaving, so later exit hooks don't save again
  const leftRef = useRef(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const canFetchQuestions = attemptId !== null;
  const questionsQuery = useTestQuestionsQuery(canFetchQuestions ? testItemId : undefined, attemptId);
  const startAttemptMutation = useStartAttemptMutation(testItemId);
  const submitAttemptMutation = useSubmitAttemptMutation(attemptId ?? 0);

  const savedAttemptQuery = useQuery({
    queryKey: savedAttemptQueryKey(testItemId),
    queryFn: () => getStudentTestItemSavedAttempt({ testItemId }),
    enabled: stage === 'pre-test',
    refetchOnMount: 'always',
    staleTime: 0,
    retry: 1,
  });
  const savedAttempt = savedAttemptQuery.data?.attempt ?? null;

  const questionsData = questionsQuery.data?.questions ?? [];
  const extendedQuestions = useMemo(() => castToExtendedQuestions(questionsData as any), [questionsData]);
  const subjectGroups = useMemo(() => buildSubjectGroups(extendedQuestions), [extendedQuestions]);

  const currentQuestion = questionsData[currentQuestionIndex];

  // Latest values for the timer, the page-exit save and the unmount cleanup
  const latestStateRef = useRef<{
    stage: Stage;
    attemptId: number | null;
    ready: boolean;
    answers: Map<number, QuestionAnswer>;
    currentQuestionId: number | null;
    markedForReview: Set<number>;
    visitedQuestionIds: Set<number>;
  }>({
    stage: 'pre-test',
    attemptId: null,
    ready: false,
    answers: new Map(),
    currentQuestionId: null,
    markedForReview: new Set(),
    visitedQuestionIds: new Set(),
  });

  useEffect(() => {
    latestStateRef.current = {
      stage,
      attemptId,
      ready: progressReady,
      answers,
      currentQuestionId: currentQuestion?.id ?? null,
      markedForReview,
      visitedQuestionIds,
    };
  });

  // The palette shows a question as seen once the student has opened it
  useEffect(() => {
    if (stage !== 'testing' || !progressReady || !currentQuestion) return;
    setVisitedQuestionIds((prev) => (prev.has(currentQuestion.id) ? prev : new Set(prev).add(currentQuestion.id)));
  }, [stage, progressReady, currentQuestion]);

  const toggleMarkForReview = useCallback((questionId: number) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  // Opens a started attempt, fresh or resumed. The server says how much time is
  // left: the duration since startedAt, stopping at the live test's end.
  const openAttempt = useCallback((id: number) => {
    setIsOpening(true);
    postStudentTestItemResumeAttempt({ attemptId: id })
      .then((data) => {
        const secondsLeft = data.liveSecondsLeft ?? durationMinutes * 60;
        deadlineRef.current = Date.now() + secondsLeft * 1000;
        setTimeRemaining(secondsLeft);
        setRestoreState(data.state);
        setAttemptId(data.attemptId);
        setStage('testing');
      })
      .catch((error) => {
        console.error('Error opening live test attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not open the test.'}`);
        void queryClient.invalidateQueries({ queryKey: savedAttemptQueryKey(testItemId) });
      })
      .finally(() => setIsOpening(false));
  }, [durationMinutes, queryClient, testItemId]);

  const handleStartTest = () => {
    startAttemptMutation.mutate({ testItemId }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['liveTestDetails', liveTestId] });
        openAttempt(data.attemptId);
      },
      onError: (error) => {
        console.error('Error starting live test attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not start the test.'}`);
        void queryClient.invalidateQueries({ queryKey: savedAttemptQueryKey(testItemId) });
      },
    });
  };

  // Once the questions are in, put back the saved answers and question
  useEffect(() => {
    if (stage !== 'testing' || progressReady || !questionsQuery.isSuccess || questionsQuery.isFetching) return;
    const questions = questionsQuery.data?.questions ?? [];
    if (restoreState) {
      const ids = new Set(questions.map((q) => q.id));
      setAnswers(new Map(restoreState.answers.filter(([id]) => ids.has(id)) as Array<[number, QuestionAnswer]>));
      const savedIndex = restoreState.currentQuestionId
        ? questions.findIndex((q) => q.id === restoreState.currentQuestionId)
        : -1;
      if (savedIndex >= 0) setCurrentQuestionIndex(savedIndex);
      setMarkedForReview(new Set(restoreState.markedForReview.filter((id) => ids.has(id))));
      setVisitedQuestionIds(new Set(restoreState.visitedQuestionIds.filter((id) => ids.has(id))));
    }
    setProgressReady(true);
  }, [stage, progressReady, questionsQuery.isSuccess, questionsQuery.isFetching, questionsQuery.data, restoreState]);

  const handleSubmit = useCallback(() => {
    if (!attemptId || !questionsQuery.data) return;

    const formattedAnswers = Array.from(answers.entries())
      .map(([questionId, answer]) => convertAnswerForSubmission(questionId, answer))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    submitAttemptMutation.mutate({ attemptId, answers: formattedAnswers }, {
      onSuccess: (data) => {
        // Mark submitted first so the unmount cleanup does not save the attempt again.
        latestStateRef.current.stage = 'results';
        setResults(data);
        setStage('results');
        setIsSubmitDialogOpen(false);
        setIsLeaveDialogOpen(false);
        queryClient.removeQueries({ queryKey: savedAttemptQueryKey(testItemId) });
        queryClient.invalidateQueries({ queryKey: ['liveTestDetails', liveTestId] });
        queryClient.invalidateQueries({ queryKey: ['liveTestLeaderboard', liveTestId] });
      },
      onError: (error) => {
        console.error('Error submitting live test attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not submit the test.'}`);
      },
    });
  }, [attemptId, answers, questionsQuery.data, submitAttemptMutation, queryClient, liveTestId, testItemId]);

  // The timer outlives many renders, so it reads the latest handler from a ref
  // instead of the one it closed over (which held the answers from first load).
  const handleAutoSubmitRef = useRef<() => void>(undefined);

  const handleAutoSubmit = useCallback(() => {
    alert("Time's up! Your test is being submitted automatically.");
    handleSubmit();
  }, [handleSubmit]);

  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  }, [handleAutoSubmit]);

  // Counts down to the deadline by the wall clock, so a hidden or throttled tab
  // never drifts. A resume with no time left submits the saved answers at once.
  useEffect(() => {
    if (stage !== 'testing' || !progressReady) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const left = secondsUntil(deadlineRef.current);
      setTimeRemaining(left);
      if (left === 0) {
        if (timer) clearInterval(timer);
        timer = undefined;
        handleAutoSubmitRef.current?.();
        return false;
      }
      return true;
    };

    if (tick()) timer = setInterval(tick, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [stage, progressReady]);

  const buildSavePayload = useCallback((): SaveProgressInput | null => {
    const { stage, attemptId, ready, answers, currentQuestionId, markedForReview, visitedQuestionIds } = latestStateRef.current;
    if (leftRef.current || stage !== 'testing' || !attemptId || !ready) return null;
    // The server works out the time spent from startedAt for a live attempt.
    return {
      attemptId,
      elapsedSeconds: 0,
      state: {
        ...emptyProgressState(secondsUntil(deadlineRef.current)),
        answers: Array.from(answers.entries()),
        currentQuestionId,
        markedForReview: Array.from(markedForReview),
        visitedQuestionIds: Array.from(visitedQuestionIds),
      },
    };
  }, []);

  const saveProgress = useCallback(async (): Promise<boolean> => {
    const payload = buildSavePayload();
    if (!payload) return true;
    try {
      await postStudentTestItemSaveProgress(payload);
      return true;
    } catch (error) {
      console.error('[saveProgress] Could not save live test progress:', error);
      return false;
    }
  }, [buildSavePayload]);

  // Save shortly after each answer or move, retrying while the save fails. The
  // clock lives on the server (startedAt), so nothing needs saving in between.
  useEffect(() => {
    if (stage !== 'testing' || !progressReady) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      timeout = setTimeout(async () => {
        const saved = await saveProgress();
        if (!saved && !cancelled) schedule(AUTOSAVE_RETRY_MS);
      }, delay);
    };
    schedule(AUTOSAVE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [stage, progressReady, answers, currentQuestionIndex, markedForReview, saveProgress]);

  // Save as the tab is hidden, refreshed or closed
  useEffect(() => {
    if (stage !== 'testing') return;
    const saveOnExit = () => {
      const payload = buildSavePayload();
      if (payload) sendProgressOnExit(payload);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveOnExit();
    };
    window.addEventListener('pagehide', saveOnExit);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', saveOnExit);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [stage, buildSavePayload]);

  // Ask before a refresh or tab close; the browser shows its own leave prompt
  useEffect(() => {
    if (stage !== 'testing') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stage]);

  // Browser Back: an extra history entry absorbs the first Back press, which
  // opens the leave dialog instead of leaving.
  useEffect(() => {
    if (stage !== 'testing') return;

    const pushGuard = () => {
      window.history.pushState({ ...(window.history.state ?? {}), testkartTestGuard: true }, '', window.location.href);
    };
    if (!window.history.state?.testkartTestGuard) pushGuard();

    const handlePopState = () => {
      if (leavingRef.current) return;
      pushGuard();
      setLeaveError(null);
      setIsLeaveDialogOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stage]);

  // Leaving the page inside the site saves the attempt; the student can come
  // back and continue while time is left.
  useEffect(() => {
    return () => {
      const payload = buildSavePayload();
      if (payload) sendProgressOnExit(payload);
    };
  }, [buildSavePayload]);

  // Leave the test: save, then go back past the history entry the Back guard added
  const handleSaveAndLeave = async () => {
    setLeaveError(null);
    setIsLeaving(true);
    leavingRef.current = true;
    const saved = await saveProgress();
    if (!saved) {
      leavingRef.current = false;
      setIsLeaving(false);
      setLeaveError('Your answers could not be saved. Check your connection and try again.');
      return;
    }
    leftRef.current = true;
    queryClient.removeQueries({ queryKey: savedAttemptQueryKey(testItemId) });
    const here = window.location.href;
    window.history.go(-2);
    setTimeout(() => {
      if (window.location.href === here) navigate(liveTestPath(liveTestSlug), { replace: true });
    }, 500);
  };

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

  const renderResumeCard = (attempt: SavedAttempt) => {
    const secondsLeft = attempt.liveSecondsLeft ?? 0;
    const timeUp = secondsLeft === 0;
    const startedAt = attempt.startedAt ? new Date(attempt.startedAt) : null;
    const savedAt = new Date(attempt.savedAt);
    const startedText = startedAt ? `You started this test at ${formatClockTime(startedAt)}. ` : '';
    return (
      <div className={styles.resumeCard}>
        <div className={styles.resumeHeading}>
          <History size={22} className={styles.resumeIcon} aria-hidden="true" />
          <h2>{timeUp ? 'Your time is up' : 'Your test is still running'}</h2>
        </div>
        <p className={styles.resumeText}>
          {startedText}
          {timeUp
            ? 'The time for this test has run out. Submit your saved answers to get your score.'
            : 'The timer kept running while you were away. Resume to carry on from where you left off with your saved answers.'}
        </p>
        <ul className={styles.resumeFacts}>
          <li>{attempt.answeredCount} of {attempt.totalQuestions || totalQuestions} answered</li>
          <li>{timeUp ? 'No time left' : `${describeSeconds(secondsLeft)} left`}</li>
          {startedAt && savedAt.getTime() > startedAt.getTime() && <li>Saved at {formatClockTime(savedAt)}</li>}
        </ul>
        <Button size="lg" onClick={() => openAttempt(attempt.attemptId)} disabled={isOpening}>
          {isOpening ? 'Opening...' : timeUp ? 'Submit saved answers' : 'Resume test'}
        </Button>
      </div>
    );
  };

  const renderPreTest = () => {
    const isChecking = savedAttemptQuery.isLoading;
    const fullSeconds = durationMinutes * 60;
    const secondsToEnd = endTime ? Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000)) : fullSeconds;
    const isShortened = !!endTime && secondsToEnd < fullSeconds;

    return (
      <div className={`${styles.preTestContainer} tk-student tk-flow`}>
        <div className={styles.briefCard}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live test
          </span>
          <h1 className={styles.preTestTitle}>{liveTestTitle}</h1>
          <div className={styles.preTestDetails}>
            <span className={`${styles.fact} ${styles.factTime}`}>
              <Clock className={styles.detailIcon} aria-hidden="true" />
              {durationMinutes} min
            </span>
            <span className={`${styles.fact} ${styles.factQuestions}`}>
              <HelpCircle className={styles.detailIcon} aria-hidden="true" />
              {totalQuestions} questions
            </span>
          </div>
          {savedAttempt ? (
            renderResumeCard(savedAttempt)
          ) : (
            <>
              <div className={styles.instructions}>
                <h2>Before you start</h2>
                <ul>
                  <li>You get one attempt, and the timer cannot be paused once you start.</li>
                  <li>Your answers save as you go. If the page closes, come back here to carry on while time is left.</li>
                  <li>The test submits itself when the time runs out.</li>
                </ul>
              </div>
              {isShortened && endTime && (
                <div className={styles.liveTestWarning}>
                  <Clock size={20} className={styles.warningIcon} aria-hidden="true" />
                  <p>
                    This live test ends at {formatClockTime(endTime)}, so if you start now you get {describeSeconds(secondsToEnd)} instead of the full {durationMinutes} minutes.
                  </p>
                </div>
              )}
              <ExamColourKey />
              <div className={styles.actions}>
                <Button
                  size="lg"
                  className={styles.startBtn}
                  onClick={handleStartTest}
                  disabled={isChecking || startAttemptMutation.isPending || isOpening}
                >
                  {isChecking ? 'Checking...' : startAttemptMutation.isPending || isOpening ? 'Starting...' : 'Start test'}
                </Button>
                <span className={styles.oneAttemptNote}>
                  <AlertTriangle size={14} aria-hidden="true" /> One attempt only
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderTesting = () => {
    if (questionsQuery.isFetching) return <TestingSkeleton />;
    if (questionsQuery.isError || !questionsQuery.data) {
      return <div className={styles.error}>Failed to load questions. Please try again.</div>;
    }

    return (
      <TestingInterface
        testItemTitle={liveTestTitle}
        teacherName={teacherName}
        questions={questionsData as QuestionData[]}
        answers={answers}
        timeRemaining={timeRemaining}
        currentQuestionIndex={currentQuestionIndex}
        onAnswerChange={handleAnswerChange}
        onQuestionNavigate={setCurrentQuestionIndex}
        onSubmit={handleSubmit}
        isSubmitting={submitAttemptMutation.isPending}
        calculatorEnabled={false}
        markedForReview={markedForReview}
        visitedQuestionIds={visitedQuestionIds}
        onToggleMarkForReview={toggleMarkForReview}
        submitDialogOpen={isSubmitDialogOpen}
        onSubmitDialogOpenChange={setIsSubmitDialogOpen}
      />
    );
  };

  const renderResults = () => {
    if (!results || !questionsQuery.data?.questions) {
      return <div className={styles.error}>Could not load results.</div>;
    }

    const timeTakenSeconds = results.timeTakenSeconds;
    const timeTakenFormatted = `${Math.floor(timeTakenSeconds / 60)}m ${timeTakenSeconds % 60}s`;

    return (
      <div className={`${styles.resultsContainer} tk-student tk-flow`}>
        <div className={styles.resultsCard}>
          <div className={styles.resultsHeader}>
            <h1>Test submitted</h1>
            <p>Here is how you did.</p>
          </div>
          <div className={styles.scoreCard}>
            <span className={styles.scoreLabel}>Your score</span>
            <p className={styles.scorePercentage}>{results.score.toFixed(2)}%</p>
            <p className={styles.scoreFraction}>{results.correctAnswers} of {results.totalQuestions} correct</p>
            <Progress value={results.score} className={styles.scoreProgress} />
          </div>
          <div className={styles.performanceBreakdown}>
            <div className={`${styles.breakdownItem} ${styles.breakdownCorrect}`}>
              <CheckCircle aria-hidden="true" />
              <div><p>{results.correctAnswers}</p><span>Correct</span></div>
            </div>
            <div className={`${styles.breakdownItem} ${styles.breakdownIncorrect}`}>
              <XCircle aria-hidden="true" />
              <div><p>{results.totalQuestions - results.correctAnswers}</p><span>Not correct</span></div>
            </div>
            <div className={`${styles.breakdownItem} ${styles.breakdownTime}`}>
              <Clock aria-hidden="true" />
              <div><p>{timeTakenFormatted}</p><span>Time taken</span></div>
            </div>
          </div>
          <Button asChild size="lg" className={styles.resultsAction}>
            <Link to={liveTestPath(liveTestSlug)}>Back to the live test</Link>
          </Button>
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

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {renderContent()}
      <Dialog
        open={isLeaveDialogOpen}
        onOpenChange={(open) => {
          if (!isLeaving) setIsLeaveDialogOpen(open);
        }}
      >
        <DialogContent className="tk-student tk-flow">
          <DialogHeader>
            <DialogTitle>Leave the test?</DialogTitle>
            <DialogDescription>
              The timer keeps running while you are away. Your answers are saved, and you can come back to this page and carry on until the time runs out. If you do not come back and submit before the live test ends, your answers will not count.
            </DialogDescription>
          </DialogHeader>
          {leaveError && <p className={styles.leaveError}>{leaveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={handleSaveAndLeave} disabled={isLeaving}>
              {isLeaving ? 'Saving...' : 'Save and leave'}
            </Button>
            <Button onClick={() => setIsLeaveDialogOpen(false)} disabled={isLeaving}>
              Continue test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};