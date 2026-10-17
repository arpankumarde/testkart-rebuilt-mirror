import React, { useState } from "react";
import { useDebounce } from "use-debounce";
import { Check, ChevronsUpDown, GraduationCap, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./Command";
import { useExamNewsExamSearch } from "../helpers/useAdminExamNews";
import styles from "./ExamNewsExamPicker.module.css";

export type ExamNewsExamChoice = { id: number; name: string };

interface ExamNewsExamPickerProps {
  value: ExamNewsExamChoice | null;
  onChange: (value: ExamNewsExamChoice | null) => void;
  placeholder?: string;
  /* "Any exam" row and a clear button, for the list filter. */
  allowClear?: boolean;
  clearLabel?: string;
  invalid?: boolean;
  className?: string;
  id?: string;
}

/* Searches the exam catalogue on the server: there are too many exams for a plain select. */
export const ExamNewsExamPicker: React.FC<ExamNewsExamPickerProps> = ({
  value,
  onChange,
  placeholder = "Choose an exam",
  allowClear = false,
  clearLabel = "Any exam",
  invalid = false,
  className,
  id,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced] = useDebounce(search.trim(), 250);
  const { data, isFetching } = useExamNewsExamSearch({ search: debounced || undefined }, open);
  const exams = data?.exams ?? [];

  const choose = (choice: ExamNewsExamChoice | null) => {
    onChange(choice);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={`${styles.root} ${className ?? ""}`}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className={`${styles.trigger} ${value ? "" : styles.placeholder} ${allowClear && value ? styles.withClear : ""}`}
          >
            <GraduationCap size={16} className={styles.icon} aria-hidden="true" />
            <span className={styles.label}>{value ? value.name : placeholder}</span>
            <ChevronsUpDown size={15} className={styles.chevron} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        {allowClear && value && (
          <button type="button" className={styles.clear} onClick={() => choose(null)} aria-label="Clear exam filter">
            <X size={14} />
          </button>
        )}
      </div>
      <PopoverContent align="start" removeBackgroundAndPadding className={styles.popover}>
        <Command shouldFilter={false} className={styles.command}>
          <CommandInput placeholder="Search exams, e.g. NEET UG" value={search} onValueChange={setSearch} />
          <CommandList className={styles.list}>
            <CommandEmpty>{isFetching ? "Searching..." : "No exam matches"}</CommandEmpty>
            <CommandGroup>
              {allowClear && !debounced && (
                <CommandItem value="__any" onSelect={() => choose(null)} className={styles.item}>
                  <span className={styles.itemMain}>{clearLabel}</span>
                  {!value && <Check size={15} className={styles.check} aria-hidden="true" />}
                </CommandItem>
              )}
              {exams.map((exam) => (
                <CommandItem
                  key={exam.id}
                  value={String(exam.id)}
                  onSelect={() => choose({ id: exam.id, name: exam.examName })}
                  className={styles.item}
                >
                  <span className={styles.itemText}>
                    <span className={styles.itemMain}>{exam.examName}</span>
                    {(exam.fullName !== exam.examName || exam.categoryName) && (
                      <span className={styles.itemSub}>
                        {[exam.fullName !== exam.examName ? exam.fullName : null, exam.categoryName].filter(Boolean).join(" - ")}
                      </span>
                    )}
                  </span>
                  {value?.id === exam.id && <Check size={15} className={styles.check} aria-hidden="true" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};