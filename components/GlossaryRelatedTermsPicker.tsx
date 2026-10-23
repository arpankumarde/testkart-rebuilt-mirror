import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { useAdminGlossaryList } from "../helpers/useAdminGlossary";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import { RELATED_TERM_COUNT } from "../helpers/glossaryValidation";
import type { GlossaryRelatedTerm } from "../endpoints/admin/glossary/get_GET.schema";
import { Button } from "./Button";
import { Input } from "./Input";
import { Spinner } from "./Spinner";
import styles from "./GlossaryRelatedTermsPicker.module.css";

interface GlossaryRelatedTermsPickerProps {
  value: GlossaryRelatedTerm[];
  onChange: (terms: GlossaryRelatedTerm[]) => void;
  /** The term being edited, which can never relate to itself. */
  excludeId?: number;
  className?: string;
}

/** Chooses the three related terms. Names and definitions always come from the terms themselves. */
export const GlossaryRelatedTermsPicker: React.FC<GlossaryRelatedTermsPickerProps> = ({ value, onChange, excludeId, className }) => {
  const [search, setSearch] = useState("");
  const searchInput = useDebouncedInput(search, (next) => setSearch(next.trim()));
  const isFull = value.length >= RELATED_TERM_COUNT;
  const results = useAdminGlossaryList({ search, sort: "alphabetical", limit: 12 }, !!search && !isFull);

  const chosenIds = new Set(value.map((term) => term.id));
  const options = search
    ? (results.data?.rows ?? []).filter((row) => row.id !== excludeId && !chosenIds.has(row.id))
    : [];

  const add = (term: GlossaryRelatedTerm) => {
    if (isFull || chosenIds.has(term.id)) return;
    onChange([...value, term]);
    searchInput.onChange("");
    setSearch("");
  };

  return (
    <div className={`${styles.picker} ${className ?? ""}`}>
      {value.length > 0 && (
        <ol className={styles.chosen}>
          {value.map((term, index) => (
            <li key={term.id} className={styles.chosenRow}>
              <span className={styles.position}>{index + 1}</span>
              <div className={styles.text}>
                <span className={styles.name}>
                  {term.term}
                  {term.status === "draft" && <span className={styles.draft}>Draft</span>}
                </span>
                <span className={styles.definition}>{term.definition}</span>
                {term.status === "draft" && <span className={styles.hidden}>Stays off the public page until it is published.</span>}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${term.term}`}
                onClick={() => onChange(value.filter((item) => item.id !== term.id))}
              >
                <X size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <Input
          type="search"
          className={styles.searchInput}
          aria-label="Search glossary terms"
          placeholder={isFull ? "Three terms chosen. Remove one to change it." : "Search glossary terms"}
          value={searchInput.value}
          disabled={isFull}
          onChange={(e) => searchInput.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              searchInput.flush();
            }
          }}
        />
      </div>

      {search && !isFull && (
        <div className={styles.results} aria-busy={results.isFetching}>
          {results.isFetching && !results.data ? (
            <div className={styles.resultNote}>
              <Spinner size="sm" /> Searching...
            </div>
          ) : results.isError ? (
            <p className={styles.resultNote}>The search did not work. Try again.</p>
          ) : options.length === 0 ? (
            <p className={styles.resultNote}>No other term matches "{search}".</p>
          ) : (
            <ul className={styles.resultList}>
              {options.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() =>
                      add({ id: row.id, term: row.term, slug: row.slug, category: row.category, definition: row.definition, status: row.status })
                    }
                  >
                    <span className={styles.name}>
                      {row.term}
                      {row.status === "draft" && <span className={styles.draft}>Draft</span>}
                    </span>
                    <span className={styles.definition}>{row.definition}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};