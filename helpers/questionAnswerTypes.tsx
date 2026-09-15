/**
 * Type definitions for question answers across all question types
 */

export type QuestionType = 
  | 'single_correct_mcq' 
  | 'multiple_correct_mcq' 
  | 'numerical' 
  | 'assertion_reason' 
  | 'comprehension' 
  | 'match_the_following';

export type MCQOption = 'A' | 'B' | 'C' | 'D' | 'E';

export type QuestionAnswer = 
  | { type: 'single'; value: MCQOption }
  | { type: 'multiple'; value: MCQOption[] }
  | { type: 'numerical'; value: number }
  | { type: 'match'; value: Record<string, string> };

export interface MatchData {
  leftItems: string[];
  rightItems: string[];
  correctMatches: Record<string, string>;
}

export interface QuestionData {
  id: number;
  questionText: string;
  questionType: QuestionType;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  subjectName: string | null;
  subjectOrderIndex: number | null;
  paragraphText?: string | null;
  matchData?: MatchData | null;
  numericalAnswer?: number | null;
  numericalTolerance?: number | null;
  correctOptions?: string[] | null;
  partialMarking?: boolean | null;
  positiveMarks?: number | null;
  negativeMarks?: number | null;
}

/**
 * Type guards
 */
export function isSingleAnswer(answer: QuestionAnswer): answer is { type: 'single'; value: MCQOption } {
  return answer.type === 'single';
}

export function isMultipleAnswer(answer: QuestionAnswer): answer is { type: 'multiple'; value: MCQOption[] } {
  return answer.type === 'multiple';
}

export function isNumericalAnswer(answer: QuestionAnswer): answer is { type: 'numerical'; value: number } {
  return answer.type === 'numerical';
}

export function isMatchAnswer(answer: QuestionAnswer): answer is { type: 'match'; value: Record<string, string> } {
  return answer.type === 'match';
}

/**
 * Convert QuestionAnswer to submission format
 * Note: The current backend endpoint only supports single MCQ format.
 * This function prepares for future backend updates.
 */
export function convertAnswerForSubmission(questionId: number, answer: QuestionAnswer | undefined) {
  if (!answer) {
    return null;
  }

  switch (answer.type) {
    case 'single':
      return {
        questionId,
        answerType: 'single' as const,
        selectedOption: answer.value,
      };
    case 'multiple':
      return {
        questionId,
        answerType: 'multiple' as const,
        selectedOptions: answer.value,
      };
    case 'numerical':
      return {
        questionId,
        answerType: 'numerical' as const,
        numericalAnswer: answer.value,
      };
    case 'match':
      return {
        questionId,
        answerType: 'match' as const,
        matchAnswers: answer.value,
      };
  }
}