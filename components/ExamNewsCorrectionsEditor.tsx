import React from "react";
import { FilePenLine, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { FormControl, FormItem, FormMessage } from "./Form";
import { examNewsMeta } from "../helpers/examNewsMeta";
import type { ExamNewsCorrectionInput } from "../endpoints/admin/exam-news/save_POST.schema";
import styles from "./ExamNewsCorrectionsEditor.module.css";

interface ExamNewsCorrectionsEditorProps {
  value: ExamNewsCorrectionInput[];
  onChange: (value: ExamNewsCorrectionInput[]) => void;
}

/* Dated notes shown under the story; the public page only draws the box when one exists. */
export const ExamNewsCorrectionsEditor: React.FC<ExamNewsCorrectionsEditorProps> = ({ value, onChange }) => {
  const update = (index: number, patch: Partial<ExamNewsCorrectionInput>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className={styles.root}>
      {value.length > 0 && (
        <ol className={styles.list}>
          {value.map((row, index) => (
            <li key={row.key} className={styles.row}>
              <FormItem name={`corrections.${index}.date`} className={styles.dateField}>
                <FormControl>
                  <Input
                    type="date"
                    aria-label={`Correction ${index + 1} date`}
                    value={row.date}
                    onChange={(e) => update(index, { date: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name={`corrections.${index}.note`} className={styles.noteField}>
                <FormControl>
                  <Textarea
                    rows={2}
                    aria-label={`Correction ${index + 1} note`}
                    placeholder="What was wrong and what it now says"
                    value={row.note}
                    onChange={(e) => update(index, { note: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.remove}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove correction ${index + 1}`}
                title="Remove correction"
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.footer}>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...value, { key: `new-${Date.now()}`, date: examNewsMeta.istToday(), note: "" }])
          }
        >
          {value.length === 0 ? <FilePenLine size={14} /> : <Plus size={14} />} Add correction
        </Button>
        {value.length === 0 && <span className={styles.empty}>None. Add one only when a published fact changes.</span>}
      </div>
    </div>
  );
};