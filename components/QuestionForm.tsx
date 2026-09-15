import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { toast } from "sonner";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import { getMatchAnswerRows, parseStoredMatchData } from "../helpers/testScoringLogic";
import {
  schema as createQuestionSchema,
  richTextHasContent,
  OutputType as SavedQuestion,
} from "../endpoints/teacher/questions/create_POST.schema";
import { schema as updateQuestionSchema } from "../endpoints/teacher/questions/update_POST.schema";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { RichTextEditor } from "./RichTextEditor";
import { Button } from "./Button";
import { Input } from "./Input";
import { QuestionFormCommonFields, QuestionFormExplanation } from "./QuestionFormCommonFields";
import { QuestionFormMatch } from "./QuestionFormMatch";
import { QuestionFormAssertionReason, ASSERTION_OPTIONS } from "./QuestionFormAssertionReason";
import { QuestionFormOptions } from "./QuestionFormOptions";
import { QuestionFormNumerical } from "./QuestionFormNumerical";
import { AIRewriteButton } from "./AIRewriteButton";
import styles from "./QuestionForm.module.css";

export type QuestionTypeValue =
  | "single_correct_mcq"
  | "multiple_correct_mcq"
  | "numerical"
  | "assertion_reason"
  | "comprehension"
  | "match_the_following";

const QUESTION_TYPES: Array<{ value: QuestionTypeValue; label: string }> = [
  { value: "single_correct_mcq", label: "Single Correct MCQ" },
  { value: "multiple_correct_mcq", label: "Multiple Correct MCQ" },
  { value: "numerical", label: "Numerical" },
  { value: "assertion_reason", label: "Assertion-Reason" },
  { value: "comprehension", label: "Comprehension" },
  { value: "match_the_following", label: "Match the Following" },
];

const LETTERS = ["A", "B", "C", "D", "E"];

interface QuestionFormProps {
  subjectId: number;
  sections?: Array<{ id: number; sectionName: string }>;
  questionToEdit?: any;
  onSuccess: (saved: SavedQuestion) => void;
  defaultSectionId?: number | null;
  defaultQuestionType?: QuestionTypeValue;
  questionWiseTiming?: boolean;
  defaultPositiveMarks?: number;
  defaultNegativeMarks?: number;
  defaultDurationSeconds?: number | null;
  // "dialog" (default) keeps the single-column layout with a built-in submit
  // button. "page" is the full-page editor: a wider split layout whose Save
  // buttons live in the page header, wired to this form through `formId`.
  variant?: "dialog" | "page";
  formId?: string;
  onPendingChange?: (isPending: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  // Ctrl/Cmd+Enter. Page callers route it through their primary Save button so
  // it runs the same action; without it the form submits itself.
  onSaveShortcut?: () => void;
}

const toText = (value: unknown) => (typeof value === "string" ? value : "");

const toNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const blankMatchData = () => ({
  leftItems: ["", ""],
  rightItems: ["", ""],
  correctMatches: {} as Record<string, string>,
});

// Rebuilds the positional answer key from whatever shape is stored and pads
// both columns to the two items the editor starts with.
export const toFormMatchData = (matchData: unknown) => {
  const data = parseStoredMatchData(matchData);
  if (!data) {
    return blankMatchData();
  }
  const pad = (items: string[]) => {
    const list = [...items];
    while (list.length < 2) list.push("");
    return list;
  };
  const correctMatches: Record<string, string> = {};
  getMatchAnswerRows(data, {}).forEach((row) => {
    if (row.correctRightIndex !== null) {
      correctMatches[String(row.leftIndex)] = String(row.correctRightIndex);
    }
  });
  return { leftItems: pad(data.leftItems), rightItems: pad(data.rightItems), correctMatches };
};

const fixedAssertionOptions = () =>
  Object.fromEntries(ASSERTION_OPTIONS.map(({ opt, text }) => [`option${opt}`, text]));

// Every field is loaded with a value its schema accepts, so switching the
// question type never trips over a null left behind by the previous type.
const valuesFromQuestion = (question: any) => {
  const questionType: QuestionTypeValue = question.questionType ?? "single_correct_mcq";
  const numericalAnswer = toNumber(question.numericalAnswer, NaN);
  return {
    questionId: question.id,
    sectionId: question.sectionId ?? null,
    questionType,
    questionText: toText(question.questionText),
    paragraphText: toText(question.paragraphText),
    optionA: toText(question.optionA),
    optionB: toText(question.optionB),
    optionC: toText(question.optionC),
    optionD: toText(question.optionD),
    optionE: toText(question.optionE),
    ...(questionType === "assertion_reason" ? fixedAssertionOptions() : {}),
    correctOption: LETTERS.includes(question.correctOption) ? question.correctOption : undefined,
    correctOptions: Array.isArray(question.correctOptions)
      ? question.correctOptions.filter((option: string) => LETTERS.includes(option))
      : [],
    partialMarking: question.partialMarking ?? false,
    numericalAnswer: Number.isFinite(numericalAnswer) ? numericalAnswer : undefined,
    numericalTolerance: Math.abs(toNumber(question.numericalTolerance, 0)),
    matchData: toFormMatchData(question.matchData),
    positiveMarks: toNumber(question.positiveMarks, 4),
    negativeMarks: Math.abs(toNumber(question.negativeMarks, 0)),
    explanation: toText(question.explanation),
    durationSeconds: question.durationSeconds ?? null,
  };
};

const FIELD_LABELS: Record<string, string> = {
  questionText: "Question text",
  paragraphText: "Passage",
  optionA: "Option A",
  optionB: "Option B",
  optionC: "Option C",
  optionD: "Option D",
  optionE: "Option E",
  correctOption: "Correct answer",
  correctOptions: "Correct options",
  numericalAnswer: "Numerical answer",
  numericalTolerance: "Tolerance",
  positiveMarks: "+ Marks",
  negativeMarks: "- Marks",
  durationSeconds: "Duration",
  sectionId: "Section",
  questionType: "Question type",
  explanation: "Explanation",
  matchData: "Match items",
};

const GENERIC_MESSAGE = /^(Required|Invalid input|Invalid enum value|Invalid literal value|Invalid discriminator value|Expected )/;

const flattenErrors = (tree: unknown, prefix = ""): Array<{ path: string; message: string }> => {
  if (typeof tree === "string") return [{ path: prefix, message: tree }];
  if (!tree || typeof tree !== "object") return [];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    flattenErrors(value, prefix ? `${prefix}.${key}` : key)
  );
};

