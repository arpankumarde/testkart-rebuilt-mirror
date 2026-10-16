import React, { useId, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "./Input";
import { slugify } from "../helpers/slugify";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type { CurrentAffairsTagRef } from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsTagOption } from "../endpoints/admin/current-affairs/tags_GET.schema";
import type { CurrentAffairsTagKind } from "../helpers/schema";
import styles from "./CurrentAffairsTagPicker.module.css";

interface CurrentAffairsTagPickerProps {
  value: CurrentAffairsTagRef[];
  onChange: (value: CurrentAffairsTagRef[]) => void;
  options: CurrentAffairsTagOption[];
  kinds?: CurrentAffairsTagKind[];
  /* Full shows every predefined tag as a toggle; compact shows only the chosen ones plus a search. */
  variant?: "full" | "compact";
}

const MAX_SUGGESTIONS = 8;

const sameTag = (a: CurrentAffairsTagRef, kind: CurrentAffairsTagKind, slug: string) =>
  a.kind === kind && slugify(a.name) === slug;

const KindRow: React.FC<{
  kind: CurrentAffairsTagKind;
  value: CurrentAffairsTagRef[];
  onChange: (value: CurrentAffairsTagRef[]) => void;
  options: CurrentAffairsTagOption[];
  variant: "full" | "compact";
}> = ({ kind, value, onChange, options, variant }) => {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const meta = currentAffairsMeta.TAG_KINDS.find((k) => k.value === kind)!;
  const chosen = value.filter((tag) => tag.kind === kind);
  const kindOptions = useMemo(() => options.filter((o) => o.kind === kind), [options, kind]);
  const predefined = kindOptions.filter((o) => o.isPredefined);
  const isChosen = (slug: string) => chosen.some((tag) => slugify(tag.name) === slug);

  const querySlug = slugify(query);
  const suggestions = querySlug
    ? kindOptions
        .filter((o) => !isChosen(o.slug) && (o.slug.includes(querySlug) || o.name.toLowerCase().includes(query.trim().toLowerCase())))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const exact = kindOptions.find((o) => o.slug === querySlug);
  const canCreate = !!querySlug && !exact && !isChosen(querySlug);
  const entries = [
    ...suggestions.map((o) => ({ key: `o-${o.id}`, label: o.name, hint: o.isPredefined ? "Suggested" : `Used ${o.usageCount}x`, tag: { id: o.id, kind, name: o.name } })),
    ...(canCreate ? [{ key: "new", label: query.trim(), hint: "New custom tag", tag: { kind, name: query.trim() } }] : []),
  ];

  const add = (tag: CurrentAffairsTagRef) => {
    const slug = slugify(tag.name);
    if (!slug || value.some((t) => sameTag(t, kind, slug))) return;
    // A typed name that matches an existing tag reuses it instead of creating a near-duplicate.
    const existing = kindOptions.find((o) => o.slug === slug);
    onChange([...value, existing ? { id: existing.id, kind, name: existing.name } : tag]);
    setQuery("");
    setActive(0);
  };

  const remove = (slug: string) => onChange(value.filter((t) => !sameTag(t, kind, slug)));

  const toggle = (option: CurrentAffairsTagOption) =>
    isChosen(option.slug) ? remove(option.slug) : add({ id: option.id, kind, name: option.name });

  const customChosen = variant === "full" ? chosen.filter((tag) => !predefined.some((p) => p.slug === slugify(tag.name))) : chosen;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(entries.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const entry = entries[active] ?? entries[0];
      if (entry) add(entry.tag);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && !query && chosen.length > 0) {
      remove(slugify(chosen[chosen.length - 1].name));
    }
  };

  return (
    <div className={styles.kindRow}>
      <div className={styles.kindLabel}>
        <label htmlFor={inputId}>{meta.plural}</label>
        {chosen.length > 0 && <span className={styles.count}>{chosen.length} selected</span>}
      </div>

      {variant === "full" && predefined.length > 0 && (
        <div className={styles.toggles} role="group" aria-label={`Suggested ${meta.plural.toLowerCase()}`}>
          {predefined.map((option) => {
            const on = isChosen(option.slug);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                className={`${styles.toggle} ${styles[`kind_${kind}`]} ${on ? styles.toggleOn : ""}`}
                onClick={() => toggle(option)}
              >
                {on ? <X size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                {option.name}
              </button>
            );
          })}
        </div>
      )}

      {customChosen.length > 0 && (
        <ul className={styles.chips} aria-label={`Selected ${meta.plural.toLowerCase()}`}>
          {customChosen.map((tag) => (
            <li key={slugify(tag.name)} className={`${styles.chip} ${styles[`kind_${kind}`]} ${styles.toggleOn}`}>
              {tag.name}
              {!tag.id && <span className={styles.newMark}>new</span>}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => remove(slugify(tag.name))}
                aria-label={`Remove ${tag.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.combo}>
        <Input
          id={inputId}
          value={query}
          placeholder={variant === "full" ? `Add a custom ${meta.label.toLowerCase()} tag` : `Add ${meta.plural.toLowerCase()}`}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open && entries.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className={styles.comboInput}
        />
        {open && entries.length > 0 && (
          <ul id={listId} role="listbox" className={styles.listbox}>
            {entries.map((entry, index) => (
              <li
                key={entry.key}
                role="option"
                aria-selected={index === active}
                className={`${styles.option} ${index === active ? styles.optionActive : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(entry.tag);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span>{entry.key === "new" ? <>Add "{entry.label}"</> : entry.label}</span>
                <span className={styles.optionHint}>{entry.hint}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/*
 * Topic, exam and syllabus chips. Custom tags stay local until the post is saved, so removing one
 * before saving leaves nothing behind; on save the server matches names by slug to reuse tags.
 */
export const CurrentAffairsTagPicker: React.FC<CurrentAffairsTagPickerProps> = ({
  value,
  onChange,
  options,
  kinds = ["topic", "exam", "syllabus"],
  variant = "full",
}) => (
  <div className={`${styles.picker} ${variant === "compact" ? styles.compact : ""}`}>
    {kinds.map((kind) => (
      <KindRow key={kind} kind={kind} value={value} onChange={onChange} options={options} variant={variant} />
    ))}
  </div>
);