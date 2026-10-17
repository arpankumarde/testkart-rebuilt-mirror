import React, { useId } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { FormControl, FormItem, FormMessage } from "./Form";
import type { CurrentAffairsSourceInput } from "../endpoints/admin/current-affairs/save_POST.schema";
import styles from "./CurrentAffairsSourcesEditor.module.css";

const COMMON_SOURCES = ["PIB", "The Hindu", "Indian Express", "PRS Legislative Research", "RBI", "MEA", "Down To Earth", "Sansad TV"];

interface CurrentAffairsSourcesEditorProps {
  /* Form path of the list, e.g. "sources" or "items.2.sources". */
  name: string;
  value: CurrentAffairsSourceInput[];
  onChange: (value: CurrentAffairsSourceInput[]) => void;
  /* Names offered as you type; defaults to the usual current affairs sources. */
  suggestions?: string[];
  addLabel?: string;
}

export const CurrentAffairsSourcesEditor: React.FC<CurrentAffairsSourcesEditorProps> = ({
  name,
  value,
  onChange,
  suggestions = COMMON_SOURCES,
  addLabel = "Add source",
}) => {
  const listId = useId();
  const update = (index: number, patch: Partial<CurrentAffairsSourceInput>) =>
    onChange(value.map((source, i) => (i === index ? { ...source, ...patch } : source)));

  return (
    <FormItem name={name} className={styles.root}>
      <datalist id={listId}>
        {suggestions.map((source) => (
          <option key={source} value={source} />
        ))}
      </datalist>
      {value.length > 0 && (
        <ol className={styles.list}>
          {value.map((source, index) => (
            <li key={index} className={styles.row}>
              <FormItem name={`${name}.${index}.name`} className={styles.nameField}>
                <FormControl>
                  <Input
                    list={listId}
                    placeholder="Source, e.g. PIB"
                    aria-label={`Source ${index + 1} name`}
                    value={source.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name={`${name}.${index}.url`} className={styles.urlField}>
                <FormControl>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    aria-label={`Source ${index + 1} link`}
                    value={source.url}
                    onChange={(e) => update(index, { url: e.target.value })}
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url && !/^https?:\/\//i.test(url) && /^[\w-]+\.[\w.-]+/.test(url)) update(index, { url: `https://${url}` });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.remove}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove source ${index + 1}`}
                title="Remove source"
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.footer}>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, { name: "", url: "" }])}>
          {value.length === 0 ? <Link2 size={14} /> : <Plus size={14} />} {addLabel}
        </Button>
        <FormMessage />
      </div>
    </FormItem>
  );
};