const describeError = (path: string, message: string) => {
  if (!GENERIC_MESSAGE.test(message)) return message;
  const label = FIELD_LABELS[path] ?? FIELD_LABELS[path.split(".")[0]];
  return label ? `${label} needs a valid value.` : "One of the fields needs a valid value.";
};

const readableError = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => describeError(issue.path.join("."), issue.message)).join(" ");
  }
  return error instanceof Error && error.message ? error.message : "The question could not be saved. Try again.";
};

const TEXT_INPUT_TYPES = new Set(["text", "number", "email", "search", "tel", "url", "password"]);

export const QuestionForm = ({
  subjectId,
  sections,
  questionToEdit,
  onSuccess,
  defaultSectionId,
  defaultQuestionType,
  questionWiseTiming,
  defaultPositiveMarks,
  defaultNegativeMarks,
  defaultDurationSeconds,
  variant = "dialog",
  formId,
  onPendingChange,
  onDirtyChange,
  onSaveShortcut,
}: QuestionFormProps) => {
  const { useCreateQuestionMutation, useUpdateQuestionMutation } =
    useTeacherTestMutations();
  const createQuestion = useCreateQuestionMutation();
  const updateQuestion = useUpdateQuestionMutation();

  const isEditMode = !!questionToEdit;
  const mutation = isEditMode ? updateQuestion : createQuestion;
  const formSchema = isEditMode ? updateQuestionSchema : createQuestionSchema;

  useEffect(() => {
    onPendingChange?.(mutation.isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isPending]);

  const form = useForm({
    schema: formSchema as any,
    defaultValues: (isEditMode
      ? valuesFromQuestion(questionToEdit)
      : {
          subjectId,
          sectionId: defaultSectionId ?? null,
          questionType: defaultQuestionType ?? "single_correct_mcq",
          questionText: "",
          paragraphText: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          optionE: "",
          ...(defaultQuestionType === "assertion_reason" ? fixedAssertionOptions() : {}),
          correctOption: undefined,
          correctOptions: [],
          partialMarking: false,
          numericalAnswer: undefined,
          numericalTolerance: 0,
          matchData: blankMatchData(),
          positiveMarks: defaultPositiveMarks ?? 4,
          negativeMarks: Math.abs(defaultNegativeMarks ?? 0),
          explanation: "",
          // One minute mirrors the test item's own default, so question-wise
          // timing totals are not 0 until every question is timed by hand.
          durationSeconds: questionWiseTiming ? defaultDurationSeconds ?? 60 : null,
        }) as any,
  });

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);

  const snapshot = JSON.stringify(form.values);
  const savedSnapshotRef = useRef(snapshot);
  const isDirty = snapshot !== savedSnapshotRef.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (failedSubmits > 0) {
      errorSummaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [failedSubmits]);

  // Assertion-Reason options are fixed wording. The teacher's own options are
  // set aside while that type is selected and put back if they switch away.
  const stashedOptionsRef = useRef<Record<string, string> | null>(null);

  const changeQuestionType = (nextType: QuestionTypeValue) => {
    const current = form.values;
    if (current.questionType === nextType) return;
    const patch: Record<string, unknown> = { questionType: nextType };
    if (nextType === "assertion_reason") {
      stashedOptionsRef.current = {
        optionA: current.optionA ?? "",
        optionB: current.optionB ?? "",
        optionC: current.optionC ?? "",
        optionD: current.optionD ?? "",
      };
      Object.assign(patch, fixedAssertionOptions());
    } else if (current.questionType === "assertion_reason") {
      const stash = stashedOptionsRef.current;
      ["A", "B", "C", "D"].forEach((letter) => {
        patch[`option${letter}`] = stash?.[`option${letter}`] ?? "";
      });
      stashedOptionsRef.current = null;
    }
    form.setValues((p: any) => ({ ...p, ...patch }));
  };

  const buildPayload = (values: any) => {
    const payload = { ...values };
    if (payload.questionType === "assertion_reason") {
      Object.assign(payload, fixedAssertionOptions());
      payload.optionE = null;
    } else if (!richTextHasContent(payload.optionE)) {
      payload.optionE = null;
    }
    if (!richTextHasContent(payload.explanation)) {
      payload.explanation = null;
    }
    if (!questionWiseTiming) {
      // Timing is off for this test item: a new question stores none, and an
      // edit leaves whatever the row already holds.
      if (isEditMode) {
        delete payload.durationSeconds;
      } else {
        payload.durationSeconds = null;
      }
    }
    return payload;
  };

  const submit = () => {
    let valid = false;
    try {
      valid = form.validateForm();
    } catch (error) {
      console.error("[QuestionForm] validation threw", error);
      toast.error("This question could not be checked. Reload the page and try again.");
      return;
    }
    if (!valid) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    const submittedSnapshot = snapshot;
    mutation.mutate(buildPayload(form.values), {
      onSuccess: (saved) => {
        savedSnapshotRef.current = submittedSnapshot;
        onDirtyChange?.(false);
        toast.success(`Question ${isEditMode ? "updated" : "added"} successfully.`);
        onSuccess(saved);
      },
      onError: (error) => toast.error(readableError(error)),
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;
    submit();
  };

  // Enter in a single-line field no longer submits (implicit submission used
  // to fire whichever Save button came first). Ctrl/Cmd+Enter saves from any
  // field; capturing it first also keeps the editors from inserting a line break.
  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      if (onSaveShortcut) {
        onSaveShortcut();
      } else if (!mutation.isPending) {
        submit();
      }
      return;
    }
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)) {
      event.preventDefault();
    }
  };

  const isPageVariant = variant === "page";
  const questionType: QuestionTypeValue = form.values.questionType;

  const setupSection = (
    <div className={styles.setupRow}>
      {sections && sections.length > 0 && (
        <FormItem name="sectionId" className={styles.setupField}>
          <FormLabel>Section</FormLabel>
          <Select
            value={form.values.sectionId?.toString() ?? "__empty"}
            onValueChange={(value) =>
              form.setValues((p: any) => ({
                ...p,
                sectionId: value === "__empty" ? null : parseInt(value, 10),
              }))
            }
          >
            <SelectTrigger className={styles.setupSelect}>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty">No Section</SelectItem>
              {sections.map((sec) => (
                <SelectItem key={sec.id} value={sec.id.toString()}>
                  {sec.sectionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}

      <FormItem name="questionType" className={styles.setupFieldWide}>
        <FormLabel>Question Type</FormLabel>
        <Select value={questionType} onValueChange={(value) => changeQuestionType(value as QuestionTypeValue)}>
          <SelectTrigger className={styles.setupSelect}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>

      {questionWiseTiming && (
        <FormItem name="durationSeconds" className={styles.setupFieldNarrow}>
          <FormLabel>Duration (s)</FormLabel>
          <FormControl>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 60"
              value={form.values.durationSeconds ?? ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                form.setValues((p: any) => ({ ...p, durationSeconds: Number.isNaN(val) ? null : val }));
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}

      <QuestionFormCommonFields form={form} layout="inline" itemClassName={styles.setupFieldMarks} />
    </div>
  );

  const contentSection = (
    <div className={styles.formSection}>
      {questionType === "comprehension" && (
        <FormItem name="paragraphText">
          <FormLabel>Paragraph / Passage</FormLabel>
          <FormControl>
            <RichTextEditor
              value={form.values.paragraphText ?? ""}
              onChange={(value) =>
                form.setValues((p: any) => ({ ...p, paragraphText: value }))
              }
              placeholder="Enter the passage or paragraph that students will read..."
              toolbarPreset="minimal"
              minHeight="100px"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}

      <FormItem name="questionText">
        <div className={styles.labelWithAI}>
          <FormLabel>
            {questionType === "comprehension"
              ? "Question (based on the passage)"
              : questionType === "assertion_reason"
              ? "Assertion and Reason Statements"
              : "Question Text"}
          </FormLabel>
          <AIRewriteButton
            field="questionText"
            contentType="test"
            currentValue={form.values.questionText ?? ""}
            onAccept={(suggestion) => form.setValues((p: any) => ({ ...p, questionText: suggestion }))}
          />
        </div>
        <FormControl>
          <RichTextEditor
            value={form.values.questionText ?? ""}
            onChange={(value) =>
              form.setValues((p: any) => ({ ...p, questionText: value }))
            }
            placeholder={
              questionType === "assertion_reason"
                ? "Enter the Assertion (A) and Reason (R) statements..."
                : "Enter the question text. Use the formula button for math equations."
            }
            toolbarPreset="minimal"
            minHeight="100px"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </div>
  );

  const answerSection = (
    <div className={styles.formSection}>
      <div className={styles.formSectionLabel}>
        {questionType === "match_the_following" ? "Items to match" : "Answer"}
      </div>
      {questionType === "match_the_following" ? (
        <QuestionFormMatch form={form} />
      ) : questionType === "numerical" ? (
        <QuestionFormNumerical form={form} />
      ) : questionType === "assertion_reason" ? (
        <QuestionFormAssertionReason form={form} autofillOptions={false} />
      ) : (
        <QuestionFormOptions
          form={form}
          isMultipleCorrect={questionType === "multiple_correct_mcq"}
        />
      )}
    </div>
  );

  const detailsSection = (
    <div className={styles.formSection}>
      <QuestionFormExplanation form={form} />
    </div>
  );

  const errorMessages = Array.from(
    new Set(flattenErrors(form.errors).map(({ path, message }) => describeError(path, message)))
  );

  const errorSummary = errorMessages.length > 0 && (
    <div ref={errorSummaryRef} className={styles.formErrorSummary} role="alert">
      <p>Fix these before saving:</p>
      <ul>
        {errorMessages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={handleSubmit}
        onKeyDownCapture={handleKeyDownCapture}
        className={isPageVariant ? styles.pageForm : styles.form}
        noValidate
      >
        {isPageVariant ? (
          <div className={styles.pageStack}>
            {setupSection}
            {errorSummary}
            <div className={styles.pageSplitGrid}>
              <div className={styles.pageLeftColumn}>
                {contentSection}
                {detailsSection}
              </div>
              <div className={styles.pageRightColumn}>
                {answerSection}
              </div>
            </div>
          </div>
        ) : (
          <>
            {setupSection}
            {contentSection}
            {answerSection}
            {detailsSection}
            {errorSummary}
          </>
        )}

        {!isPageVariant && (
          <Button type="submit" disabled={mutation.isPending} className={styles.dialogSubmit}>
            {mutation.isPending
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Add Question"}
          </Button>
        )}
      </form>
    </Form>
  );
};
