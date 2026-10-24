import React, { useId } from "react";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { DEFAULT_CONTENT_VISIBILITY, VISIBILITY_OPTIONS } from "../helpers/contentVisibility";
import type { ContentVisibility } from "../helpers/schema";
import styles from "./ContentVisibilityPicker.module.css";

interface ContentVisibilityPickerProps {
  value: ContentVisibility;
  onChange: (value: ContentVisibility) => void;
  disabled?: boolean;
  /** Shown under the options, e.g. what the choice does to a live item. */
  footnote?: React.ReactNode;
  /** The item's current status, shown beside the heading. */
  status?: React.ReactNode;
  /** An option that cannot be chosen right now, shown with this tag, e.g. while a request is pending. */
  locked?: { value: ContentVisibility; tag: string };
  className?: string;
}

/*
 * Public or unlisted choice for a teacher item, as a compact radio list: Public
 * leads and carries the Default tag, Unlisted sits under it as the quieter
 * option. Controlled; ContentVisibilityPanel saves it.
 */
export const ContentVisibilityPicker: React.FC<ContentVisibilityPickerProps> = ({
  value,
  onChange,
  disabled,
  footnote,
  status,
  locked,
  className,
}) => {
  const id = useId();

  return (
    <fieldset className={`${styles.fieldset} ${className ?? ""}`} disabled={disabled}>
      <legend className={styles.legend}>
        Visibility
        {status}
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as ContentVisibility)}
        disabled={disabled}
        className={styles.options}
        aria-label="Visibility"
      >
        {VISIBILITY_OPTIONS.map((option) => {
          const itemId = `${id}-${option.value}`;
          const isLocked = locked?.value === option.value;
          const isDefault = option.value === DEFAULT_CONTENT_VISIBILITY;
          return (
            <label
              key={option.value}
              htmlFor={itemId}
              className={styles.option}
              data-tone={isDefault ? "primary" : "secondary"}
              data-selected={value === option.value ? "true" : undefined}
              data-locked={isLocked ? "true" : undefined}
            >
              <RadioGroupItem id={itemId} value={option.value} disabled={isLocked} className={styles.radio} />
              <span className={styles.text}>
                <span className={styles.label}>
                  {option.label}
                  {isLocked ? (
                    <span className={styles.lockedTag}>{locked.tag}</span>
                  ) : (
                    isDefault && <span className={styles.defaultTag}>Default</span>
                  )}
                </span>
                <span className={styles.description}>{option.description}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </fieldset>
  );
};