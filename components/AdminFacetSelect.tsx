import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./Command";
import styles from "./AdminFacetSelect.module.css";

export type FacetSelectOption = {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
};

interface AdminFacetSelectProps {
  label: string;
  options: FacetSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Shown when nothing is picked. */
  allLabel?: string;
  /** Search box inside the list; on by default once the list is long. */
  searchable?: boolean;
  id?: string;
  className?: string;
}

/*
 * A multi-select that looks like the console's Select: pick any number of
 * values, OR-ed together on the server. The popover stays open while picking,
 * and long lists get a search box.
 */
export const AdminFacetSelect: React.FC<AdminFacetSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  allLabel = "All",
  searchable,
  id,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const showSearch = searchable ?? options.length > 8;
  const selectedSet = new Set(selected);
  // A value from a shared link that is no longer offered still shows, so it can be removed.
  const missing = selected.filter((value) => !options.some((o) => o.value === value));
  const allOptions: FacetSelectOption[] = [...options, ...missing.map((value) => ({ value, label: value }))];

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? allOptions.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  const toggle = (value: string) => {
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={`${styles.trigger} ${selected.length ? styles.triggerActive : ""} ${className ?? ""}`}
          aria-label={`${label}: ${summary}`}
        >
          <span className={selected.length ? styles.value : styles.placeholder}>{summary}</span>
          {selected.length > 1 && <span className={styles.count}>{selected.length}</span>}
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" removeBackgroundAndPadding className={styles.content}>
        <Command className={styles.command} loop>
          {showSearch && <CommandInput placeholder={`Search ${label.toLowerCase()}`} />}
          <CommandList className={styles.list}>
            <CommandEmpty>No match</CommandEmpty>
            {allOptions.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => toggle(option.value)}
                  className={styles.item}
                  aria-checked={checked}
                  role="menuitemcheckbox"
                >
                  <span className={`${styles.box} ${checked ? styles.boxChecked : ""}`} aria-hidden="true">
                    {checked && <Check />}
                  </span>
                  {option.icon}
                  <span className={styles.label}>{option.label}</span>
                  {typeof option.count === "number" && (
                    <span className={styles.optionCount}>{option.count.toLocaleString("en-IN")}</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandList>
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.footerButton}
              onClick={() => onChange([])}
              disabled={selected.length === 0}
            >
              Clear
            </button>
            <button type="button" className={`${styles.footerButton} ${styles.done}`} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
};