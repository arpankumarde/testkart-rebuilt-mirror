import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AutoComplete, type Option } from "./AutoComplete";
import { LANGUAGE_OPTIONS, MAX_ITEM_LANGUAGES, MAX_LANGUAGE_LENGTH } from "../helpers/itemLanguages";
import styles from "./LanguageMultiPicker.module.css";

interface LanguageMultiPickerProps {
  value: string[];
  onChange: (languages: string[]) => void;
  disabled?: boolean;
  max?: number;
  placeholder?: string;
}

// Picks from the standard list, or a language the teacher types that is not on it.
export const LanguageMultiPicker: React.FC<LanguageMultiPickerProps> = ({
  value,
  onChange,
  disabled = false,
  max = MAX_ITEM_LANGUAGES,
  placeholder = "Add a language",
}) => {
  const [query, setQuery] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const inputAreaRef = useRef<HTMLDivElement>(null);

  const selectedKeys = useMemo(() => new Set(value.map((name) => name.toLowerCase())), [value]);

  const options: Option[] = useMemo(() => {
    const result: Option[] = LANGUAGE_OPTIONS.filter((name) => !selectedKeys.has(name.toLowerCase())).map(
      (name) => ({ value: name, displayText: name, label: <span>{name}</span> })
    );
    const typed = query.trim().slice(0, MAX_LANGUAGE_LENGTH);
    const typedKey = typed.toLowerCase();
    const isListed = LANGUAGE_OPTIONS.some((name) => name.toLowerCase() === typedKey);
    if (typed && !isListed && !selectedKeys.has(typedKey)) {
      result.push({ value: typed, displayText: typed, label: <span>Add &quot;{typed}&quot;</span> });
    }
    return result;
  }, [selectedKeys, query]);

  const atMax = value.length >= max;

  // The input remounts after each pick so the kit AutoComplete drops its
  // remembered selection; focus returns to it for the next pick.
  useEffect(() => {
    if (inputKey === 0) return;
    inputAreaRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
  }, [inputKey]);

  const addLanguage = (name: string) => {
    const trimmed = name.trim().slice(0, MAX_LANGUAGE_LENGTH);
    if (!trimmed || atMax || selectedKeys.has(trimmed.toLowerCase())) return;
    const listed = LANGUAGE_OPTIONS.find((option) => option.toLowerCase() === trimmed.toLowerCase());
    const added = listed ?? trimmed;
    onChange([...value, added]);
    setAnnouncement(`${added} added.`);
    setQuery("");
    setInputKey((key) => key + 1);
  };

  const removeAt = (index: number) => {
    const name = value[index];
    onChange(value.filter((_, i) => i !== index));
    setAnnouncement(`${name} removed.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.key !== "Backspace" || value.length === 0) return;
    const target = event.target as HTMLInputElement;
    if (target.tagName === "INPUT" && target.value === "") removeAt(value.length - 1);
  };

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
          <ul className={styles.chips} role="list" aria-label="Selected languages">
            {value.map((name, index) => (
              <li key={name} className={styles.chip}>
                <span className={styles.chipName}>{name}</span>
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
              onValueChange={(option) => addLanguage(option.displayText || option.value)}
              inputValue={query}
              onInputValueChange={setQuery}
              disabled={atMax}
              placeholder={atMax ? `Up to ${max} languages` : value.length === 0 ? placeholder : "Add another language"}
              emptyMessage="Type a language to add it."
            />
          </div>
        )}
      </div>

      {!disabled && atMax && <p className={styles.limit}>Up to {max} languages</p>}
      {disabled && value.length === 0 && <p className={styles.empty}>No language selected</p>}
      <span className={styles.srOnly} aria-live="polite">
        {announcement}
      </span>
    </div>
  );
};
