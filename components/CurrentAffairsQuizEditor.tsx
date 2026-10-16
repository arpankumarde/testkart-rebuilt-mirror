import React, { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ListChecks, Loader2, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import { CurrentAffairsTagPicker } from "./CurrentAffairsTagPicker";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useGenerateCurrentAffairsQuizMutation } from "../helpers/useAdminCurrentAffairs";
import type {
  CurrentAffairsQuestionInput,
  CurrentAffairsTagRef,
  InputType,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import {
  MAX_GENERATED_QUESTIONS,
  type InputType as GenerateInput,
} from "../endpoints/admin/current-affairs/generate-quiz_POST.schema";
import type { CurrentAffairsTagOption } from "../endpoints/admin/current-affairs/tags_GET.schema";
import styles from "./CurrentAffairsQuizEditor.module.css";

type Quiz = NonNullable<InputType["quiz"]>;
type Difficulty = GenerateInput["difficulty"];
/** The digest content the AI may draw on, straight from the editor. */
export type QuizDigestSource = Pick<GenerateInput, "title" | "contentType" | "digestDate" | "summary" | "body" | "items">;

interface CurrentAffairsQuizEditorProps {
  quiz: Quiz | null;
  onChange: (quiz: Quiz | null) => void;
  tagOptions: CurrentAffairsTagOption[];
  postTags: CurrentAffairsTagRef[];
  /* Suggested quiz title, e.g. from the digest date. */
  defaultTitle: string;
  digest: QuizDigestSource;
}

const LETTERS = ["A", "B", "C", "D"];
const MAX_QUESTIONS = 50;

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Direct recall" },
  { value: "medium", label: "Medium", hint: "Connect facts" },
  { value: "hard", label: "Hard", hint: "Close options" },
];

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

type Notice = { tone: "success" | "warning"; text: string };

