import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import styles from "./SegmentedControl.module.css";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  "aria-label": string;
  className?: string;
};

export const SegmentedControl = <T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) => (
  <ToggleGroupPrimitive.Root
    type="single"
    value={value}
    // Radix clears the value when the active segment is clicked again; a
    // segmented control always keeps one selected.
    onValueChange={(next) => {
      if (next) onValueChange(next as T);
    }}
    aria-label={ariaLabel}
    className={`${styles.track} ${className ?? ""}`}
  >
    {options.map((option) => (
      <ToggleGroupPrimitive.Item
        key={option.value}
        value={option.value}
        aria-label={option.ariaLabel}
        className={styles.segment}
      >
        {option.label}
      </ToggleGroupPrimitive.Item>
    ))}
  </ToggleGroupPrimitive.Root>
);
