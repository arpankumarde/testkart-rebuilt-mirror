import { useState, useEffect, useRef, useCallback } from 'react';
import { SubjectTimerState } from './testingInterfaceTypes';
import { SubjectGroupWithSections } from './testingInterfaceTypes';

/**
 * Initializes subject timer states from subject groups.
 * Each subject gets remaining = durationMinutes * 60, submitted = false.
 * Subjects without durationMinutes are not included.
 */
export function initSubjectTimerStates(subjectGroups: SubjectGroupWithSections[]): SubjectTimerState {
  const states: SubjectTimerState = {};
  for (const group of subjectGroups) {
    if (group.durationMinutes !== null && group.durationMinutes > 0) {
      states[group.name] = {
        remaining: group.durationMinutes * 60,
        submitted: false,
      };
    }
  }
  return states;
}

/**
 * Computes the total remaining seconds across all subjects.
 */
export function totalRemainingSeconds(subjectTimerStates: SubjectTimerState): number {
  return Object.values(subjectTimerStates).reduce((sum, s) => sum + s.remaining, 0);
}

/**
 * Returns the name of the first unsubmitted subject, or null if all are submitted.
 */
export function findFirstUnsubmittedSubject(
  subjectGroups: SubjectGroupWithSections[],
  subjectTimerStates: SubjectTimerState
): string | null {
  for (const group of subjectGroups) {
    const state = subjectTimerStates[group.name];
    if (!state || !state.submitted) {
      return group.name;
    }
  }
  return null;
}

/**
 * Returns true if all subjects that have timers have been submitted.
 */
export function areAllSubjectsSubmitted(
  subjectGroups: SubjectGroupWithSections[],
  subjectTimerStates: SubjectTimerState
): boolean {
  const timedSubjects = subjectGroups.filter(g => g.durationMinutes !== null && g.durationMinutes > 0);
  if (timedSubjects.length === 0) return false;
  return timedSubjects.every(g => subjectTimerStates[g.name]?.submitted === true);
}

interface UseSubjectTimersOptions {
  subjectGroups: SubjectGroupWithSections[];
  isActive: boolean;
  activeSubjectName: string;
  onSubjectExpired: (subjectName: string) => void;
}

interface UseSubjectTimersResult {
  subjectTimerStates: SubjectTimerState;
  setSubjectTimerStates: React.Dispatch<React.SetStateAction<SubjectTimerState>>;
  isInitialized: boolean;
}

/**
 * Hook to manage subject-wise timer states.
 * Ticks down only the active subject's remaining time.
 * Calls onSubjectExpired when a subject's timer reaches 0.
 */
export function useSubjectTimers({
  subjectGroups,
  isActive,
  activeSubjectName,
  onSubjectExpired,
}: UseSubjectTimersOptions): UseSubjectTimersResult {
  const [subjectTimerStates, setSubjectTimerStates] = useState<SubjectTimerState>({});
  const [isInitialized, setIsInitialized] = useState(false);

  const onSubjectExpiredRef = useRef(onSubjectExpired);
  useEffect(() => {
    onSubjectExpiredRef.current = onSubjectExpired;
  }, [onSubjectExpired]);

  // Initialize timer states when subjectGroups become available
  useEffect(() => {
    if (subjectGroups.length === 0 || isInitialized) return;
    const initialStates = initSubjectTimerStates(subjectGroups);
    if (Object.keys(initialStates).length > 0) {
      setSubjectTimerStates(initialStates);
      setIsInitialized(true);
      console.log('[useSubjectTimers] Initialized subject timer states:', initialStates);
    }
  }, [subjectGroups, isInitialized]);

  // Tick down the active subject's timer
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    const timer = setInterval(() => {
      setSubjectTimerStates(prev => {
        const subjectState = prev[activeSubjectName];
        if (!subjectState || subjectState.submitted || subjectState.remaining <= 0) {
          return prev;
        }

        const newRemaining = subjectState.remaining - 1;
        const newStates = {
          ...prev,
          [activeSubjectName]: {
            ...subjectState,
            remaining: newRemaining,
          },
        };

        if (newRemaining <= 0) {
          console.log('[useSubjectTimers] Subject timer expired:', activeSubjectName);
          // Schedule the callback outside of the state update
          setTimeout(() => onSubjectExpiredRef.current(activeSubjectName), 0);
        }

        return newStates;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isInitialized, activeSubjectName]);

  return { subjectTimerStates, setSubjectTimerStates, isInitialized };
}