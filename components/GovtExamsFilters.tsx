import React from "react";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { GEC_CATEGORIES, type GecCategory } from "../helpers/govtExamsCalendarData";
import { ALL, GEC_MONTH_OPTIONS, isFiltering, type GecFilters } from "../helpers/govtExamsCalendarFilter";
import styles from "./GovtExamsFilters.module.css";

interface GovtExamsFiltersProps {
  filters: GecFilters;
  onChange: (filters: GecFilters) => void;
  matchCount: number;
  totalCount: number;
}

/** Search box plus Category and Month selects. Filtering happens in place; nothing reloads. */
export const GovtExamsFilters: React.FC<GovtExamsFiltersProps> = ({ filters, onChange, matchCount, totalCount }) => {
  const filtering = isFiltering(filters);

  return (
    <div className={styles.filters} role="search" aria-label="Filter the exam tables">
      <div className={styles.row}>
        <div className={styles.searchBox}>
          <label htmlFor="gec-search" className={styles.srOnly}>
            Search exams
          </label>
          <Search size={20} className={styles.searchIcon} aria-hidden="true" />
          <input
            id="gec-search"
            type="search"
            className={styles.input}
            placeholder="Search exam, e.g. SSC CGL, IBPS Clerk, RRB JE"
            value={filters.query}
            autoComplete="off"
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
          />
          {filters.query && (
            <button
              type="button"
              className={styles.clearQuery}
              aria-label="Clear search"
              onClick={() => onChange({ ...filters, query: "" })}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <Select
          value={filters.category}
          onValueChange={(value) => onChange({ ...filters, category: value as GecCategory | typeof ALL })}
        >
          <SelectTrigger className={styles.select} aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {GEC_CATEGORIES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.month} onValueChange={(value) => onChange({ ...filters, month: value })}>
          <SelectTrigger className={styles.select} aria-label="Month">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All months</SelectItem>
            {GEC_MONTH_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.summary} aria-live="polite">
        {filtering ? (
          <>
            <span>
              Showing <strong>{matchCount}</strong> of {totalCount} rows across the tables below.
            </span>
            <button type="button" className={styles.reset} onClick={() => onChange({ query: "", category: ALL, month: ALL })}>
              Clear filters
            </button>
          </>
        ) : (
          <span>Filters the tables below as you type. A month matches any date in a row: notice, last date or exam.</span>
        )}
      </div>
    </div>
  );
};
