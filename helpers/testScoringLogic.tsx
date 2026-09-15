/**
 * Test scoring logic for all question types
 */

import { QuestionData } from "./questionTypes";

export type StudentAnswer = 
  | { answerType: 'single'; selectedOption: string }
  | { answerType: 'multiple'; selectedOptions: string[] }
  | { answerType: 'numerical'; numericalAnswer: number }
  | { answerType: 'match'; matchAnswers: Record<string, string> };

export interface ScoringResult {
  // null specifically means the question was not attempted (no answer submitted),
  // distinct from false which means it was attempted and answered incorrectly.
  isCorrect: boolean | null;
  marksObtained: number;
}

// About a thousand rows store negative_marks as a negative number (mostly
// spreadsheet uploads), so the deduction is always taken from the magnitude.
function readMarks(question: QuestionData) {
  const positiveMarks = Number(question.positiveMarks ?? 1);
  const negativeMarks = Math.abs(Number(question.negativeMarks ?? 0)) || 0;
  return { positiveMarks, negativeMarks };
}

const penalty = (negativeMarks: number) => (negativeMarks > 0 ? -negativeMarks : 0);

/**
 * Score a single correct MCQ question
 */
function scoreSingleCorrectMCQ(
  question: QuestionData,
  answer: StudentAnswer
): ScoringResult {
  if (answer.answerType !== 'single') {
    return { isCorrect: false, marksObtained: 0 };
  }

  const isCorrect = question.correctOption === answer.selectedOption;
  const { positiveMarks, negativeMarks } = readMarks(question);

  return {
    isCorrect,
    marksObtained: isCorrect ? positiveMarks : penalty(negativeMarks),
  };
}

/**
 * Score a multiple correct MCQ question
 */
function scoreMultipleCorrectMCQ(
  question: QuestionData,
  answer: StudentAnswer
): ScoringResult {
  if (answer.answerType !== 'multiple') {
    return { isCorrect: false, marksObtained: 0 };
  }

  const correctOptions = question.correctOptions ?? [];
  const selectedOptions = answer.selectedOptions;
  
  const { positiveMarks, negativeMarks } = readMarks(question);
  const partialMarking = question.partialMarking ?? false;

  // Check if all correct options are selected and no wrong options
  const selectedSet = new Set(selectedOptions);
  const correctSet = new Set(correctOptions);
  
  const allCorrectSelected = correctOptions.every(opt => selectedSet.has(opt));
  const noWrongSelected = selectedOptions.every(opt => correctSet.has(opt));
  const isFullyCorrect = allCorrectSelected && noWrongSelected;

  if (!partialMarking) {
    // All or nothing
    return {
      isCorrect: isFullyCorrect,
      marksObtained: isFullyCorrect ? positiveMarks : penalty(negativeMarks),
    };
  } else {
    // Partial marking
    let marks = 0;
    const correctCount = correctOptions.length;
        const totalOptions = ['A', 'B', 'C', 'D', 'E'].filter(opt => {
      const optKey = `option${opt}` as keyof typeof question;
      return (question as any)[optKey] != null && (question as any)[optKey] !== '';
    }).length || 4;

    // Add marks for correct selections
    const correctSelections = selectedOptions.filter(opt => correctSet.has(opt)).length;
    marks += (correctSelections / correctCount) * positiveMarks;

    // Subtract marks for wrong selections
    const wrongSelections = selectedOptions.filter(opt => !correctSet.has(opt)).length;
    marks -= (wrongSelections / totalOptions) * negativeMarks;

    // Ensure minimum 0 marks
    marks = Math.max(0, marks);

    return {
      isCorrect: isFullyCorrect,
      marksObtained: Number(marks.toFixed(2)),
    };
  }
}

/**
 * Score a numerical question
 */
function scoreNumerical(
  question: QuestionData,
  answer: StudentAnswer
): ScoringResult {
  if (answer.answerType !== 'numerical') {
    return { isCorrect: false, marksObtained: 0 };
  }

  const correctAnswer = Number(question.numericalAnswer ?? 0);
  const tolerance = Number(question.numericalTolerance ?? 0);
  const studentAnswer = answer.numericalAnswer;

  const isCorrect = Math.abs(studentAnswer - correctAnswer) <= tolerance;
  const { positiveMarks, negativeMarks } = readMarks(question);

  return {
    isCorrect,
    marksObtained: isCorrect ? positiveMarks : penalty(negativeMarks),
  };
}

export interface MatchAnswerRow {
  leftIndex: number;
  leftText: string;
  correctRightIndex: number | null;
  correctText: string | null;
  studentRightIndex: number | null;
  studentText: string | null;
  isCorrect: boolean;
}

export interface StoredMatchData {
  leftItems: string[];
  rightItems: string[];
  correctMatches: Record<string, string>;
}

