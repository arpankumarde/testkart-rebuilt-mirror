import React, { useState } from "react";
import { Link2, Search, X } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { useAdminGecTestkartExams } from "../helpers/useAdminGovtExamsCalendar";
import styles from "./GecExamPicker.module.css";

export type GecPickedExam = { id: number; name: string; slug: string };

interface GecExamPickerProps {
  value: GecPickedExam | null;
  onChange: (exam: GecPickedExam | null) => void;
  id?: string;
  placeholder?: string;
}

/** Searches existing Testkart exams (the /exams/:slug hubs) so the calendar links to them instead of new pages. */
export const GecExamPicker: React.FC<GecExamPickerProps> = ({ value, onChange, id, placeholder = "Search Testkart exams, e.g. SSC CGL" }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useAdminGecTestkartExams(query);
  const results = query.trim().length >= 2 ? data?.exams ?? [] : [];

  if (value) {
    return (
      <div className={styles.chosen}>
        <Link2 size={15} aria-hidden="true" />
        <span className={styles.chosenName}>{value.name}</span>
        <span className={styles.slug}>/exams/{value.slug}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Remove the linked exam" onClick={() => onChange(null)}>
          <X size={15} />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open && query.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.icon} aria-hidden="true" />
          <Input
            id={id}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            className={styles.input}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.panel} onOpenAutoFocus={(e) => e.preventDefault()}>
        {results.length === 0 ? (
          <p className={styles.empty}>{isFetching ? "Searching..." : "No Testkart exam matches"}</p>
        ) : (
          <ul className={styles.list} role="listbox">
            {results.map((exam) => (
              <li key={exam.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={styles.option}
                  onClick={() => {
                    onChange({ id: exam.id, name: exam.name, slug: exam.slug });
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className={styles.optionName}>{exam.name}</span>
                  <span className={styles.slug}>/exams/{exam.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};