import React, { useMemo } from "react";
import { X } from "lucide-react";
import { AutoComplete, type Option } from "./AutoComplete";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import styles from "./ExamNamePicker.module.css";

interface ExamNamePickerProps {
  value: string;
  onChange: (examName: string) => void;
  disabled?: boolean;
}

export const ExamNamePicker: React.FC<ExamNamePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { officialExams, isLoading } = useExamNameSuggestions();

  // Exam tagging is optional and limited to the curated, official exam
  // list — teachers pick a real exam from this list only. Free-typed
  // custom exam names are no longer supported, so every tagged product
  // stays linked to a real row in the exams table. allowFreeForm is left
  // at its default (false), so anything typed that doesn't match a real
  // option snaps back to the last valid selection on blur.
  const options: Option[] = useMemo(() => {
    const seenNames = new Set<string>();
    const officialOptions: Option[] = [];
    for (const exam of officialExams) {
      const lowerName = exam.name.toLowerCase();
      if (seenNames.has(lowerName)) continue;
      seenNames.add(lowerName);
      officialOptions.push({
        value: exam.name,
        displayText: exam.name,
        label: <span>{exam.name}</span>,
      });
    }
    return officialOptions;
  }, [officialExams]);

  // Compute selected option for AutoComplete component
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <AutoComplete
          options={options}
          value={selectedOption}
          onValueChange={(option) => {
            onChange(option.displayText || option.value);
          }}
          inputValue={value}
          onInputValueChange={onChange}
          isLoading={isLoading}
          disabled={disabled}
          placeholder="Select an exam (optional)"
          emptyMessage="No matching exam found."
        />
        {value && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => onChange("")}
            aria-label="Clear selected exam"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};