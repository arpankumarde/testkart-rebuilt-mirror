import React from "react";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import type { ExamNewsKeyDateInput } from "../endpoints/admin/exam-news/save_POST.schema";
import styles from "./ExamNewsKeyDatesEditor.module.css";

const EVENT_SUGGESTIONS = [
  "Application window",
  "Correction window",
  "Admit card release",
  "Exam",
  "Answer key release",
  "Objection window",
  "Result",
  "Counselling",
];

const DATE_FIELDS = [
  { key: "startDate", label: "Start date", placeholder: "e.g. 23 October 2026" },
  { key: "endDate", label: "End date", placeholder: "e.g. Coming soon" },
  { key: "examDate", label: "Exam date", placeholder: "e.g. To be announced" },
  { key: "resultDate", label: "Result date", placeholder: "e.g. Not yet declared" },
] as const;

export const emptyExamNewsKeyDate = (): ExamNewsKeyDateInput => ({
  key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  eventName: "",
  startDate: "",
  endDate: "",
  examDate: "",
  resultDate: "",
  note: "",
});

interface ExamNewsKeyDatesEditorProps {
  value: ExamNewsKeyDateInput[];
  onChange: (value: ExamNewsKeyDateInput[]) => void;
}

/* One row per event; only the dates that apply need filling in, as a date or a status, shown as written. */
export const ExamNewsKeyDatesEditor: React.FC<ExamNewsKeyDatesEditorProps> = ({ value, onChange }) => {
  const update = (index: number, patch: Partial<ExamNewsKeyDateInput>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className={styles.root}>
      <datalist id="exam-news-events">
        {EVENT_SUGGESTIONS.map((event) => (
          <option key={event} value={event} />
        ))}
      </datalist>

      {value.length > 0 && (
        <ol className={styles.list}>
          {value.map((row, index) => (
            <li key={row.key} className={styles.row}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <div className={styles.fields}>
                <div className={styles.topLine}>
                  <FormItem name={`keyDates.${index}.eventName`} className={styles.eventField}>
                    <FormLabel className={styles.label}>Event</FormLabel>
                    <FormControl>
                      <Input
                        list="exam-news-events"
                        placeholder="e.g. Application window"
                        value={row.eventName}
                        onChange={(e) => update(index, { eventName: e.target.value })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name={`keyDates.${index}.note`} className={styles.noteField}>
                    <FormLabel className={styles.label}>Note (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Till 11:50 pm, Shift 1"
                        value={row.note}
                        onChange={(e) => update(index, { note: e.target.value })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
                <div className={styles.dates}>
                  {DATE_FIELDS.map((field) => (
                    <FormItem key={field.key} name={`keyDates.${index}.${field.key}`} className={styles.dateField}>
                      <FormLabel className={styles.label}>{field.label}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={field.placeholder}
                          maxLength={120}
                          value={row[field.key]}
                          onChange={(e) => update(index, { [field.key]: e.target.value })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.remove}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove date ${index + 1}`}
                title="Remove row"
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.footer}>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, emptyExamNewsKeyDate()])}>
          {value.length === 0 ? <CalendarPlus size={14} /> : <Plus size={14} />} Add date
        </Button>
        {value.length === 0 && <span className={styles.empty}>No key dates. Add the dates students will look for.</span>}
      </div>
    </div>
  );
};