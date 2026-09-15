import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTestQuestionsQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../helpers/useTestAttemptMutations';
import { ENROLLED_TESTS_QUERY_KEY } from '../helpers/useEnrolledTestsQuery';
import { TEST_RESULTS_QUERY_KEY } from '../helpers/useTestResultsQuery';
import { postStudentTestItemSubmitAttempt } from '../endpoints/student/test-item/submit-attempt_POST.schema';
import { TestPreTestScreen } from './TestPreTestScreen';
import { TestingInterface, TestingSkeleton } from './TestingInterface';
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

  // Store latest values in ref for cleanup
  const latestStateRef = useRef<{
    stage: Stage;
    attemptId: number | null;
    hasQuestions: boolean;
    answersMap: Map<number, QuestionAnswer>;
  }>({
    stage: 'pre-test',
    attemptId: null,
    hasQuestions: false,
    answersMap: new Map(),
  });

  const canFetchQuestions = attemptId !== null;
  const questionsQuery = useTestQuestionsQuery(canFetchQuestions ? testItemId : undefined, attemptId);
  const startAttemptMutation = useStartAttemptMutation(testItemId);
  const submitAttemptMutation = useSubmitAttemptMutation(attemptId ?? 0);

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
  });

  // Keep ref up-to-date on every render
  // Reset and handle question timer when current question changes
  useEffect(() => {
    if (stage === 'testing' && questionWiseTiming && currentQuestion) {
      if (!expiredQuestionIds.has(currentQuestion.id)) {
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

  // Keep ref up-to-date on every render
  useEffect(() => {
    latestStateRef.current = {
      stage,
      attemptId,
      hasQuestions: !!questionsQuery.data,
      answersMap: answers,
    };
  });

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
        // Mark submitted before navigating so the unmount cleanup below cannot submit the attempt a second time.
        latestStateRef.current.stage = 'submitted';
        setStage('submitted');
        queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
        // Results are cached for 5 minutes; drop them so the page cannot show an earlier attempt.
        queryClient.removeQueries({ queryKey: [TEST_RESULTS_QUERY_KEY, testItemId] });
        navigate(`/portal/${testItemId}/results`, { replace: true });
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

  // Warn user before leaving during an active test
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

  // Auto-submit test on component unmount during active test
  useEffect(() => {
    return () => {
      const { stage, attemptId, hasQuestions, answersMap } = latestStateRef.current;
      if (stage === 'testing' && attemptId && hasQuestions) {
        const formattedAnswers = Array.from(answersMap.entries())
          .map(([questionId, answer]) => convertAnswerForSubmission(questionId, answer))
          .filter((a): a is NonNullable<typeof a> => a !== null) as Parameters<typeof postStudentTestItemSubmitAttempt>[0]['answers'];

        console.log('[Cleanup] Auto-submitting test on unmount:', { attemptId, answersCount: formattedAnswers.length });
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
            isStarting={startAttemptMutation.isPending}
          />
        );
      case 'testing': {
        if (questionsQuery.isFetching) {
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
          />
        );
      }
      default:
        return null;
    }
  };

  return <div className={`${styles.container} ${className || ''}`}>{renderContent()}</div>;
};