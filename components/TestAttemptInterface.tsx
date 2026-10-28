import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import superjson from 'superjson';
import { useTestQuestionsQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../helpers/useTestAttemptMutations';
import { ENROLLED_TESTS_QUERY_KEY } from '../helpers/useEnrolledTestsQuery';
import { TEST_RESULTS_QUERY_KEY } from '../helpers/useTestResultsQuery';
import { postStudentTestItemSubmitAttempt } from '../endpoints/student/test-item/submit-attempt_POST.schema';
import { getStudentTestItemSavedAttempt } from '../endpoints/student/test-item/saved-attempt_GET.schema';
import {
  postStudentTestItemSaveProgress,
  SAVE_PROGRESS_URL,
  InputType as SaveProgressInput,
} from '../endpoints/student/test-item/save-progress_POST.schema';
import { postStudentTestItemResumeAttempt } from '../endpoints/student/test-item/resume-attempt_POST.schema';
import { postStudentTestItemDiscardAttempt } from '../endpoints/student/test-item/discard-attempt_POST.schema';
import { AttemptProgressState } from '../helpers/testAttemptProgressState';
import { TestPreTestScreen, PausedAttemptSummary } from './TestPreTestScreen';
import { TestingInterface, TestingSkeleton } from './TestingInterface';
import { Button } from './Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';
import { QuestionAnswer, convertAnswerForSubmission, QuestionData } from '../helpers/questionAnswerTypes';
import {
  SubjectTimerState,
  buildSubjectGroups,
  castToExtendedQuestions,
} from '../helpers/testingInterfaceTypes';
import {
  useSubjectTimers,
  totalRemainingSeconds,
  findFirstUnsubmittedSubject,
  areAllSubjectsSubmitted,
} from '../helpers/useSubjectTimers';
import styles from './TestAttemptInterface.module.css';

type Stage = 'pre-test' | 'testing' | 'submitted';

const savedAttemptQueryKey = (testItemId: number) => ['savedTestAttempt', testItemId] as const;
const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_INTERVAL_MS = 30000;

function describeSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return 'under a minute';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
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

interface TestAttemptInterfaceProps {
  testItemId: number;
  testItemTitle: string;
  teacherName: string;
  durationMinutes: number;
  totalQuestions: number;
  calculatorEnabled: boolean;
  className?: string;
}

export const TestAttemptInterface: React.FC<TestAttemptInterfaceProps> = ({
  testItemId,
  testItemTitle,
  teacherName,
  durationMinutes,
  totalQuestions,
  calculatorEnabled,
  className,
}) => {
  const [stage, setStage] = useState<Stage>('pre-test');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, QuestionAnswer>>(new Map());
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [visitedQuestionIds, setVisitedQuestionIds] = useState<Set<number>>(new Set());
  const isNoTimeLimit = durationMinutes === 0;
  // Global timer (used when subjectWiseTiming is false)
  const [timeRemaining, setTimeRemaining] = useState(isNoTimeLimit ? 0 : durationMinutes * 60);

  // Question-wise timing states
  const [questionTimerSeconds, setQuestionTimerSeconds] = useState<number | null>(null);
  const [expiredQuestionIds, setExpiredQuestionIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Pause and resume. restoreState holds a resumed attempt's saved state until
  // the questions load; progressReady turns autosave on once it is applied (or
  // a fresh attempt is ready), so an empty state never overwrites a saved one.
  const [restoreState, setRestoreState] = useState<AttemptProgressState | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const elapsedBaseRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const pendingQuestionTimerRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  // Set once the attempt is saved for leaving, so later exit hooks don't save again
  const pausedRef = useRef(false);

  // Latest values for the timers, the page-exit save and the unmount cleanup
  const latestStateRef = useRef<{
    stage: Stage;
    attemptId: number | null;
    ready: boolean;
    state: AttemptProgressState | null;
  }>({
    stage: 'pre-test',
    attemptId: null,
    ready: false,
    state: null,
  });

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

  // Derived data from questions query
  const subjectWiseTiming = questionsQuery.data?.subjectWiseTiming ?? false;
  const questionWiseTiming = questionsQuery.data?.questionWiseTiming ?? false;

  const subjectGroups = useMemo(() => {
    if (!questionsQuery.data) return [];
    return buildSubjectGroups(castToExtendedQuestions(questionsQuery.data.questions as unknown as Parameters<typeof castToExtendedQuestions>[0]));
  }, [questionsQuery.data]);

  const orderedQuestions = useMemo(() => {
    return subjectGroups.flatMap(g => g.questions);
  }, [subjectGroups]);

  // Track which subject is currently active for subject-wise timing
  const currentQuestion = orderedQuestions[currentQuestionIndex];
  const currentSubjectName = currentQuestion?.subjectName || (subjectGroups[0]?.name ?? '');

  const [activeSubjectName, setActiveSubjectName] = useState<string>('');

  useEffect(() => {
    if (stage === 'testing' && currentQuestion) {
      setVisitedQuestionIds(prev => {
        if (prev.has(currentQuestion.id)) return prev;
        const next = new Set(prev);
        next.add(currentQuestion.id);
        return next;
      });
    }
  }, [stage, currentQuestion?.id]);

  const handleToggleMarkForReview = useCallback((questionId: number) => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  // Update activeSubjectName when current question changes
  useEffect(() => {
    if (!currentSubjectName) return;
    if (subjectWiseTiming) {
      // Only set on initial load when activeSubjectName is empty
      if (!activeSubjectName) {
        setActiveSubjectName(currentSubjectName);
      }
    } else {
      if (currentSubjectName !== activeSubjectName) {
        setActiveSubjectName(currentSubjectName);
      }
    }
  }, [currentSubjectName, activeSubjectName, subjectWiseTiming]);

  const handleAutoSubmitRef = useRef<() => void>(undefined);
  const handleSubjectExpiredRef = useRef<(subjectName: string) => void>(undefined);

  // Subject-wise timer hook
  const {
    subjectTimerStates,
    setSubjectTimerStates,
    isInitialized: subjectTimersInitialized,
  } = useSubjectTimers({
    subjectGroups,
    isActive: stage === 'testing' && subjectWiseTiming,
    activeSubjectName,
    onSubjectExpired: useCallback((subjectName: string) => {
      handleSubjectExpiredRef.current?.(subjectName);
    }, []),
    initialStates: restoreState?.subjectTimerStates ?? null,
  });

  // Keep ref up-to-date on every render
  // Reset and handle question timer when current question changes
  useEffect(() => {
    if (stage === 'testing' && questionWiseTiming && currentQuestion) {
      if (pendingQuestionTimerRef.current !== null) {
        setQuestionTimerSeconds(pendingQuestionTimerRef.current);
        pendingQuestionTimerRef.current = null;
      } else if (!expiredQuestionIds.has(currentQuestion.id)) {
        setQuestionTimerSeconds(currentQuestion.durationSeconds ?? 0);
      } else {
        setQuestionTimerSeconds(0);
      }
    }
  }, [currentQuestionIndex, stage, questionWiseTiming, currentQuestion, expiredQuestionIds]);

  // Question timer countdown interval
  useEffect(() => {
    if (stage !== 'testing' || !questionWiseTiming) return;

    const timer = setInterval(() => {
      setQuestionTimerSeconds(prev => {
        if (prev === null || prev <= 0) return prev;
        const next = prev - 1;
        if (next === 0) {
          // Time's up for the current question
          if (currentQuestion) {
            setExpiredQuestionIds(old => {
              const newSet = new Set(old);
              newSet.add(currentQuestion.id);
              return newSet;
            });
          }
          // Auto-advance logic
          setTimeout(() => {
            if (currentQuestionIndex < orderedQuestions.length - 1) {
              setCurrentQuestionIndex(currentQuestionIndex + 1);
            } else {
              handleAutoSubmitRef.current?.();
            }
          }, 0);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, questionWiseTiming, currentQuestion, currentQuestionIndex, orderedQuestions.length]);

  // Once the questions are in, apply a resumed attempt's saved state and start
  // counting the time spent in this sitting.
  useEffect(() => {
    if (stage !== 'testing' || !questionsQuery.isSuccess || questionsQuery.isFetching) return;
    if (segmentStartRef.current !== null) return;

    const saved = restoreState;
    if (saved) {
      const ids = new Set(orderedQuestions.map((q) => q.id));
      setAnswers(new Map(saved.answers.filter(([id]) => ids.has(id)) as Array<[number, QuestionAnswer]>));
      setMarkedForReview(new Set(saved.markedForReview.filter((id) => ids.has(id))));
      setVisitedQuestionIds(new Set(saved.visitedQuestionIds.filter((id) => ids.has(id))));
      setExpiredQuestionIds(new Set(saved.expiredQuestionIds.filter((id) => ids.has(id))));
      const savedIndex = saved.currentQuestionId
        ? orderedQuestions.findIndex((q) => q.id === saved.currentQuestionId)
        : -1;
      if (savedIndex >= 0) setCurrentQuestionIndex(savedIndex);
      setTimeRemaining(isNoTimeLimit ? saved.timeRemaining : Math.min(saved.timeRemaining, durationMinutes * 60));
      if (saved.activeSubjectName && subjectGroups.some((g) => g.name === saved.activeSubjectName)) {
        setActiveSubjectName(saved.activeSubjectName);
      }
      pendingQuestionTimerRef.current = saved.questionTimerSeconds;
    }

    segmentStartRef.current = Date.now();
    setProgressReady(true);
  }, [stage, questionsQuery.isSuccess, questionsQuery.isFetching, restoreState, orderedQuestions, subjectGroups, isNoTimeLimit, durationMinutes]);

  // Keep ref up-to-date on every render
  useEffect(() => {
    latestStateRef.current = {
      stage,
      attemptId,
      ready: progressReady,
      state: {
        v: 1,
        answers: Array.from(answers.entries()),
        currentQuestionId: currentQuestion?.id ?? null,
        markedForReview: Array.from(markedForReview),
        visitedQuestionIds: Array.from(visitedQuestionIds),
        timeRemaining: Math.max(0, Math.round(timeRemaining)),
        subjectTimerStates,
        activeSubjectName,
        expiredQuestionIds: Array.from(expiredQuestionIds),
        questionTimerSeconds: questionTimerSeconds === null ? null : Math.max(0, Math.round(questionTimerSeconds)),
      },
    };
  });

  const buildSavePayload = useCallback((): SaveProgressInput | null => {
    const { stage, attemptId, ready, state } = latestStateRef.current;
    if (pausedRef.current || stage !== 'testing' || !attemptId || !ready || !state) return null;
    const segmentSeconds = segmentStartRef.current === null
      ? 0
      : Math.floor((Date.now() - segmentStartRef.current) / 1000);
    return { attemptId, elapsedSeconds: elapsedBaseRef.current + segmentSeconds, state };
  }, []);

  const saveProgress = useCallback(async (): Promise<boolean> => {
    const payload = buildSavePayload();
    if (!payload) return true;
    try {
      await postStudentTestItemSaveProgress(payload);
      return true;
    } catch (error) {
      console.error('[saveProgress] Could not save test progress:', error);
      return false;
    }
  }, [buildSavePayload]);

  // Autosave shortly after each change, and every few seconds for the timers
  useEffect(() => {
    if (stage !== 'testing' || !progressReady) return;
    const timeout = setTimeout(() => void saveProgress(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [stage, progressReady, answers, markedForReview, currentQuestionIndex, expiredQuestionIds, activeSubjectName, saveProgress]);

  useEffect(() => {
    if (stage !== 'testing' || !progressReady) return;
    // floot-polling-ok: a write, not a fetch; runs only while the student is sitting a test, so a crash loses at most 30s of timer
    const interval = setInterval(() => void saveProgress(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stage, progressReady, saveProgress]);

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

  // Global timer (non-subject-wise)
  useEffect(() => {
    if (stage !== 'testing' || !questionsQuery.isSuccess || subjectWiseTiming) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (isNoTimeLimit) {
          return prevTime + 1;
        }
        if (prevTime <= 1) {
          clearInterval(timer);
          handleAutoSubmitRef.current?.();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, questionsQuery.isSuccess, subjectWiseTiming, isNoTimeLimit]);

  // Compute effective timeRemaining: sum of all subject remaining times when subjectWiseTiming
  const effectiveTimeRemaining = subjectWiseTiming
    ? totalRemainingSeconds(subjectTimerStates)
    : timeRemaining;

  const handleSubmit = useCallback(() => {
    if (!attemptId || !questionsQuery.data) {
      console.log('[handleSubmit] Cannot submit - missing data:', { attemptId, hasQuestions: !!questionsQuery.data });
      return;
    }

    const formattedAnswers = Array.from(answers.entries())
      .map(([questionId, answer]) => {
        const submission = convertAnswerForSubmission(questionId, answer);
        if (!submission) return null;
        return { ...submission };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null) as Parameters<typeof postStudentTestItemSubmitAttempt>[0]['answers'];

    submitAttemptMutation.mutate({ attemptId, answers: formattedAnswers }, {
      onSuccess: () => {
        // Mark submitted before navigating so the unmount cleanup below does not save the attempt as paused.
        latestStateRef.current.stage = 'submitted';
        setStage('submitted');
        queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
        queryClient.removeQueries({ queryKey: savedAttemptQueryKey(testItemId) });
        // Results are cached for 5 minutes; drop them so the page cannot show an earlier attempt.
        queryClient.removeQueries({ queryKey: [TEST_RESULTS_QUERY_KEY, testItemId] });
        navigate(`/portal/${testItemId}/results`, { replace: true, state: { justSubmitted: true } });
      },
      onError: (error) => {
        console.error('[handleSubmit] Error submitting attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not submit the test.'}`);
      },
    });
  }, [attemptId, answers, questionsQuery.data, submitAttemptMutation, queryClient, navigate, testItemId]);

  const handleAutoSubmit = useCallback(() => {
    console.log('[handleAutoSubmit] Time expired - auto-submitting test');
    alert("Time's up! Your test is being submitted automatically.");
    handleSubmit();
  }, [handleSubmit]);

  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  }, [handleAutoSubmit]);

  /**
   * Mark a subject as submitted (either by timer expiry or manual submit).
   * Then auto-advance to the next unsubmitted subject, or if all done, submit the test.
   */
  const handleSubjectSubmit = useCallback((subjectName: string) => {
    console.log('[handleSubjectSubmit] Submitting subject:', subjectName);

    setSubjectTimerStates(prev => ({
      ...prev,
      [subjectName]: { ...(prev[subjectName] ?? { remaining: 0 }), submitted: true, remaining: 0 },
    }));

    // After marking subject submitted, check if all are done
    setSubjectTimerStates(prev => {
      const updatedStates = {
        ...prev,
        [subjectName]: { ...(prev[subjectName] ?? { remaining: 0 }), submitted: true, remaining: 0 },
      };

      const allDone = areAllSubjectsSubmitted(subjectGroups, updatedStates);
      if (allDone) {
        console.log('[handleSubjectSubmit] All subjects submitted - submitting full test');
        // Use timeout to avoid state update collision
        setTimeout(() => handleAutoSubmitRef.current?.(), 100);
      } else {
        // Navigate to the first unsubmitted subject
        const nextSubject = findFirstUnsubmittedSubject(subjectGroups, updatedStates);
        if (nextSubject) {
          console.log('[handleSubjectSubmit] Advancing to next subject:', nextSubject);
          setActiveSubjectName(nextSubject);
          const nextSubjectGroup = subjectGroups.find(g => g.name === nextSubject);
          if (nextSubjectGroup && nextSubjectGroup.questions.length > 0) {
            const firstQuestionOfNextSubject = nextSubjectGroup.questions[0];
            const globalIndex = orderedQuestions.findIndex(q => q.id === firstQuestionOfNextSubject.id);
            if (globalIndex >= 0) {
              setCurrentQuestionIndex(globalIndex);
            }
          }
        }
      }

      return updatedStates;
    });
  }, [subjectGroups, setSubjectTimerStates]);

  // Handle subject timer expiry
  const handleSubjectExpired = useCallback((subjectName: string) => {
    console.log('[handleSubjectExpired] Timer expired for subject:', subjectName);
    alert(`Time's up for "${subjectName}"! Moving to next subject.`);
    handleSubjectSubmit(subjectName);
  }, [handleSubjectSubmit]);

  useEffect(() => {
    handleSubjectExpiredRef.current = handleSubjectExpired;
  }, [handleSubjectExpired]);

  const handleStartTest = () => {
    startAttemptMutation.mutate({ testItemId }, {
      onSuccess: (data) => {
        elapsedBaseRef.current = 0;
        setRestoreState(null);
        setAttemptId(data.attemptId);
        setStage('testing');
        queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
      },
      onError: (error) => {
        console.error('[handleStartTest] Error starting attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not start the test.'}`);
      },
    });
  };

  const handleResume = () => {
    if (!savedAttempt) return;
    setIsResuming(true);
    postStudentTestItemResumeAttempt({ attemptId: savedAttempt.attemptId })
      .then((data) => {
        elapsedBaseRef.current = data.elapsedSeconds;
        setRestoreState(data.state);
        setAttemptId(data.attemptId);
        setStage('testing');
      })
      .catch((error) => {
        console.error('[handleResume] Error resuming attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not resume the test.'}`);
        void savedAttemptQuery.refetch();
      })
      .finally(() => setIsResuming(false));
  };

  const handleStartOver = async () => {
    if (savedAttempt) {
      setIsDiscarding(true);
      try {
        await postStudentTestItemDiscardAttempt({ attemptId: savedAttempt.attemptId });
        queryClient.invalidateQueries({ queryKey: savedAttemptQueryKey(testItemId) });
      } catch (error) {
        console.error('[handleStartOver] Error clearing paused attempt:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not start a new test.'}`);
        return;
      } finally {
        setIsDiscarding(false);
      }
    }
    handleStartTest();
  };

  // Leave the test: save, then go back past the history entry the Back guard added
  const handlePauseAndLeave = async () => {
    setPauseError(null);
    setIsPausing(true);
    leavingRef.current = true;
    const saved = await saveProgress();
    if (!saved) {
      leavingRef.current = false;
      setIsPausing(false);
      setPauseError('Your progress could not be saved. Check your connection and try again.');
      return;
    }
    pausedRef.current = true;
    queryClient.removeQueries({ queryKey: savedAttemptQueryKey(testItemId) });
    queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
    const here = window.location.href;
    window.history.go(-2);
    setTimeout(() => {
      if (window.location.href === here) navigate('/student/dashboard', { replace: true });
    }, 500);
  };

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
      setPauseError(null);
      setIsLeaveDialogOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stage]);

  // Leaving the page inside the app pauses the attempt instead of submitting it
  useEffect(() => {
    return () => {
      const payload = buildSavePayload();
      if (payload) sendProgressOnExit(payload);
    };
  }, [buildSavePayload]);

  const pausedSummary = useMemo((): PausedAttemptSummary | null => {
    if (!savedAttempt) return null;
    const { state } = savedAttempt;
    const subjectStates = Object.values(state.subjectTimerStates);
    let timeLabel: string | null;
    if (subjectStates.length > 0) {
      const left = subjectStates.filter((s) => !s.submitted).reduce((sum, s) => sum + s.remaining, 0);
      timeLabel = `${describeSeconds(left)} left`;
    } else if (isNoTimeLimit) {
      timeLabel = `${describeSeconds(state.timeRemaining)} spent`;
    } else {
      timeLabel = `${describeSeconds(state.timeRemaining)} left`;
    }
    return {
      answeredCount: savedAttempt.answeredCount,
      totalQuestions: savedAttempt.totalQuestions || totalQuestions,
      timeLabel,
      savedAt: savedAttempt.savedAt,
    };
  }, [savedAttempt, isNoTimeLimit, totalQuestions]);

  const handleAnswerChange = (questionId: number, answer: QuestionAnswer | undefined) => {
    if (answer === undefined) {
      const newAnswers = new Map(answers);
      newAnswers.delete(questionId);
      setAnswers(newAnswers);
    } else {
      setAnswers(new Map(answers.set(questionId, answer)));
    }
  };

  const handleQuestionNavigate = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const renderContent = () => {
    switch (stage) {
      case 'pre-test':
        return (
          <TestPreTestScreen
            testItemTitle={testItemTitle}
            durationMinutes={durationMinutes}
            totalQuestions={totalQuestions}
            onStartTest={handleStartTest}
            isStarting={startAttemptMutation.isPending || isDiscarding}
            isCheckingPaused={savedAttemptQuery.isLoading}
            pausedAttempt={pausedSummary}
            onResume={handleResume}
            onStartOver={() => void handleStartOver()}
            isResuming={isResuming}
          />
        );
      case 'testing': {
        if (questionsQuery.isFetching || (questionsQuery.isSuccess && !progressReady)) {
          return <TestingSkeleton />;
        }
        if (questionsQuery.isError || !questionsQuery.data) {
          return <div className={styles.error}>Failed to load questions. Please try again.</div>;
        }

        return (
          <TestingInterface
            testItemTitle={testItemTitle}
            teacherName={teacherName}
            questions={orderedQuestions as unknown as QuestionData[]}
            answers={answers}
            timeRemaining={effectiveTimeRemaining}
            currentQuestionIndex={currentQuestionIndex}
            onAnswerChange={handleAnswerChange}
            onQuestionNavigate={handleQuestionNavigate}
            onSubmit={handleSubmit}
            isSubmitting={submitAttemptMutation.isPending}
            calculatorEnabled={calculatorEnabled}
            markedForReview={markedForReview}
            visitedQuestionIds={visitedQuestionIds}
            onToggleMarkForReview={handleToggleMarkForReview}
            subjectWiseTiming={subjectWiseTiming}
            subjectTimerStates={subjectTimerStates}
            onSubjectSubmit={handleSubjectSubmit}
            activeSubjectName={activeSubjectName}
            questionWiseTiming={questionWiseTiming}
            questionTimerSeconds={questionTimerSeconds ?? undefined}
            expiredQuestionIds={expiredQuestionIds}
            isNoTimeLimit={isNoTimeLimit}
            onPause={() => {
              setPauseError(null);
              setIsLeaveDialogOpen(true);
            }}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {renderContent()}
      <Dialog
        open={isLeaveDialogOpen && stage === 'testing'}
        onOpenChange={(open) => {
          if (!isPausing) setIsLeaveDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave the test?</DialogTitle>
            <DialogDescription>
              Your answers and remaining time are saved, and the timer stops while you are away. When you open this test again, you can resume where you left off or start a new attempt.
            </DialogDescription>
          </DialogHeader>
          {pauseError && <p className={styles.pauseError}>{pauseError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)} disabled={isPausing}>
              Continue test
            </Button>
            <Button onClick={() => void handlePauseAndLeave()} disabled={isPausing}>
              {isPausing ? 'Saving...' : 'Pause and leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};