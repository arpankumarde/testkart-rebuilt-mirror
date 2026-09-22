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
  /* Id of the region the tabs filter. Wires aria-controls on each tab and
     gives tab ids of the form `${panelId}-tab-${value}` for aria-labelledby. */
  panelId?: string;
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
  panelId,
  search,
  children,
  className,
}) => {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const hasTabs = !!tabs && tabs.length > 0;
  const hasFilters = !!search || !!children;

  if (!hasTabs && !hasFilters) return null;

  const selectedIndex = hasTabs ? Math.max(0, tabs.findIndex((tab) => tab.value === value)) : 0;

  // Roving focus, as the tab role promises: one tab stop for the group, arrow
  // keys and Home/End move between tabs and select as they go.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!tabs) return;
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    onValueChange?.(tabs[next].value);
  };

  return (
    <div className={`${styles.toolbar} ${className ?? ""}`}>
      {hasTabs && (
        <div className={styles.tabs} role="tablist" aria-label={tabsLabel}>
          {tabs.map((tab, index) => (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={panelId ? `${panelId}-tab-${tab.value}` : undefined}
              aria-controls={panelId}
              aria-selected={value === tab.value}
              tabIndex={index === selectedIndex ? 0 : -1}
              className={`${styles.tab} ${value === tab.value ? styles.tabActive : ""}`}
              onClick={() => onValueChange?.(tab.value)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
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
