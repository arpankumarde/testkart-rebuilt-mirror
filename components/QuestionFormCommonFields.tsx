import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "./Form";
import { Input } from "./Input";
import { RichTextEditor } from "./RichTextEditor";
import { AIRewriteButton } from "./AIRewriteButton";
import { stripHtmlClient as stripHtmlForContext } from "../helpers/stripHtmlClient";
import styles from "./QuestionForm.module.css";

// Sub-fields receive the useForm() result as a prop; FormItem/FormLabel read
// errors from the <Form> context the parent provides.
interface QuestionFormCommonFieldsProps {
  form: any;
  // "inline" renders the two fields without their own row so a parent flex
  // row can lay them out next to other settings.
  layout?: "row" | "inline";
  itemClassName?: string;
}

const parseMarks = (raw: string) => {
  const value = parseFloat(raw);
  return Number.isNaN(value) ? 0 : value;
};

export const QuestionFormCommonFields = ({ form, layout = "row", itemClassName }: QuestionFormCommonFieldsProps) => {
  const itemStyle = layout === "row" ? { flex: 1 } : undefined;
  const fields = (
    <>
      <FormItem name="positiveMarks" className={itemClassName} style={itemStyle}>
        <FormLabel>+ Marks</FormLabel>
        <FormControl>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.values.positiveMarks ?? ""}
            onChange={(e) => {
              const val = parseMarks(e.target.value);
              form.setValues((p: any) => ({ ...p, positiveMarks: val }));
            }}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="negativeMarks" className={itemClassName} style={itemStyle}>
        <FormLabel>- Marks</FormLabel>
        <FormControl>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.values.negativeMarks ?? ""}
            onChange={(e) => {
              const val = parseMarks(e.target.value);
              form.setValues((p: any) => ({ ...p, negativeMarks: val }));
            }}
          />
        </FormControl>
        <FormDescription>Marks deducted for a wrong answer</FormDescription>
        <FormMessage />
      </FormItem>
    </>
  );

  return layout === "inline" ? fields : <div className={styles.formRow}>{fields}</div>;
};

export const QuestionFormExplanation = ({ form }: QuestionFormCommonFieldsProps) => {
  const questionTextPlain = stripHtmlForContext(form.values.questionText);
  const correctLabel = "correctOptions" in form.values
    ? (form.values.correctOptions ?? [])[0]
    : form.values.correctOption;
  const correctAnswerText = correctLabel
    ? stripHtmlForContext(form.values[`option${correctLabel}`]) || stripHtmlForContext(form.values.numericalAnswer?.toString())
    : stripHtmlForContext(form.values.numericalAnswer?.toString());
  const optionTexts = ["A", "B", "C", "D", "E"]
    .map((opt) => stripHtmlForContext(form.values[`option${opt}`]))
    .filter(Boolean);

  return (
    <FormItem name="explanation">
      <div className={styles.labelWithAI}>
        <FormLabel>Explanation (Optional)</FormLabel>
        {questionTextPlain.length > 0 && (
          <AIRewriteButton
            field="explanation"
            contentType="test"
            currentValue={form.values.explanation ?? ""}
            allowEmpty
            context={{ questionText: questionTextPlain, correctAnswerText, optionTexts }}
            onAccept={(suggestion: string) => form.setValues((p: any) => ({ ...p, explanation: suggestion }))}
          />
        )}
      </div>
      <FormControl>
        <RichTextEditor
          value={form.values.explanation ?? ""}
          onChange={(value) =>
            form.setValues((p: any) => ({ ...p, explanation: value }))
          }
          placeholder="Add an explanation with formatting, images, or formulas..."
          toolbarPreset="minimal"
          minHeight="80px"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};