export const CurrentAffairsQuizEditor: React.FC<CurrentAffairsQuizEditorProps> = ({
  quiz,
  onChange,
  tagOptions,
  postTags,
  defaultTitle,
  digest,
}) => {
  const generate = useGenerateCurrentAffairsQuizMutation();
  const [confirmRemoveQuiz, setConfirmRemoveQuiz] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCount, setAiCount] = useState(String(quiz?.questionCount ?? currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS));
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [aiError, setAiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const hasContent = digest.items.some((item) => item.headline.trim() && currentAffairsMeta.stripHtml(item.keyPoints));
  const count = Number(aiCount);
  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_GENERATED_QUESTIONS;

  const request = (n: number, avoid: string[]): GenerateInput => ({
    ...digest,
    count: n,
    difficulty,
    avoid: avoid.filter((q) => q.trim()).slice(0, 60),
  });

  const openGenerator = () => {
    setAiError(null);
    setAiCount(String(quiz?.questionCount ?? currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS));
    setAiOpen(true);
  };

  // A fresh or regenerated quiz starts hidden so the admin reviews it before it can go live.
  const runGenerate = () => {
    if (!countValid || generate.isPending) return;
    setAiError(null);
    generate.mutate(request(count, []), {
      onSuccess: ({ questions, warning }) => {
        onChange({
          title: quiz?.title || defaultTitle,
          questionCount: questions.length,
          isPublished: false,
          questions,
        });
        setNotice(
          warning
            ? { tone: "warning", text: warning }
            : {
                tone: "success",
                text: `${questions.length} question${questions.length === 1 ? "" : "s"} written from this digest. Review them, then turn on "Show the quiz on the site" and save.`,
              }
        );
        setAiOpen(false);
      },
      onError: (error) => setAiError(parseErrorMessage(error)),
    });
  };

  const regenerateOne = (index: number) => {
    if (!quiz || generate.isPending) return;
    const target = quiz.questions[index];
    setRegenerating(target.key);
    setNotice(null);
    generate.mutate(
      request(
        1,
        quiz.questions.map((q) => q.question)
      ),
      {
        onSuccess: ({ questions }) => {
          const [fresh] = questions;
          if (fresh) {
            onChange({ ...quiz, questions: quiz.questions.map((q, i) => (i === index ? { ...fresh, key: q.key } : q)) });
          }
          setRegenerating(null);
        },
        onError: (error) => {
          setNotice({ tone: "warning", text: `Question ${index + 1} was not replaced: ${parseErrorMessage(error)}` });
          setRegenerating(null);
        },
      }
    );
  };

  const generatorDialog = (
    <Dialog
      open={aiOpen}
      onOpenChange={(open) => {
        if (!generate.isPending) setAiOpen(open);
      }}
    >
      <ConsoleDialogContent size="sm">
        <ConsoleDialogHeader
          title={quiz ? "Regenerate the quiz" : "Generate a quiz with AI"}
          description="Questions are written only from this digest's news items, saved or not."
        />
        <ConsoleDialogBody className={styles.aiBody}>
          <div className={styles.aiField}>
            <label htmlFor="ca-ai-count" className={styles.aiLabel}>
              Number of questions
            </label>
            <Input
              id="ca-ai-count"
              type="number"
              min={1}
              max={MAX_GENERATED_QUESTIONS}
              value={aiCount}
              onChange={(e) => setAiCount(e.target.value)}
              className={styles.aiCount}
              aria-invalid={!countValid}
            />
            {!countValid && <p className={styles.aiFieldError}>Choose between 1 and {MAX_GENERATED_QUESTIONS}.</p>}
          </div>

          <div className={styles.aiField}>
            <span className={styles.aiLabel}>Question type</span>
            <p className={styles.aiFixed}>
              <ListChecks size={15} aria-hidden="true" /> Multiple choice - 4 options, 1 correct answer
            </p>
          </div>

          <div className={styles.aiField}>
            <span className={styles.aiLabel} id="ca-ai-difficulty">
              Difficulty
            </span>
            <RadioGroup
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as Difficulty)}
              className={styles.difficulty}
              aria-labelledby="ca-ai-difficulty"
            >
              {DIFFICULTIES.map((d) => (
                <label key={d.value} className={`${styles.difficultyOption} ${difficulty === d.value ? styles.difficultyOn : ""}`}>
                  <RadioGroupItem value={d.value} className={styles.srRadio} />
                  <span className={styles.difficultyLabel}>{d.label}</span>
                  <span className={styles.difficultyHint}>{d.hint}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {quiz && <p className={styles.aiReplaceNote}>This replaces the {quiz.questions.length} questions in the quiz now.</p>}

          {generate.isPending && (
            <p className={styles.aiLoading} role="status">
              <Loader2 size={16} className={styles.spin} aria-hidden="true" />
              Reading {digest.items.length} news item{digest.items.length === 1 ? "" : "s"} and writing questions...
            </p>
          )}
          {aiError && (
            <p className={styles.aiError} role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              {aiError}
            </p>
          )}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => setAiOpen(false)} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={runGenerate} disabled={!countValid || generate.isPending}>
            {generate.isPending ? <Loader2 size={16} className={styles.spin} /> : <Sparkles size={16} />}
            {generate.isPending ? "Generating..." : quiz ? "Regenerate" : "Generate"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );

  if (!quiz) {
    return (
      <>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ListChecks size={22} />
          </span>
          <div className={styles.emptyText}>
            <p className={styles.emptyTitle}>No quiz on this post</p>
            <p className={styles.emptyHint}>
              {hasContent
                ? "Shown under the digest; anyone can attempt it without signing in."
                : "Add news items with a summary first to generate questions from them."}
            </p>
          </div>
          <div className={styles.emptyActions}>
            <Button onClick={openGenerator} disabled={!hasContent}>
              <Sparkles size={16} /> Generate with AI
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  title: defaultTitle,
                  questionCount: currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS,
                  isPublished: false,
                  questions: Array.from({ length: currentAffairsMeta.DEFAULT_QUIZ_QUESTIONS }, () => emptyQuestion(postTags)),
                })
              }
            >
              <PenLine size={16} /> Create manually
            </Button>
          </div>
        </div>
        {generatorDialog}
      </>
    );
  }

  const setQuiz = (patch: Partial<Quiz>) => onChange({ ...quiz, ...patch });
  const setQuestions = (questions: CurrentAffairsQuestionInput[]) => setQuiz({ questions });
  const updateQuestion = (index: number, patch: Partial<CurrentAffairsQuestionInput>) =>
    setQuestions(quiz.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  // Raising the count adds blank questions; lowering it drops only trailing blank ones.
  const setCount = (raw: number) => {
    const next = Math.min(MAX_QUESTIONS, Math.max(1, Math.round(raw) || 1));
    const questions = [...quiz.questions];
    while (questions.length < next) questions.push(emptyQuestion(postTags));
    while (questions.length > next && isBlankQuestion(questions[questions.length - 1])) questions.pop();
    onChange({ ...quiz, questionCount: next, questions });
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
      <div className={styles.toolbar}>
        <span className={styles.countPill}>
          {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
        </span>
        <span className={styles.progress} aria-live="polite">
          {answered} ready
        </span>
        <Button variant="outline" size="sm" onClick={openGenerator} disabled={!hasContent || generate.isPending} className={styles.toolbarAction}>
          <Sparkles size={14} /> Regenerate with AI
        </Button>
      </div>

      {notice && (
        <p className={`${styles.notice} ${notice.tone === "warning" ? styles.noticeWarning : styles.noticeSuccess}`} role="status">
          {notice.tone === "warning" ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{notice.text}</span>
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}

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

      <ol className={styles.questions}>
        {quiz.questions.map((question, index) => {
          const base = `quiz.questions.${index}`;
          const busy = regenerating === question.key;
          return (
            <li key={question.key} className={`${styles.question} ${busy ? styles.questionBusy : ""}`} aria-busy={busy}>
              <div className={styles.questionHead}>
                <span className={styles.qNumber}>Q{index + 1}</span>
                <div className={styles.questionActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenerateOne(index)}
                    disabled={!hasContent || generate.isPending}
                    className={styles.regenOne}
                    aria-label={`Regenerate question ${index + 1} with AI`}
                  >
                    {busy ? <Loader2 size={14} className={styles.spin} /> : <Sparkles size={14} />}
                    <span className={styles.regenLabel}>{busy ? "Writing..." : "Regenerate"}</span>
                  </Button>
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

      {generatorDialog}

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
          setNotice(null);
          onChange(null);
        }}
      />
    </div>
  );
};
