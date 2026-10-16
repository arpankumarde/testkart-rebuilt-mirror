import React, { useState } from "react";
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import { CurrentAffairsTagPicker } from "./CurrentAffairsTagPicker";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type {
  CurrentAffairsQuestionInput,
  CurrentAffairsTagRef,
  InputType,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsTagOption } from "../endpoints/admin/current-affairs/tags_GET.schema";
import styles from "./CurrentAffairsQuizEditor.module.css";

type Quiz = NonNullable<InputType["quiz"]>;

interface CurrentAffairsQuizEditorProps {
  quiz: Quiz | null;
  onChange: (quiz: Quiz | null) => void;
  tagOptions: CurrentAffairsTagOption[];
  postTags: CurrentAffairsTagRef[];
  /* Suggested quiz title, e.g. from the digest date. */
  defaultTitle: string;
}

const LETTERS = ["A", "B", "C", "D"];
const MAX_QUESTIONS = 50;

const emptyQuestion = (tags: CurrentAffairsTagRef[]): CurrentAffairsQuestionInput => ({
  key: `q-${Math.random().toString(36).slice(2, 10)}`,
  question: "",
  options: Array.from({ length: currentAffairsMeta.OPTIONS_PER_QUESTION }, () => ""),
  correctOption: null,
  explanation: "",
  tags,
});

const isBlankQuestion = (q: CurrentAffairsQuestionInput) =>
  !q.question.trim() && q.options.every((o) => !o.trim()) && !q.explanation.trim();

