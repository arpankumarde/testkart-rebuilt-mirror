import React from "react";
import styles from "./TeacherStatusTabs.module.css";

/** One status a content page can filter by. `word` names it inside a sentence ("No draft courses yet"). */
export type TeacherStatusTabDef<V extends string = string> = {
  value: V;
  label: string;
  word: string;
};

export type TeacherStatusTab<V extends string = string> = TeacherStatusTabDef<V> & { count: number };

/** Pairs a page's tab definitions with its counts; a status missing from `counts` shows 0. */
export const withStatusCounts = <V extends string>(
  defs: readonly TeacherStatusTabDef<V>[],
  counts: Partial<Record<V, number>> | undefined
): TeacherStatusTab<V>[] => defs.map((def) => ({ ...def, count: counts?.[def.value] ?? 0 }));

/**
 * The one visibility rule for content status tabs: they show only once the
 * teacher has at least one item in any status. An unknown total (still
 * loading) counts as none, so the tabs never flash in and out.
 */
export const hasContent = (total: number | undefined): total is number =>
  typeof total === "number" && total > 0;

export type TeacherStatusTabsProps<V extends string = string> = {
  tabs: TeacherStatusTab<V>[];
  /** null when the list is narrowed some other way and no tab applies. */
  value: V | null;
  onValueChange: (value: V) => void;
  /** Every item the teacher has across all statuses. */
  total: number | undefined;
  label?: string;
  /** Id of the region the tabs filter; wires aria-controls and `${panelId}-tab-${value}` ids. */
  panelId?: string;
};

/**
 * Status tabs for every teacher content list. Pages pass their own statuses
 * and counts; this component owns how they look and when they show.
 */
export const TeacherStatusTabs = <V extends string>({
  tabs,
  value,
  onValueChange,
  total,
  label = "Filter by status",
  panelId,
}: TeacherStatusTabsProps<V>) => {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (!hasContent(total) || tabs.length === 0) return null;

  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    onValueChange(tabs[next].value);
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={panelId ? `${panelId}-tab-${tab.value}` : undefined}
            aria-controls={panelId}
            aria-selected={active}
            tabIndex={index === selectedIndex ? 0 : -1}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            onClick={() => onValueChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
            <span className={styles.count}>
              {tab.count}
              <span className={styles.visuallyHidden}> {tab.count === 1 ? "item" : "items"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};