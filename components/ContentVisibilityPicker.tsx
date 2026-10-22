import React, { useId } from "react";
import { Globe, Link2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { VISIBILITY_OPTIONS } from "../helpers/contentVisibility";
import type { ContentVisibility } from "../helpers/schema";
import styles from "./ContentVisibilityPicker.module.css";

const ICONS: Record<ContentVisibility, typeof Globe> = { public: Globe, unlisted: Link2 };

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

/* Public or unlisted choice for a teacher item. Controlled: create forms keep it in state, ContentVisibilityPanel saves it. */
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
          const Icon = ICONS[option.value];
          const itemId = `${id}-${option.value}`;
          const isLocked = locked?.value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={itemId}
              className={styles.option}
              data-selected={value === option.value ? "true" : undefined}
              data-locked={isLocked ? "true" : undefined}
            >
              <RadioGroupItem id={itemId} value={option.value} disabled={isLocked} className={styles.radio} />
              <span className={styles.icon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.text}>
                <span className={styles.label}>
                  {option.label}
                  {isLocked ? (
                    <span className={styles.lockedTag}>{locked.tag}</span>
                  ) : (
                    option.value === "public" && <span className={styles.defaultTag}>Default</span>
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