// Some write paths passed JSON text into the jsonb column, so stored match data
// can be an object, a JSON string, or a doubly encoded string. Returns null when
// nothing usable is stored.
export function parseStoredMatchData(value: unknown): StoredMatchData | null {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as { leftItems?: unknown; rightItems?: unknown; correctMatches?: unknown };
  if (!Array.isArray(data.leftItems) || !Array.isArray(data.rightItems)) return null;
  const correctMatches: Record<string, string> = {};
  if (data.correctMatches && typeof data.correctMatches === "object" && !Array.isArray(data.correctMatches)) {
    for (const [key, match] of Object.entries(data.correctMatches as Record<string, unknown>)) {
      if (match != null) correctMatches[key] = String(match);
    }
  }
  return {
    leftItems: data.leftItems.map((item) => String(item ?? "")),
    rightItems: data.rightItems.map((item) => String(item ?? "")),
    correctMatches,
  };
}

const normalizeItemText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const toItemList = (items: unknown): string[] =>
  Array.isArray(items) ? items.map((item) => String(item ?? "")) : [];

// The teacher form stores the answer key by position ("0" -> "2") while the
// student player submits item texts ("Mercury" -> "Closest planet"), and
// answers in both shapes are already stored. `prefer` picks which reading
// wins when a numeric string could be either.
function resolveItemIndexes(items: string[], raw: unknown, prefer: "index" | "text"): number[] {
  const text = String(raw ?? "");
  const trimmed = text.trim();
  const byIndex =
    /^\d+$/.test(trimmed) && (items.length === 0 || Number(trimmed) < items.length) ? [Number(trimmed)] : [];
  const target = normalizeItemText(text);
  const byText: number[] = [];
  if (target) {
    items.forEach((item, index) => {
      if (normalizeItemText(item) === target) byText.push(index);
    });
  }
  if (prefer === "index") return byIndex.length > 0 ? byIndex : byText;
  return byText.length > 0 ? byText : byIndex;
}

/**
 * One row per left item: the correct right item, the student's pick and
 * whether they agree. Shared by scoring and the results view so both read
 * stored answers the same way.
 */
export function getMatchAnswerRows(
  matchData: unknown,
  studentAnswers: Record<string, string> | null | undefined
): MatchAnswerRow[] {
  const data = parseStoredMatchData(matchData);
  const leftItems = toItemList(data?.leftItems);
  const rightItems = toItemList(data?.rightItems);
  const correctMatches: Record<string, unknown> = data?.correctMatches ?? {};

  const correctByLeft = new Map<number, number>();
  for (const [key, value] of Object.entries(correctMatches)) {
    const [right] = resolveItemIndexes(rightItems, value, "index");
    if (right === undefined) continue;
    for (const left of resolveItemIndexes(leftItems, key, "index")) {
      if (!correctByLeft.has(left)) correctByLeft.set(left, right);
    }
  }

  const studentByLeft = new Map<number, number[]>();
  for (const [key, value] of Object.entries(studentAnswers ?? {})) {
    if (value == null || String(value).trim() === "") continue;
    const rights = resolveItemIndexes(rightItems, value, "text");
    if (rights.length === 0) continue;
    for (const left of resolveItemIndexes(leftItems, key, "text")) {
      studentByLeft.set(left, rights);
    }
  }

  const knownIndexes = [...Array.from(correctByLeft.keys()), ...Array.from(studentByLeft.keys())];
  const rowCount = leftItems.length || (knownIndexes.length > 0 ? Math.max(...knownIndexes) + 1 : 0);

  return Array.from({ length: rowCount }, (_, leftIndex) => {
    const correctRightIndex = correctByLeft.get(leftIndex) ?? null;
    const picks = studentByLeft.get(leftIndex) ?? [];
    const isCorrect = correctRightIndex !== null && picks.includes(correctRightIndex);
    const studentRightIndex = isCorrect ? correctRightIndex : picks[0] ?? null;
    return {
      leftIndex,
      leftText: leftItems[leftIndex] ?? String(leftIndex + 1),
      correctRightIndex,
      correctText: correctRightIndex === null ? null : rightItems[correctRightIndex] ?? null,
      studentRightIndex,
      studentText: studentRightIndex === null ? null : rightItems[studentRightIndex] ?? null,
      isCorrect,
    };
  });
}

/**
 * Score a match the following question
 */
