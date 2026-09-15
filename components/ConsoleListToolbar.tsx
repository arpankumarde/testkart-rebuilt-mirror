import React from "react";
import { Search } from "lucide-react";
import { Input } from "./Input";
import styles from "./ConsoleListToolbar.module.css";

export interface ConsoleListTab {
  value: string;
  label: string;
  /* Omit when the list is server-paginated and a total is not known. */
  count?: number;
}

interface ConsoleListToolbarProps {
  tabs?: ConsoleListTab[];
  value?: string;
  onValueChange?: (value: string) => void;
  tabsLabel?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
  };
  /* Extra filter controls, rendered next to the search field. */
  children?: React.ReactNode;
  className?: string;
}

/* Give this to a SelectTrigger dropped into the toolbar so it sizes like the
   sort control on Test series. */
export const consoleToolbarControlClass = styles.control;

/*
 * One band holding the status tabs and the filters. The pages this replaces
 * stacked a header, a search row and a tab row separately, which pushed
 * content below the fold before anything was on screen.
 *
 * TeacherListToolbar re-exports this.
 */
export const ConsoleListToolbar: React.FC<ConsoleListToolbarProps> = ({
  tabs,
  value,
  onValueChange,
  tabsLabel,
  search,
  children,
  className,
}) => {
  const hasTabs = !!tabs && tabs.length > 0;
  const hasFilters = !!search || !!children;

  if (!hasTabs && !hasFilters) return null;

  return (
    <div className={`${styles.toolbar} ${className ?? ""}`}>
      {hasTabs && (
        <div className={styles.tabs} role="tablist" aria-label={tabsLabel}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={value === tab.value}
              className={`${styles.tab} ${value === tab.value ? styles.tabActive : ""}`}
              onClick={() => onValueChange?.(tab.value)}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span className={styles.tabCount}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {hasFilters && (
        <div className={styles.filters}>
          {search && (
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <Input
                type="search"
                placeholder={search.placeholder}
                aria-label={search.label}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
