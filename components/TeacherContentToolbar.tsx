import React from "react";
import { Search } from "lucide-react";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import { TeacherStatusTabs, hasContent, type TeacherStatusTabsProps } from "./TeacherStatusTabs";
import styles from "./TeacherContentToolbar.module.css";

type Option = { value: string; label: string };

/** A dropdown in the toolbar: a filter such as category, or the sort order. */
export type TeacherContentSelect = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Option[];
};

/** onChange fires once typing pauses, or at once on Enter or when cleared. */
export type TeacherContentSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

export type TeacherContentToolbarProps<V extends string = string> = {
  tabs: TeacherStatusTabsProps<V>;
  search?: TeacherContentSearch;
  /** Rendered after the search box, in order. */
  selects?: TeacherContentSelect[];
};

const ToolbarSearch = ({ search }: { search: TeacherContentSearch }) => {
  const input = useDebouncedInput(search.value, search.onChange);
  return (
    <div className={styles.searchWrapper}>
      <Search size={16} className={styles.searchIcon} aria-hidden="true" />
      <Input
        type="search"
        placeholder={search.placeholder}
        aria-label={search.label}
        value={input.value}
        onChange={(e) => input.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") input.flush();
        }}
        className={styles.searchInput}
      />
    </div>
  );
};

/**
 * The toolbar of every teacher content list: status tabs on the left, search
 * and dropdowns on the right. Hidden with the tabs while the teacher has no
 * content at all, since there is nothing to filter.
 */
export const TeacherContentToolbar = <V extends string>({ tabs, search, selects }: TeacherContentToolbarProps<V>) => {
  if (!hasContent(tabs.total)) return null;
  const hasFilters = !!search || (selects?.length ?? 0) > 0;

  return (
    <div className={styles.toolbar}>
      <TeacherStatusTabs {...tabs} />
      {hasFilters && (
        <div className={styles.filters}>
          {search && <ToolbarSearch search={search} />}
          {selects?.map((select) => (
            <Select key={select.label} value={select.value} onValueChange={select.onChange}>
              <SelectTrigger className={styles.select} aria-label={select.label}>
                <SelectValue placeholder={select.label} />
              </SelectTrigger>
              <SelectContent>
                {select.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}
    </div>
  );
};