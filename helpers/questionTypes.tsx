/**
 * Simplified types for question data that matches runtime DB results
 * This avoids the complexity of Kysely's ColumnType wrappers
 */

export type QuestionType = 
  | 'single_correct_mcq' 
  | 'multiple_correct_mcq' 
  | 'numerical' 
  | 'match_the_following' 
  | 'assertion_reason' 
  | 'comprehension';

export interface QuestionData {
  id: number;
  questionType: QuestionType | null;
  correctOption: string | null;
  correctOptions: string[] | null;
  numericalAnswer: string | number | null;
  numericalTolerance: string | number | null;
  positiveMarks: string | number | null;
  negativeMarks: string | number | null;
  partialMarking: boolean | null;
  matchData: unknown;
  explanation: string | null;
}