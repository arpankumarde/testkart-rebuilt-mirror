import { FormItem, FormLabel, FormMessage } from "./Form";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useEffect, useId } from "react";
import styles from "./QuestionForm.module.css";

interface QuestionFormAssertionReasonProps {
  form: any;
  // When true the component writes the fixed wording into optionA-D itself.
  // QuestionForm passes false because it swaps the options on type change so
  // the teacher's own MCQ options come back if they switch away again.
  autofillOptions?: boolean;
}

export const ASSERTION_OPTIONS = [
  { opt: "A", text: "Both Assertion (A) and Reason (R) are true and R is the correct explanation of A" },
  { opt: "B", text: "Both Assertion (A) and Reason (R) are true but R is NOT the correct explanation of A" },
  { opt: "C", text: "Assertion (A) is true but Reason (R) is false" },
  { opt: "D", text: "Assertion (A) is false but Reason (R) is true" },
] as const;

export const QuestionFormAssertionReason = ({ form, autofillOptions = true }: QuestionFormAssertionReasonProps) => {
  const idPrefix = useId();

  useEffect(() => {
    if (!autofillOptions || form.values.questionType !== "assertion_reason") return;
    const updates: Record<string, string> = {};
    ASSERTION_OPTIONS.forEach(({ opt, text }) => {
      if (form.values[`option${opt}`] !== text) {
        updates[`option${opt}`] = text;
      }
    });
    if (Object.keys(updates).length > 0) {
      form.setValues((prev: any) => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.questionType, autofillOptions]);

  return (
    <FormItem name="correctOption">
      <FormLabel>Correct Answer</FormLabel>
      <p className={styles.infoText}>The options for Assertion-Reason questions are fixed. Select the correct one.</p>
      <RadioGroup.Root
        className={styles.assertionOptions}
        value={form.values.correctOption ?? ""}
        onValueChange={(value) =>
          form.setValues((p: any) => ({
            ...p,
            correctOption: value as "A" | "B" | "C" | "D",
          }))
        }
      >
        {ASSERTION_OPTIONS.map(({ opt, text }) => (
          <label
            key={opt}
            htmlFor={`${idPrefix}-${opt}`}
            className={`${styles.assertionOption} ${form.values.correctOption === opt ? styles.assertionOptionSelected : ""}`}
          >
            <RadioGroup.Item className={styles.radioItem} value={opt} id={`${idPrefix}-${opt}`}>
              <RadioGroup.Indicator className={styles.radioIndicator} />
            </RadioGroup.Item>
            <span className={styles.assertionOptionLetter}>{opt}.</span>
            <span>{text}</span>
          </label>
        ))}
      </RadioGroup.Root>
      <FormMessage />
    </FormItem>
  );
};
