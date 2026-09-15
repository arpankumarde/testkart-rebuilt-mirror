import React from "react";
import { schema as createQuestionSchema } from "../endpoints/teacher/question-bank/create_POST.schema";
import { schema as updateQuestionSchema } from "../endpoints/teacher/question-bank/update_POST.schema";
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
import { toast } from "sonner";
import { QuestionFormCommonFields, QuestionFormExplanation } from "./QuestionFormCommonFields";
import { QuestionFormMatch } from "./QuestionFormMatch";
import { QuestionFormAssertionReason } from "./QuestionFormAssertionReason";
import { QuestionFormOptions } from "./QuestionFormOptions";
import { QuestionFormNumerical } from "./QuestionFormNumerical";
import { toFormMatchData } from "./QuestionForm";
import { useCreateBankQuestionMutation, useUpdateBankQuestionMutation } from "../helpers/useTeacherQuestionBank";
import { useExamsQuery } from "../helpers/useExamsQuery";
import { QuestionBank } from "../helpers/schema";
import { Selectable } from "kysely";
import styles from "./BankQuestionForm.module.css";

const LETTERS = ["A", "B", "C", "D", "E"];

const toNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const FIELD_LABELS: Record<string, string> = {
  examId: "Exam",
  subjectName: "Subject name",
  tags: "Tags",
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
  const label = FIELD_LABELS[path] ?? FIELD_LABELS[path.split(".")[0]];
  if (!GENERIC_MESSAGE.test(message)) return label && !message.startsWith(label) ? `${label}: ${message}` : message;
  return label ? `${label} needs a valid value.` : "One of the fields needs a valid value.";
};

