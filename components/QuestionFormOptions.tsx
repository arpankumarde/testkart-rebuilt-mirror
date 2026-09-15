import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import { RichTextEditor } from "./RichTextEditor";
import { Checkbox } from "./Checkbox";
import { Switch } from "./Switch";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { Check, Plus, X, Sparkles } from "lucide-react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useState } from "react";
import { toast } from "sonner";
import { useTeacherGenerateDistractors } from "../helpers/useTeacherGenerateDistractors";
import { stripHtmlClient } from "../helpers/stripHtmlClient";
import { richTextHasContent } from "../endpoints/teacher/questions/create_POST.schema";
import styles from "./QuestionForm.module.css";
import optionsStyles from "./QuestionFormOptions.module.css";

interface QuestionFormOptionsProps {
  form: any;
  isMultipleCorrect?: boolean;
}

export const QuestionFormOptions = ({ form, isMultipleCorrect = false }: QuestionFormOptionsProps) => {
  const correctOption: string = form.values.correctOption ?? "";
  const correctOptionsList: string[] = form.values.correctOptions ?? [];

  // Option E stays on screen whenever it holds content or is marked correct,
  // so a saved fifth option can never be hidden and silently kept.
  const optionEInUse =
    richTextHasContent(form.values.optionE) ||
    (isMultipleCorrect ? correctOptionsList.includes("E") : correctOption === "E");
  const [showOptionE, setShowOptionE] = useState(optionEInUse);
  const optionEVisible = showOptionE || optionEInUse;
  const visibleOptions = optionEVisible ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];

  const handleRemoveOptionE = () => {
    setShowOptionE(false);
    form.setValues((p: any) => {
      const next = { ...p, optionE: "" };
      if (!isMultipleCorrect && next.correctOption === "E") {
        next.correctOption = undefined;
      }
      if (isMultipleCorrect && next.correctOptions) {
        next.correctOptions = next.correctOptions.filter((o: string) => o !== "E");
      }
      return next;
    });
  };

  const isOptionCorrect = (opt: string) =>
    isMultipleCorrect ? correctOptionsList.includes(opt) : correctOption === opt;

  // "Generate distractors" fills in whichever option slots are both empty
  // and not marked correct - it never overwrites anything the teacher has
  // already written, and never touches the correct answer itself.
  const generateDistractors = useTeacherGenerateDistractors();
  const emptyIncorrectOptions = visibleOptions.filter(
    (opt) => !isOptionCorrect(opt) && !stripHtmlClient((form.values as any)[`option${opt}`])
  );
  const questionTextPlain = stripHtmlClient(form.values.questionText);
  const correctTexts = (isMultipleCorrect ? correctOptionsList : [correctOption])
    .map((opt) => stripHtmlClient((form.values as any)[`option${opt}`]))
    .filter(Boolean);
  const canGenerateDistractors =
    questionTextPlain.length > 0 && correctTexts.length > 0 && emptyIncorrectOptions.length > 0;

  const handleGenerateDistractors = async () => {
    try {
      const existingOptionTexts = visibleOptions
        .filter((opt) => !emptyIncorrectOptions.includes(opt))
        .map((opt) => stripHtmlClient((form.values as any)[`option${opt}`]))
        .filter(Boolean);

      const res = await generateDistractors.mutateAsync({
        questionText: questionTextPlain,
        correctAnswerText: correctTexts.join("; "),
        existingOptionTexts,
        count: emptyIncorrectOptions.length,
      });

      if (res.distractors.length === 0) {
        toast.error("Couldn't generate distractors - try again.");
        return;
      }

      form.setValues((p: any) => {
        const next = { ...p };
        emptyIncorrectOptions.forEach((opt, idx) => {
          if (res.distractors[idx]) {
            next[`option${opt}`] = `<p>${res.distractors[idx]}</p>`;
          }
        });
        return next;
      });
    } catch (e) {
      console.error("Generate distractors failed", e);
    }
  };

  const generateDistractorsButton = canGenerateDistractors && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={optionsStyles.distractorsButton}
      disabled={generateDistractors.isPending}
      onClick={handleGenerateDistractors}
    >
      {generateDistractors.isPending ? (
        <>
          <Spinner size="sm" /> Generating...
        </>
      ) : (
        <>
          <Sparkles size={14} /> Generate distractors
        </>
      )}
    </Button>
  );

  // Each option is one compact card: the correct-answer marker (radio or
  // checkbox) and label sit above a short, collapsible-toolbar editor.
  const renderOptionCard = (opt: string, marker: React.ReactNode) => {
    const correct = isOptionCorrect(opt);
    return (
      <div
        key={opt}
        className={`${optionsStyles.optionCard} ${correct ? optionsStyles.optionCardCorrect : ""}`}
      >
        <FormItem name={`option${opt}`}>
          <div className={optionsStyles.optionHeader}>
            {marker}
            <FormLabel className={optionsStyles.optionLabel}>
              Option {opt}
            </FormLabel>
            {correct && (
              <span className={optionsStyles.correctBadge}>
                <Check size={12} /> Correct
              </span>
            )}
            {opt === "E" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={optionsStyles.optionRemoveBtn}
                onClick={handleRemoveOptionE}
                title="Remove Option E"
              >
                <X size={14} />
              </Button>
            )}
          </div>
          <FormControl>
            <RichTextEditor
              value={(form.values as any)[`option${opt}`] ?? ""}
              onChange={(value) =>
                form.setValues((p: any) => ({
                  ...p,
                  [`option${opt}`]: value,
                }))
              }
              placeholder={`Enter option ${opt}`}
              toolbarPreset="minimal"
              toolbarVisibility="collapsible"
              minHeight="52px"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </div>
    );
  };

  const addOptionEButton = !optionEVisible && (
    <button
      type="button"
      className={optionsStyles.addOptionBtn}
      onClick={() => setShowOptionE(true)}
    >
      <Plus size={16} /> Add Option E
    </button>
  );

  return (
    <>
      {!isMultipleCorrect ? (
        <FormItem name="correctOption">
          <div className={optionsStyles.sectionHintRow}>
            <div className={optionsStyles.sectionHint}>
              Select the circle on an option to mark it as the correct answer.
            </div>
            {generateDistractorsButton}
          </div>
          <RadioGroup.Root
            className={optionsStyles.optionsList}
            value={correctOption}
            onValueChange={(value) =>
              form.setValues((p: any) => ({
                ...p,
                correctOption: value as "A" | "B" | "C" | "D" | "E",
              }))
            }
          >
            {visibleOptions.map((opt) =>
              renderOptionCard(
                opt,
                <RadioGroup.Item
                  className={styles.radioItem}
                  value={opt}
                  aria-label={`Mark option ${opt} as correct`}
                >
                  <RadioGroup.Indicator className={styles.radioIndicator} />
                </RadioGroup.Item>
              )
            )}
          </RadioGroup.Root>
          {addOptionEButton}
          <FormMessage />
        </FormItem>
      ) : (
        <>
          <FormItem name="correctOptions">
            <div className={optionsStyles.sectionHintRow}>
              <div className={optionsStyles.sectionHint}>
                Check every option that is correct.
              </div>
              {generateDistractorsButton}
            </div>
            <div className={optionsStyles.optionsList}>
              {visibleOptions.map((opt) =>
                renderOptionCard(
                  opt,
                  <Checkbox
                    aria-label={`Mark option ${opt} as correct`}
                    checked={correctOptionsList.includes(opt)}
                    onChange={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      form.setValues((p: any) => {
                        const current = p.correctOptions || [];
                        if (checked) {
                          return {
                            ...p,
                            correctOptions: [...current, opt],
                          };
                        } else {
                          return {
                            ...p,
                            correctOptions: current.filter(
                              (o: string) => o !== opt
                            ),
                          };
                        }
                      });
                    }}
                  />
                )
              )}
            </div>
            {addOptionEButton}
            <FormMessage />
          </FormItem>

          <FormItem name="partialMarking">
            <div className={styles.switchWrapper}>
              <Switch
                id="partialMarking"
                checked={
                  "partialMarking" in form.values
                    ? form.values.partialMarking ?? false
                    : false
                }
                onCheckedChange={(checked) =>
                  form.setValues((p: any) => ({
                    ...p,
                    partialMarking: checked,
                  }))
                }
              />
              <div>
                <FormLabel htmlFor="partialMarking">
                  Enable Partial Marking
                </FormLabel>
                <p className={styles.switchDescription}>
                  Award partial marks for partially correct answers
                </p>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        </>
      )}
    </>
  );
};