function scoreMatchTheFollowing(
  question: QuestionData,
  answer: StudentAnswer
): ScoringResult {
  if (answer.answerType !== 'match') {
    return { isCorrect: false, marksObtained: 0 };
  }

  const keyedRows = getMatchAnswerRows(question.matchData, answer.matchAnswers).filter(
    (row) => row.correctRightIndex !== null
  );
  const totalMatches = keyedRows.length;
  if (totalMatches === 0 || keyedRows.every((row) => row.studentRightIndex === null)) {
    return { isCorrect: false, marksObtained: 0 };
  }

  const correctCount = keyedRows.filter((row) => row.isCorrect).length;
  const { positiveMarks, negativeMarks } = readMarks(question);
  const partialMarking = question.partialMarking ?? false;

  const isFullyCorrect = correctCount === totalMatches;

  if (!partialMarking) {
    return {
      isCorrect: isFullyCorrect,
      marksObtained: isFullyCorrect ? positiveMarks : penalty(negativeMarks),
    };
  } else {
    // Proportional marks based on correct matches
    const proportionalMarks = (correctCount / totalMatches) * positiveMarks;
    return {
      isCorrect: isFullyCorrect,
      marksObtained: Number(proportionalMarks.toFixed(2)),
    };
  }
}

/**
 * Main scoring function that routes to the appropriate scorer based on question type
 */
export function scoreQuestion(
  question: QuestionData,
  answer: StudentAnswer | undefined
): ScoringResult {
  // If no answer provided, the question was not attempted: 0 marks, and
  // isCorrect is null (not false) so callers can distinguish "not attempted"
  // from "attempted but wrong".
  if (!answer) {
    return { isCorrect: null, marksObtained: 0 };
  }

  // Cast to string for switch statement comparison
  const questionType = String(question.questionType ?? 'single_correct_mcq');

  switch (questionType) {
    case 'single_correct_mcq':
    case 'assertion_reason':
    case 'comprehension':
      return scoreSingleCorrectMCQ(question, answer);
    
    case 'multiple_correct_mcq':
      return scoreMultipleCorrectMCQ(question, answer);
    
    case 'numerical':
      return scoreNumerical(question, answer);
    
    case 'match_the_following':
      return scoreMatchTheFollowing(question, answer);
    
    default:
      return { isCorrect: false, marksObtained: 0 };
  }
}

/**
 * Calculate total possible marks for a set of questions
 */
export function calculateMaxPossibleMarks(questions: QuestionData[]): number {
  return questions.reduce((total, question) => {
    const positiveMarks = Number(question.positiveMarks ?? 1);
    return total + positiveMarks;
  }, 0);
}

export interface QuestionDataWithLimits extends QuestionData {
  subjectId: number | null;
  sectionId: number | null;
  subjectMaxAttemptsAllowed: number | null;
  sectionMaxAttemptsAllowed: number | null;
}

/**
 * Calculate total possible marks for a set of questions, respecting subject and section attempt limits.
 * Assumes that limits are meant to constrain the maximum score by taking the highest value questions.
 */
export function calculateMaxPossibleMarksWithLimits(
  questions: QuestionDataWithLimits[]
): number {
  let totalMarks = 0;

  // Group by subjectId (using 'null' for questions without subject)
  const bySubject: Record<string, QuestionDataWithLimits[]> = {};
  for (const q of questions) {
    const sId = q.subjectId === null ? "null" : String(q.subjectId);
    if (!bySubject[sId]) bySubject[sId] = [];
    bySubject[sId].push(q);
  }

  for (const subjectId in bySubject) {
    const subjectQs = bySubject[subjectId];
    const hasSections = subjectQs.some((q) => q.sectionId !== null);

    if (hasSections) {
      // Group by sectionId
      const bySection: Record<string, QuestionDataWithLimits[]> = {};
      const unsectioned: QuestionDataWithLimits[] = [];

      for (const q of subjectQs) {
        if (q.sectionId === null) {
          unsectioned.push(q);
        } else {
          const secId = String(q.sectionId);
          if (!bySection[secId]) bySection[secId] = [];
          bySection[secId].push(q);
        }
      }

      // Process unsectioned
      for (const q of unsectioned) {
        totalMarks += Number(q.positiveMarks ?? 1);
      }

      // Process sectioned
      for (const secId in bySection) {
        const sectionQs = bySection[secId];
        const limit = sectionQs[0].sectionMaxAttemptsAllowed;

        // Sort descending by positive marks
        const sorted = [...sectionQs].sort(
          (a, b) => Number(b.positiveMarks ?? 1) - Number(a.positiveMarks ?? 1)
        );

        const countToTake = limit !== null ? Math.min(limit, sorted.length) : sorted.length;
        for (let i = 0; i < countToTake; i++) {
          totalMarks += Number(sorted[i].positiveMarks ?? 1);
        }
      }
    } else {
      // No sections, check subject limit
      const limit = subjectQs.length > 0 ? subjectQs[0].subjectMaxAttemptsAllowed : null;

      const sorted = [...subjectQs].sort(
        (a, b) => Number(b.positiveMarks ?? 1) - Number(a.positiveMarks ?? 1)
      );

      const countToTake = limit !== null ? Math.min(limit, sorted.length) : sorted.length;
      for (let i = 0; i < countToTake; i++) {
        totalMarks += Number(sorted[i].positiveMarks ?? 1);
      }
    }
  }

  return totalMarks;
}