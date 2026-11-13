import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AutoComplete, type Option } from "./AutoComplete";
import { useExamNameSuggestions } from "../helpers/useExamNameSuggestions";
import { MAX_ITEM_EXAMS } from "../helpers/itemExams";
import styles from "./ExamMultiPicker.module.css";

/* Case-insensitive, with surrounding and repeated spaces ignored. */
const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/* The text with the first case-insensitive match of `search` in bold. */
const Highlight: React.FC<{ text: string; search: string }> = ({ text, search }) => {
  const at = search ? text.toLowerCase().indexOf(search) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.match}>{text.slice(at, at + search.length)}</mark>
      {text.slice(at + search.length)}
    </>
  );
};

/* Lower ranks first: the name starts with the search, a word in it does, it contains it, only the full name does. */
const matchRank = (nameKey: string, fullKey: string, search: string): number | null => {
  if (nameKey.startsWith(search)) return 0;
  if (nameKey.includes(` ${search}`) || nameKey.includes(`-${search}`) || nameKey.includes(`(${search}`)) return 1;
  if (nameKey.includes(search)) return 2;
  if (fullKey.includes(search)) return 3;
  return null;
};

interface ExamMultiPickerProps {
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
  max?: number;
}

// Picks come only from the official exam list. A legacy custom name already on
// the item stays as a chip the teacher can keep or remove, but cannot be added.
export const ExamMultiPicker: React.FC<ExamMultiPickerProps> = ({
  value,
  onChange,
  disabled = false,
  max = MAX_ITEM_EXAMS,
}) => {
  const { officialExams, isLoading } = useExamNameSuggestions();
  const [query, setQuery] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const inputAreaRef = useRef<HTMLDivElement>(null);

  const selectedKeys = useMemo(() => new Set(value.map((name) => name.toLowerCase())), [value]);
  const officialKeys = useMemo(
    () => new Set(officialExams.map((exam) => exam.name.toLowerCase())),
    [officialExams]
  );

  const catalogue = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; fullName: string; nameKey: string; fullKey: string }[] = [];
    for (const exam of officialExams) {
      const key = exam.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const fullName = exam.fullName ?? "";
      result.push({ name: exam.name, fullName, nameKey: normalize(exam.name), fullKey: normalize(fullName) });
    }
    return result;
  }, [officialExams]);

  const search = normalize(query);

  // The list is filtered here, not by the AutoComplete: exact substring matches
  // on the exam name or full name, best matches first, already-picked exams left out.
  const options: Option[] = useMemo(() => {
    const available = catalogue.filter((exam) => !selectedKeys.has(exam.name.toLowerCase()));
    const ranked = search
      ? available
          .map((exam) => ({ exam, rank: matchRank(exam.nameKey, exam.fullKey, search) }))
          .filter((entry): entry is { exam: (typeof available)[number]; rank: number } => entry.rank !== null)
          .sort((a, b) => a.rank - b.rank)
      : available.map((exam) => ({ exam, rank: 0 }));
    return ranked.map(({ exam, rank }) => ({
      value: exam.name,
      displayText: exam.name,
      label: (
        <span className={styles.option}>
          <span>
            <Highlight text={exam.name} search={search} />
          </span>
          {rank === 3 && (
            <span className={styles.optionFullName}>
              <Highlight text={exam.fullName} search={search} />
            </span>
          )}
        </span>
      ),
    }));
  }, [catalogue, selectedKeys, search]);

  const atMax = value.length >= max;

  // The input remounts after each pick so the kit AutoComplete drops its
  // remembered selection; focus returns to it for the next pick.
  useEffect(() => {
    if (inputKey === 0) return;
    inputAreaRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
  }, [inputKey]);

  const addExam = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || atMax || selectedKeys.has(trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setAnnouncement(`${trimmed} added.`);
    setQuery("");
    setInputKey((key) => key + 1);
  };

  const removeAt = (index: number) => {
    const name = value[index];
    onChange(value.filter((_, i) => i !== index));
    setAnnouncement(`${name} removed.`);
  };

  const makePrimary = (index: number) => {
    const name = value[index];
    onChange([name, ...value.filter((_, i) => i !== index)]);
    setAnnouncement(`${name} is now the primary exam.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.key !== "Backspace" || value.length === 0) return;
    const target = event.target as HTMLInputElement;
    if (target.tagName === "INPUT" && target.value === "") removeAt(value.length - 1);
  };

  const isCustom = (name: string) =>
    !isLoading && officialKeys.size > 0 && !officialKeys.has(name.toLowerCase());

  // A click on the box's empty space goes to the input, as in a single text field.
  const focusInput = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    inputAreaRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
  };

  // Chips and the input share one box the height of a normal input; it grows a
  // line at a time as chips wrap.
  return (
    <div className={styles.container}>
      <div className={`${styles.field} ${disabled ? styles.fieldDisabled : ""}`} onClick={focusInput}>
        {value.length > 0 && (
          <ul className={styles.chips} role="list" aria-label="Selected exams">
            {value.map((name, index) => (
              <li key={name} className={`${styles.chip} ${index === 0 ? styles.chipPrimary : ""}`}>
                <span className={styles.chipName}>{name}</span>
                {index === 0 && <span className={`${styles.tag} ${styles.tagPrimary}`}>Primary</span>}
                {isCustom(name) && <span className={`${styles.tag} ${styles.tagCustom}`}>Not in exam list</span>}
                {!disabled && index > 0 && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => makePrimary(index)}
                    aria-label={`Make ${name} the primary exam`}
                  >
                    Make primary
                  </button>
                )}
                {!disabled && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove ${name}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!disabled && (
          <div ref={inputAreaRef} className={styles.inputArea} onKeyDown={handleKeyDown}>
            <AutoComplete
              key={inputKey}
              options={options}
              onValueChange={(option) => addExam(option.displayText || option.value)}
              inputValue={query}
              onInputValueChange={setQuery}
              isLoading={isLoading}
              disabled={atMax}
              shouldFilter={false}
              placeholder={
                atMax ? `Up to ${max} exams` : value.length === 0 ? "Search exams (optional)" : "Add another exam"
              }
              emptyMessage="No exams found"
            />
          </div>
        )}
      </div>

      {!disabled && atMax && <p className={styles.limit}>Up to {max} exams</p>}
      {disabled && value.length === 0 && <p className={styles.empty}>No exam selected</p>}
      <p className={styles.helper}>
        Your item will appear on each selected exam&apos;s page.
        {!disabled && value.length > 1 ? " The primary exam is shown on cards." : ""}
      </p>
      <span className={styles.srOnly} aria-live="polite">
        {announcement}
      </span>
    </div>
  );
};