export const CurrentAffairsQuizEditor: React.FC<CurrentAffairsQuizEditorProps> = ({
  quiz,
  onChange,
  tagOptions,
  postTags,
  defaultTitle,
}) => {
  const [confirmRemoveQuiz, setConfirmRemoveQuiz] = useState(false);

  if (!quiz) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <ListChecks size={22} />
        </span>
        <div className={styles.emptyText}>
          <p className={styles.emptyTitle}>No quiz on this post</p>
          <p className={styles.emptyHint}>The public page shows it under the digest; anyone can attempt it without signing in.</p>
        </div>
        <Button
          onClick={() =>
            onChange({
              title: defaultTitle,
              questionCount: currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS,
              isPublished: false,
              questions: Array.from({ length: currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS }, () => emptyQuestion(postTags)),
            })
          }
        >
          <Plus size={16} /> Add a {currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS}-question quiz
        </Button>
      </div>
    );
  }

  const setQuiz = (patch: Partial<Quiz>) => onChange({ ...quiz, ...patch });
  const setQuestions = (questions: CurrentAffairsQuestionInput[]) => setQuiz({ questions });
  const updateQuestion = (index: number, patch: Partial<CurrentAffairsQuestionInput>) =>
    setQuestions(quiz.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  // Raising the count adds blank questions; lowering it drops only trailing blank ones.
  const setCount = (raw: number) => {
    const count = Math.min(MAX_QUESTIONS, Math.max(1, Math.round(raw) || 1));
    const questions = [...quiz.questions];
    while (questions.length < count) questions.push(emptyQuestion(postTags));
    while (questions.length > count && isBlankQuestion(questions[questions.length - 1])) questions.pop();
    onChange({ ...quiz, questionCount: count, questions });
  };

  const move = (from: number, to: number) => {
    const questions = [...quiz.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    setQuestions(questions);
  };

  const removeQuestion = (index: number) => {
    const questions = quiz.questions.filter((_, i) => i !== index);
    onChange({ ...quiz, questions, questionCount: Math.max(1, questions.length) });
  };

  const addQuestion = () => {
    const questions = [...quiz.questions, emptyQuestion(postTags)];
    onChange({ ...quiz, questions, questionCount: questions.length });
  };

  const answered = quiz.questions.filter((q) => q.correctOption !== null && q.question.trim()).length;

  return (
    <div className={styles.root}>
      <div className={styles.settings}>
        <FormItem name="quiz.title" className={styles.titleField}>
          <FormLabel>Quiz title</FormLabel>
          <FormControl>
            <Input value={quiz.title} placeholder={defaultTitle} onChange={(e) => setQuiz({ title: e.target.value })} />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="quiz.questionCount" className={styles.countField}>
          <FormLabel>Questions</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={MAX_QUESTIONS}
              value={quiz.questionCount}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </div>

      <div className={styles.publishRow}>
        <div>
          <p className={styles.publishLabel}>Show the quiz on the site</p>
          <p className={styles.publishHint}>
            It goes live only together with the post. Turning this on makes every question required.
          </p>
        </div>
        <Switch
          checked={quiz.isPublished}
          onCheckedChange={(isPublished) => setQuiz({ isPublished })}
          aria-label="Show the quiz on the site"
        />
      </div>

      <p className={styles.progress} aria-live="polite">
        {answered} of {quiz.questions.length} questions have a question and an answer marked
      </p>

      <ol className={styles.questions}>
        {quiz.questions.map((question, index) => {
          const base = `quiz.questions.${index}`;
          return (
            <li key={question.key} className={styles.question}>
              <div className={styles.questionHead}>
                <span className={styles.qNumber}>Q{index + 1}</span>
                <div className={styles.questionActions}>
                  <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Move question up">
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === quiz.questions.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label="Move question down"
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={styles.danger}
                    disabled={quiz.questions.length === 1}
                    onClick={() => removeQuestion(index)}
                    aria-label={`Delete question ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <FormItem name={`${base}.question`}>
                <FormLabel>Question</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    value={question.question}
                    onChange={(e) => updateQuestion(index, { question: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name={`${base}.correctOption`}>
                <FormLabel>Options - select the correct answer</FormLabel>
                <RadioGroup
                  value={question.correctOption === null ? "" : String(question.correctOption)}
                  onValueChange={(value) => updateQuestion(index, { correctOption: Number(value) })}
                  className={styles.options}
                  aria-label={`Correct answer for question ${index + 1}`}
                >
                  {question.options.map((option, optionIndex) => {
                    const isCorrect = question.correctOption === optionIndex;
                    return (
                      <div key={optionIndex} className={`${styles.option} ${isCorrect ? styles.optionCorrect : ""}`}>
                        <RadioGroupItem value={String(optionIndex)} aria-label={`Option ${LETTERS[optionIndex]} is correct`} />
                        <span className={styles.letter}>{LETTERS[optionIndex]}</span>
                        <FormItem name={`${base}.options.${optionIndex}`} className={styles.optionField}>
                          <FormControl>
                            <Input
                              value={option}
                              aria-label={`Option ${LETTERS[optionIndex]}`}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  options: question.options.map((o, i) => (i === optionIndex ? e.target.value : o)),
                                })
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                    );
                  })}
                </RadioGroup>
                <FormMessage />
              </FormItem>

              <FormItem name={`${base}.explanation`}>
                <FormLabel>Explanation</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    value={question.explanation}
                    placeholder="Shown after the student answers."
                    onChange={(e) => updateQuestion(index, { explanation: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <CurrentAffairsTagPicker
                value={question.tags}
                onChange={(tags) => updateQuestion(index, { tags })}
                options={tagOptions}
                kinds={["topic", "exam"]}
                variant="compact"
              />
            </li>
          );
        })}
      </ol>

      <div className={styles.footer}>
        <Button variant="outline" onClick={addQuestion} disabled={quiz.questions.length >= MAX_QUESTIONS}>
          <Plus size={16} /> Add question
        </Button>
        <Button variant="ghost" className={styles.danger} onClick={() => setConfirmRemoveQuiz(true)}>
          <Trash2 size={16} /> Remove quiz
        </Button>
      </div>

      <ConsoleConfirmDialog
        open={confirmRemoveQuiz}
        onOpenChange={setConfirmRemoveQuiz}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Remove the quiz?"
        description="All its questions are removed from this post when you save."
        confirmLabel="Remove quiz"
        onConfirm={() => {
          setConfirmRemoveQuiz(false);
          onChange(null);
        }}
      />
    </div>
  );
};