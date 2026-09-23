import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { AutoComplete, type Option } from "./AutoComplete";
import { usePublicExamCategoriesQuery } from "../helpers/usePublicExamCategoriesQuery";
import { getPopularExamsWithTests } from "../endpoints/exams/popular-with-tests_GET.schema";
import { MAX_EXAM_FOCUS, type ExamFocusItem } from "../helpers/examFocusShared";
import styles from "./ExamFocusPicker.module.css";

const QUICK_PICK_COUNT = 12;

interface ExamFocusPickerProps {
  value: ExamFocusItem[];
  onChange: (exams: ExamFocusItem[]) => void;
  disabled?: boolean;
}

export const ExamFocusPicker: React.FC<ExamFocusPickerProps> = ({ value, onChange, disabled = false }) => {
  const { data: categoriesData, isLoading } = usePublicExamCategoriesQuery();
  const { data: popularData } = useQuery({
    queryKey: ["exams", "popular-with-tests"],
    queryFn: () => getPopularExamsWithTests(),
    staleTime: 10 * 60 * 1000,
  });
  const [query, setQuery] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const selectedIds = useMemo(() => new Set(value.map((exam) => exam.id)), [value]);
  const atMax = value.length >= MAX_EXAM_FOCUS;

  // One entry per name: a few exams share a name, and the search list keys items by name.
  const allExams = useMemo(() => {
    const seen = new Set<string>();
    const result: ExamFocusItem[] = [];
    for (const category of categoriesData?.categories ?? []) {
      for (const exam of category.exams) {
        const key = exam.examName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ id: exam.id, examName: exam.examName, examSlug: exam.examSlug });
      }
    }
    return result;
  }, [categoriesData]);

  const options: Option<ExamFocusItem>[] = useMemo(
    () =>
      allExams
        .filter((exam) => !selectedIds.has(exam.id))
        .map((exam) => ({
          value: String(exam.id),
          displayText: exam.examName,
          label: <span>{exam.examName}</span>,
          metadata: exam,
        })),
    [allExams, selectedIds]
  );

  const quickPicks = useMemo(
    () =>
      (popularData?.exams ?? []).slice(0, QUICK_PICK_COUNT).map((exam) => ({
        id: exam.id,
        examName: exam.examName,
        examSlug: exam.examSlug,
      })),
    [popularData]
  );

  const add = (exam: ExamFocusItem) => {
    if (atMax || selectedIds.has(exam.id)) return;
    onChange([...value, exam]);
    setAnnouncement(`${exam.examName} added.`);
    setQuery("");
    setInputKey((key) => key + 1);
  };

  const remove = (exam: ExamFocusItem) => {
    onChange(value.filter((item) => item.id !== exam.id));
    setAnnouncement(`${exam.examName} removed.`);
  };

  return (
    <div className={styles.container}>
      {quickPicks.length > 0 && (
        <div className={styles.quickPicks} role="group" aria-label="Popular exams">
          {quickPicks.map((exam) => {
            const selected = selectedIds.has(exam.id);
            return (
              <button
                key={exam.id}
                type="button"
                className={`${styles.quickPick} ${selected ? styles.quickPickSelected : ""}`}
                aria-pressed={selected}
                disabled={disabled || (!selected && atMax)}
                onClick={() => (selected ? remove(exam) : add(exam))}
              >
                {selected ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                {exam.examName}
              </button>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div className={styles.search}>
          <AutoComplete
            key={inputKey}
            options={options}
            onValueChange={(option) => option.metadata && add(option.metadata)}
            inputValue={query}
            onInputValueChange={setQuery}
            isLoading={isLoading}
            disabled={atMax}
            placeholder={atMax ? `Up to ${MAX_EXAM_FOCUS} exams` : "Search any exam, e.g. SSC CGL"}
            emptyMessage="No matching exam found."
          />
        </div>
      )}

      {value.length > 0 && (
        <ul className={styles.chips} aria-label="Your exams">
          {value.map((exam) => (
            <li key={exam.id} className={styles.chip}>
              <span className={styles.chipName}>{exam.examName}</span>
              {!disabled && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => remove(exam)}
                  aria-label={`Remove ${exam.examName}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={styles.helper}>
        {value.length} of {MAX_EXAM_FOCUS} selected
      </p>
      <span className={styles.srOnly} aria-live="polite">
        {announcement}
      </span>
    </div>
  );
};