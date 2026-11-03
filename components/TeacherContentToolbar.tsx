import React from "react";
import { Search } from "lucide-react";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import styles from "./TeacherContentToolbar.module.css";

type Option = { value: string; label: string };

type Props = {
  tabs: (Option & { count: number })[];
  value: string;
  onValueChange: (value: string) => void;
  tabsLabel: string;
  search: { value: string; onChange: (value: string) => void; placeholder: string; label: string };
  sort: { value: string; onChange: (value: string) => void; label: string; options: Option[] };
};

/*
 * The pastel content-list toolbar (Test series, Courses): status tabs with
 * count badges on the left, search and sort on the right, one row that wraps
 * only when the two halves no longer fit.
 */
export const TeacherContentToolbar = ({ tabs, value, onValueChange, tabsLabel, search, sort }: Props) => (
  <div className={styles.toolbar}>
    <div className={styles.tabs} role="tablist" aria-label={tabsLabel}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            onClick={() => onValueChange(tab.value)}
          >
            {tab.label}
            <span className={styles.tabCount}>{tab.count}</span>
          </button>
        );
      })}
    </div>

    <div className={styles.filters}>
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
      <Select value={sort.value} onValueChange={sort.onChange}>
        <SelectTrigger className={styles.sort} aria-label={sort.label}>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {sort.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);