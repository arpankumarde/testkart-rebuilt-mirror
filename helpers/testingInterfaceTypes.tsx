import { QuestionData } from './questionAnswerTypes';

/**
 * Extended question data that includes section and subject attempt limit fields
 * returned by the student test-item/questions endpoint.
 */
export interface ExtendedQuestionData extends QuestionData {
  sectionId: number | null;
  sectionName: string | null;
  sectionOrderIndex: number | null;
  sectionMaxAttemptsAllowed: number | null;
  subjectMaxAttemptsAllowed: number | null;
  subjectDurationMinutes: number | null;
  durationSeconds: number | null;
}

export interface SectionGroup {
  id: number | null;
  name: string;
  orderIndex: number;
  maxAttemptsAllowed: number | null;
  questions: ExtendedQuestionData[];
}

export interface SubjectGroupWithSections {
  name: string;
  orderIndex: number;
  maxAttemptsAllowed: number | null;
  durationMinutes: number | null;
  sections: SectionGroup[];
  /** Flat list of all questions across all sections in this subject */
  questions: ExtendedQuestionData[];
}

export interface SubjectStat {
  name: string;
  totalQuestions: number;
  answeredQuestions: number;
  maxAttemptsAllowed: number | null;
  durationMinutes: number | null;
  submitted: boolean;
  sections: SectionStat[];
}

/**
 * Timer state for subjects with time limits.
 * Maps subject name to its remaining seconds and submission status.
 */
export type SubjectTimerState = {
  [subjectName: string]: { remaining: number; submitted: boolean };
};

/**
 * Returns true if the given subject has been submitted via its timer.
 */
export function isSubjectSubmitted(
  subjectName: string,
  subjectTimerStates: SubjectTimerState
): boolean {
  return subjectTimerStates[subjectName]?.submitted === true;
}

/**
 * Returns true if the given subject's timer has expired (remaining === 0 and submitted).
 */
export function isSubjectTimerExpired(
  subjectName: string,
  subjectTimerStates: SubjectTimerState
): boolean {
  const state = subjectTimerStates[subjectName];
  if (!state) return false;
  return state.remaining <= 0 && state.submitted;
}

export interface SectionStat {
  id: number | null;
  name: string;
  totalQuestions: number;
  answeredQuestions: number;
  maxAttemptsAllowed: number | null;
}

/**
 * Cast a QuestionData array to ExtendedQuestionData array.
 * The endpoint returns these extra fields; they just aren't in the base QuestionData type.
 */
export function castToExtendedQuestions(questions: QuestionData[]): ExtendedQuestionData[] {
  return questions as ExtendedQuestionData[];
}

/**
 * Build subject groups with nested section groups from a flat list of questions.
 */
export function buildSubjectGroups(questions: ExtendedQuestionData[]): SubjectGroupWithSections[] {
  const subjectMap = new Map<string, SubjectGroupWithSections>();

  for (const question of questions) {
    const subjectName = question.subjectName || 'General Questions';

    if (!subjectMap.has(subjectName)) {
      subjectMap.set(subjectName, {
        name: subjectName,
        orderIndex: question.subjectOrderIndex ?? 999999,
        maxAttemptsAllowed: question.subjectMaxAttemptsAllowed ?? null,
        durationMinutes: question.subjectDurationMinutes ?? null,
        sections: [],
        questions: [],
      });
    }

    const subjectGroup = subjectMap.get(subjectName)!;
    subjectGroup.questions.push(question);

    // Find or create section within subject
    const sectionId = question.sectionId ?? null;
    const sectionName = question.sectionName || 'General';
    const sectionOrderIndex = question.sectionOrderIndex ?? 999999;
    const sectionMaxAttempts = question.sectionMaxAttemptsAllowed ?? null;

    let section = subjectGroup.sections.find(s => s.id === sectionId);
    if (!section) {
      section = {
        id: sectionId,
        name: sectionName,
        orderIndex: sectionOrderIndex,
        maxAttemptsAllowed: sectionMaxAttempts,
        questions: [],
      };
      subjectGroup.sections.push(section);
    }
    section.questions.push(question);
  }

  // Sort subjects by orderIndex, then sort sections within each subject
  const sortedGroups = Array.from(subjectMap.values())
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (const group of sortedGroups) {
    group.sections.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const section of group.sections) {
      section.questions.sort((a, b) => a.id - b.id);
    }
    // Re-build flat questions list in order
    group.questions = group.sections.flatMap(s => s.questions);
  }

  return sortedGroups;
}

/**
 * Compute whether a given question is locked due to attempt limits.
 * A question is locked if:
 * - It is unanswered (not in answeredIds), AND
 * - Its section (or subject when no sections) has maxAttemptsAllowed set, AND
 * - The number of answered questions in that section/subject >= maxAttemptsAllowed.
 */
export function isQuestionLocked(
  question: ExtendedQuestionData,
  subjectGroup: SubjectGroupWithSections,
  answeredIds: Set<number>
): boolean {
  const isAnswered = answeredIds.has(question.id);
  if (isAnswered) return false; // Already answered – can always change/clear

  // Check section-level limit first
  const section = subjectGroup.sections.find(s => s.id === question.sectionId);
  if (section && section.maxAttemptsAllowed !== null) {
    const answeredInSection = section.questions.filter(q => answeredIds.has(q.id)).length;
    if (answeredInSection >= section.maxAttemptsAllowed) {
      return true;
    }
  } else if (section === undefined || section?.maxAttemptsAllowed === null) {
    // Fall back to subject-level limit only when the subject has no per-section limits
    const subjectHasSectionLimits = subjectGroup.sections.some(s => s.maxAttemptsAllowed !== null);
    if (!subjectHasSectionLimits && subjectGroup.maxAttemptsAllowed !== null) {
      const answeredInSubject = subjectGroup.questions.filter(q => answeredIds.has(q.id)).length;
      if (answeredInSubject >= subjectGroup.maxAttemptsAllowed) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Build subject stats including section stats for the submit dialog.
 */
export function buildSubjectStats(
  subjectGroups: SubjectGroupWithSections[],
  answeredIds: Set<number>,
  subjectTimerStates?: SubjectTimerState
): SubjectStat[] {
  return subjectGroups.map(group => ({
    name: group.name,
    totalQuestions: group.questions.length,
    answeredQuestions: group.questions.filter(q => answeredIds.has(q.id)).length,
    maxAttemptsAllowed: group.maxAttemptsAllowed,
    durationMinutes: group.durationMinutes,
    submitted: subjectTimerStates ? isSubjectSubmitted(group.name, subjectTimerStates) : false,
    sections: group.sections.map(section => ({
      id: section.id,
      name: section.name,
      totalQuestions: section.questions.length,
      answeredQuestions: section.questions.filter(q => answeredIds.has(q.id)).length,
      maxAttemptsAllowed: section.maxAttemptsAllowed,
    })),
  }));
}