interface BankQuestionFormProps {
  questionToEdit?: Selectable<QuestionBank> | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BankQuestionForm = ({
  questionToEdit,
  onSuccess,
  onCancel,
}: BankQuestionFormProps) => {
  const createMutation = useCreateBankQuestionMutation();
  const updateMutation = useUpdateBankQuestionMutation();
  const { data: examsData } = useExamsQuery();

  const isEditMode = !!questionToEdit;
  const mutation = isEditMode ? updateMutation : createMutation;
  const formSchema = isEditMode ? updateQuestionSchema : createQuestionSchema;

  const form = useForm({
    schema: formSchema as any,
    defaultValues: (isEditMode
      ? {
          questionId: questionToEdit.id,
          examId: questionToEdit.examId ?? null,
          subjectName: questionToEdit.subjectName ?? "",
          tags: questionToEdit.tags ?? [],
          questionText: questionToEdit.questionText,
          questionType: questionToEdit.questionType ?? "single_correct_mcq",
          optionA: questionToEdit.optionA ?? "",
          optionB: questionToEdit.optionB ?? "",
          optionC: questionToEdit.optionC ?? "",
          optionD: questionToEdit.optionD ?? "",
          optionE: questionToEdit.optionE ?? "",
          correctOption: LETTERS.includes(questionToEdit.correctOption ?? "") ? questionToEdit.correctOption : undefined,
          correctOptions: Array.isArray(questionToEdit.correctOptions)
            ? questionToEdit.correctOptions.filter((option) => LETTERS.includes(option))
            : [],
          partialMarking: questionToEdit.partialMarking ?? false,
          numericalAnswer: Number.isFinite(toNumber(questionToEdit.numericalAnswer, NaN))
            ? toNumber(questionToEdit.numericalAnswer, NaN)
            : undefined,
          numericalTolerance: Math.abs(toNumber(questionToEdit.numericalTolerance, 0)),
          paragraphText: questionToEdit.paragraphText ?? "",
          matchData: toFormMatchData(questionToEdit.matchData),
          positiveMarks: toNumber(questionToEdit.positiveMarks, 4),
          negativeMarks: Math.abs(toNumber(questionToEdit.negativeMarks, 0)),
          explanation: questionToEdit.explanation ?? "",
          durationSeconds: questionToEdit.durationSeconds ?? null,
        }
      : {
          examId: null,
          subjectName: "",
          tags: [],
          questionText: "",
          questionType: "single_correct_mcq",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          optionE: "",
          correctOption: undefined,
          correctOptions: [],
          partialMarking: false,
          numericalTolerance: 0,
          paragraphText: "",
          matchData: {
            leftItems: ["", ""],
            rightItems: ["", ""],
            correctMatches: {},
          },
          positiveMarks: 4,
          negativeMarks: 0,
          explanation: "",
          durationSeconds: null,
        }) as any,
  });

  const onSubmit = (values: any) => {
    const payload = { ...values };

    if (payload.tags && Array.isArray(payload.tags)) {
      payload.tags = payload.tags.filter((t: string) => t.trim().length > 0);
      if (payload.tags.length === 0) payload.tags = null;
    }
    if (!payload.subjectName || payload.subjectName.trim() === "") payload.subjectName = null;
    if (!payload.optionE) payload.optionE = null;

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`Question ${isEditMode ? "updated" : "added"} successfully to the bank.`);
        onSuccess();
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "An error occurred.")
    });
  };

  const exams = examsData?.exams || [];
  const errorMessages = Array.from(
    new Set(flattenErrors(form.errors).map(({ path, message }) => describeError(path, message)))
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        
        <div className={styles.formRow}>
          <FormItem name="examId" style={{ flex: 1 }}>
            <FormLabel>Exam (Optional)</FormLabel>
            <Select
              value={form.values.examId?.toString() ?? "__empty"}
              onValueChange={(value) =>
                form.setValues((p: any) => ({
                  ...p,
                  examId: value === "__empty" ? null : parseInt(value),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">No Exam</SelectItem>
                {exams.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id.toString()}>
                    {ex.examName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>

          <FormItem name="subjectName" style={{ flex: 1 }}>
            <FormLabel>Subject Name (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Mathematics"
                value={form.values.subjectName ?? ""}
                onChange={(e) => form.setValues((p: any) => ({ ...p, subjectName: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formRow}>
          <FormItem name="questionType" style={{ flex: 1 }}>
            <FormLabel>Question Type</FormLabel>
            <Select
              value={form.values.questionType}
              onValueChange={(value) =>
                form.setValues((p: any) => ({ ...p, questionType: value as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_correct_mcq">Single Correct MCQ</SelectItem>
                <SelectItem value="multiple_correct_mcq">Multiple Correct MCQ</SelectItem>
                <SelectItem value="numerical">Numerical</SelectItem>
                <SelectItem value="assertion_reason">Assertion-Reason</SelectItem>
                <SelectItem value="comprehension">Comprehension</SelectItem>
                <SelectItem value="match_the_following">Match the Following</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>

          <FormItem name="tags" style={{ flex: 1 }}>
            <FormLabel>Tags (Comma separated)</FormLabel>
            <FormControl>
              <Input
                placeholder="algebra, hard, 2024"
                value={form.values.tags?.join(", ") ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const tagsArray = val.split(",").map(t => t.trim()).filter(Boolean);
                  form.setValues((p: any) => ({ ...p, tags: tagsArray.length > 0 ? tagsArray : null }));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <QuestionFormCommonFields form={form} />

        {form.values.questionType === "comprehension" && (
          <FormItem name="paragraphText">
            <FormLabel>Paragraph / Passage</FormLabel>
            <FormControl>
              <RichTextEditor
                value={form.values.paragraphText ?? ""}
                onChange={(value) =>
                  form.setValues((p: any) => ({ ...p, paragraphText: value }))
                }
                placeholder="Enter the passage or paragraph that students will read..."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}

        <FormItem name="questionText">
          <FormLabel>
            {form.values.questionType === "comprehension"
              ? "Question (based on the passage)"
              : form.values.questionType === "assertion_reason"
              ? "Assertion and Reason Statements"
              : "Question Text"}
          </FormLabel>
          <FormControl>
            <RichTextEditor
              value={form.values.questionText ?? ""}
              onChange={(value) =>
                form.setValues((p: any) => ({ ...p, questionText: value }))
              }
              placeholder={
                form.values.questionType === "assertion_reason"
                  ? "Enter the Assertion (A) and Reason (R) statements..."
                  : "Enter the question text. Use the formula button for math equations."
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        {form.values.questionType === "match_the_following" ? (
          <QuestionFormMatch form={form} />
        ) : form.values.questionType === "numerical" ? (
          <QuestionFormNumerical form={form} />
        ) : form.values.questionType === "assertion_reason" ? (
          <QuestionFormAssertionReason form={form} />
        ) : (
          <QuestionFormOptions 
            form={form} 
            isMultipleCorrect={form.values.questionType === "multiple_correct_mcq"} 
          />
        )}

        <QuestionFormExplanation form={form} />
        
        {errorMessages.length > 0 && (
          <div className={styles.formErrorSummary} role="alert">
            <p>Please fix the following errors:</p>
            <ul>
              {errorMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.formRow} style={{ justifyContent: "flex-end", marginTop: "var(--spacing-4)" }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Add to Bank"}
          </Button>
        </div>
      </form>
    </Form>
  );
};