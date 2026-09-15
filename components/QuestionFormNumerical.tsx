import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import { Input } from "./Input";
import styles from "./QuestionForm.module.css";

interface QuestionFormNumericalProps {
  form: any;
}

export const QuestionFormNumerical = ({ form }: QuestionFormNumericalProps) => {
  return (
    <div className={styles.formRow}>
      <FormItem name="numericalAnswer" style={{ flex: 1 }}>
        <FormLabel>Numerical Answer</FormLabel>
        <FormControl>
          <Input
            type="number"
            step="any"
            value={form.values.numericalAnswer ?? ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              form.setValues((p: any) => ({
                ...p,
                numericalAnswer: Number.isNaN(val) ? undefined : val,
              }));
            }}
            placeholder="Enter the numerical answer"
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="numericalTolerance" style={{ flex: 1 }}>
        <FormLabel>Tolerance (+/-)</FormLabel>
        <FormControl>
          <Input
            type="number"
            step="any"
            min={0}
            value={form.values.numericalTolerance ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              form.setValues((p: any) => ({
                ...p,
                numericalTolerance: Number.isNaN(val) ? 0 : val,
              }));
            }}
            placeholder="0"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </div>
  );
};
