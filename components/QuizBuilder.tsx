import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { ConsoleConfirmDialog } from './ConsoleConfirmDialog';
import styles from './QuizBuilder.module.css';

export interface QuizQuestion {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
}

export interface QuizData {
  questions: QuizQuestion[];
}

interface QuizBuilderProps {
  value: QuizData | null;
  onChange: (data: QuizData) => void;
}

export const QuizBuilder: React.FC<QuizBuilderProps> = ({ value, onChange }) => {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const questions = value?.questions || [];

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: '',
    };
    onChange({ questions: [...questions, newQuestion] });
    setExpandedQuestionId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    const updatedQuestions = questions.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    );
    onChange({ questions: updatedQuestions });
  };

  const deleteQuestion = (id: string) => {
    onChange({ questions: questions.filter((q) => q.id !== id) });
    if (expandedQuestionId === id) {
      setExpandedQuestionId(null);
    }
  };

  const deleteTargetIndex = questions.findIndex((q) => q.id === deleteTargetId);

  const toggleExpanded = (id: string) => {
    setExpandedQuestionId(expandedQuestionId === id ? null : id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Quiz Questions ({questions.length})</h4>
        <Button type="button" onClick={addQuestion} size="sm">
          <Plus size={16} /> Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No questions added yet. Click "Add Question" to get started.</p>
        </div>
      ) : (
        <div className={styles.questionsList}>
          {questions.map((question, index) => {
            const isExpanded = expandedQuestionId === question.id;
            const isComplete = question.questionText && question.optionA && question.optionB && question.optionC && question.optionD;

            return (
              <div key={question.id} className={styles.questionCard}>
                <div className={styles.questionHeader} onClick={() => toggleExpanded(question.id)}>
                  <div className={styles.questionHeaderLeft}>
                    <span className={styles.questionNumber}>#{index + 1}</span>
                    <span className={styles.questionPreview}>
                      {question.questionText || 'Untitled Question'}
                    </span>
                    {!isComplete && <span className={styles.incompleteBadge}>Incomplete</span>}
                  </div>
                  <div className={styles.questionHeaderRight}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete question ${index + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(question.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.questionBody}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Question Text *</label>
                      <Textarea
                        placeholder="Enter your question here"
                        rows={3}
                        value={question.questionText}
                        onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
                      />
                    </div>

                    <div className={styles.optionsGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Option A *</label>
                        <Input
                          placeholder="Option A"
                          value={question.optionA}
                          onChange={(e) => updateQuestion(question.id, { optionA: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Option B *</label>
                        <Input
                          placeholder="Option B"
                          value={question.optionB}
                          onChange={(e) => updateQuestion(question.id, { optionB: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Option C *</label>
                        <Input
                          placeholder="Option C"
                          value={question.optionC}
                          onChange={(e) => updateQuestion(question.id, { optionC: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Option D *</label>
                        <Input
                          placeholder="Option D"
                          value={question.optionD}
                          onChange={(e) => updateQuestion(question.id, { optionD: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Correct Answer *</label>
                      <Select
                        value={question.correctAnswer}
                        onValueChange={(value) => updateQuestion(question.id, { correctAnswer: value as 'A' | 'B' | 'C' | 'D' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Explanation (Optional)</label>
                      <Textarea
                        placeholder="Explain why this is the correct answer"
                        rows={2}
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* The builder sits inside the lesson form; keep the dialog's own submit from saving the lesson. */}
      <div style={{ display: 'contents' }} onSubmit={(e) => e.stopPropagation()}>
        <ConsoleConfirmDialog
          open={deleteTargetId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
          tone="destructive"
          icon={<Trash2 size={20} />}
          title="Delete this question?"
          description={`Question ${deleteTargetIndex + 1} is removed from the quiz when you save the lesson.`}
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteTargetId) deleteQuestion(deleteTargetId);
            setDeleteTargetId(null);
          }}
        />
      </div>
    </div>
  );
};