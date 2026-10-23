import React, { useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { glossarySearch } from "../helpers/glossarySearch";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { GlossaryCategoryLabel } from "./GlossaryCategoryLabel";
import { Input } from "./Input";
import styles from "./GlossarySearch.module.css";

const MAX_RESULTS = 6;

const Highlighted: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>
    {glossarySearch.highlight(text, query).map((part, index) =>
      part.match ? (
        <mark key={index} className={styles.mark}>
          {part.text}
        </mark>
      ) : (
        <React.Fragment key={index}>{part.text}</React.Fragment>
      )
    )}
  </>
);

interface GlossarySearchProps {
  terms: PublicGlossaryCard[];
  className?: string;
}

/** Instant search over the terms already on the page, as a combobox of links. */
export const GlossarySearch: React.FC<GlossarySearchProps> = ({ terms, className }) => {
  const navigate = useNavigate();
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => glossarySearch.find(terms, query), [terms, query]);
  const results = matches.slice(0, MAX_RESULTS);
  const hasQuery = query.trim().length > 0;
  const showList = open && hasQuery;
  const optionId = (index: number) => `${listId}-${index}`;

  const clear = () => {
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showList || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(glossaryMeta.termPath(results[active].slug));
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`${styles.search} ${className ?? ""}`}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search size={20} className={styles.icon} aria-hidden="true" />
      <Input
        ref={inputRef}
        className={styles.input}
        type="text"
        role="combobox"
        aria-label="Search glossary terms and definitions"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results.length > 0 ? optionId(active) : undefined}
        autoComplete="off"
        placeholder="Search terms, definitions, e.g. Mock Test..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {query && (
        <button type="button" className={styles.clear} aria-label="Clear search" onClick={clear}>
          <X size={16} aria-hidden="true" />
        </button>
      )}

      <div id={listId} role="listbox" aria-label="Matching terms" className={styles.panel} hidden={!showList}>
        {results.map((term, index) => (
          <Link
            key={term.slug}
            id={optionId(index)}
            to={glossaryMeta.termPath(term.slug)}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            className={`${styles.option} ${index === active ? styles.optionActive : ""}`}
            // Keeps focus in the input, so the panel is still there when the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
          >
            <span className={styles.optionHead}>
              <span className={styles.optionTerm}>
                <Highlighted text={term.term} query={query} />
              </span>
              <GlossaryCategoryLabel category={term.category} className={styles.optionCategory} />
            </span>
            <span className={styles.optionDefinition}>
              <Highlighted text={term.definition} query={query} />
            </span>
          </Link>
        ))}
        {hasQuery && results.length === 0 && (
          <p className={styles.empty}>
            <strong>No terms match "{query.trim()}"</strong>
            Try a shorter word, or browse the letters below.
          </p>
        )}
        {matches.length > results.length && (
          <p className={styles.more}>
            Showing {results.length} of {matches.length} matches
          </p>
        )}
      </div>
    </div>
  );
};