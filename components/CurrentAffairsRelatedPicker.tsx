import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { CurrentAffairsStatusBadge } from "./CurrentAffairsStatusBadge";
import { useAdminCurrentAffairsList } from "../helpers/useAdminCurrentAffairs";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type { CurrentAffairsRelatedSummary } from "../endpoints/admin/current-affairs/get_GET.schema";
import styles from "./CurrentAffairsRelatedPicker.module.css";

interface CurrentAffairsRelatedPickerProps {
  value: number[];
  onChange: (ids: number[]) => void;
  /* Titles for ids already chosen; grows as the admin adds results. */
  known: Record<number, CurrentAffairsRelatedSummary>;
  onKnown: (summary: CurrentAffairsRelatedSummary) => void;
  excludeId?: number;
  max?: number;
}

export const CurrentAffairsRelatedPicker: React.FC<CurrentAffairsRelatedPickerProps> = ({
  value,
  onChange,
  known,
  onKnown,
  excludeId,
  max = 6,
}) => {
  const [search, setSearch] = useState("");
  const input = useDebouncedInput(search, setSearch);
  const { data, isFetching } = useAdminCurrentAffairsList({ search: search || undefined, limit: 8, page: 1 });
  const results = (data?.rows ?? []).filter((row) => row.id !== excludeId && !value.includes(row.id));
  const full = value.length >= max;

  return (
    <div className={styles.root}>
      {value.length > 0 && (
        <ol className={styles.selected}>
          {value.map((id) => {
            const item = known[id];
            return (
              <li key={id} className={styles.selectedRow}>
                <span className={styles.selectedTitle}>{item?.title ?? `Post #${id}`}</span>
                {item && <CurrentAffairsStatusBadge status={item.status} />}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  aria-label={`Remove ${item?.title ?? "related post"}`}
                >
                  <X size={14} />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <Input
        type="search"
        placeholder={full ? `Up to ${max} related posts` : "Search current affairs to link"}
        aria-label="Search related current affairs"
        value={input.value}
        disabled={full}
        onChange={(e) => input.onChange(e.target.value)}
      />

      {!full && (
        <ul className={styles.results} aria-busy={isFetching}>
          {isFetching && !data ? (
            <li>
              <Skeleton style={{ height: "2.25rem" }} />
            </li>
          ) : results.length === 0 ? (
            <li className={styles.none}>{search ? "No matches" : "Nothing else to link yet"}</li>
          ) : (
            results.slice(0, 6).map((row) => (
              <li key={row.id} className={styles.resultRow}>
                <div className={styles.resultText}>
                  <span className={styles.resultTitle}>{row.title}</span>
                  <span className={styles.resultMeta}>
                    {currentAffairsMeta.contentTypeShort(row.contentType)}
                    {row.digestDate ? ` - ${currentAffairsMeta.formatDay(row.digestDate)}` : ""}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onKnown({ id: row.id, title: row.title, slug: row.slug, contentType: row.contentType, status: row.status });
                    onChange([...value, row.id]);
                  }}
                >
                  <Plus size={14} /> Link
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};