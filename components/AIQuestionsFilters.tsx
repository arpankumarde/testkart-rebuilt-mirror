import React from "react";
import { Search, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Calendar } from "./Calendar";
import { type DateRange } from "react-day-picker";
import { type ExamWithCategory } from "../endpoints/admin/exams/list_GET.schema";
import styles from "./AIQuestionsFilters.module.css";

export type FilterValues = {
  searchQuery: string;
  examId?: number;
  markedForReview?: boolean;
  hasCustomPrompt?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
};

type AIQuestionsFiltersProps = {
  filters: FilterValues;
  exams?: ExamWithCategory[];
  onFilterChange: (key: string, value: string | number | boolean | Date | undefined | null) => void;
  onClearFilters: () => void;
};

export const AIQuestionsFilters: React.FC<AIQuestionsFiltersProps> = ({
  filters,
  exams,
  onFilterChange,
  onClearFilters,
}) => {
  return (
    <div className={styles.filters}>
      <div className={styles.searchInputWrapper}>
        <Search className={styles.searchIcon} size={18} />
        <Input
          placeholder="Search question text..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange('searchQuery', e.target.value)}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.filterControls}>
        <Select value={filters.examId ? String(filters.examId) : 'all'} onValueChange={(v) => onFilterChange('examId', v === 'all' ? undefined : Number(v))}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="All Exams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            {exams?.map((exam: ExamWithCategory) => <SelectItem key={exam.id} value={String(exam.id)}>{exam.examName}</SelectItem>)}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={styles.filterButton}>
              <CalendarIcon size={16} />
              <span>{filters.dateFrom && filters.dateTo ? `${filters.dateFrom.toLocaleDateString()} - ${filters.dateTo.toLocaleDateString()}` : 'Date Range'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end">
            <Calendar
              mode="range"
              selected={{ from: filters.dateFrom, to: filters.dateTo }}
              onSelect={(range: DateRange | undefined) => {
                onFilterChange('dateFrom', range?.from);
                onFilterChange('dateTo', range?.to);
              }}
            />
          </PopoverContent>
        </Popover>

        <Select value={filters.markedForReview === undefined ? 'all' : String(filters.markedForReview)} onValueChange={(v) => onFilterChange('markedForReview', v === 'all' ? undefined : v === 'true')}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Review Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Review Status</SelectItem>
            <SelectItem value="true">Marked for Review</SelectItem>
            <SelectItem value="false">Not Marked</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.hasCustomPrompt === undefined ? 'any' : String(filters.hasCustomPrompt)} onValueChange={(v) => onFilterChange('hasCustomPrompt', v === 'any' ? undefined : v === 'true')}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Custom Prompt" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Prompt</SelectItem>
            <SelectItem value="true">Has Custom Prompt</SelectItem>
            <SelectItem value="false">No Custom Prompt</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onClearFilters}>Clear Filters</Button>
      </div>
    </div>
  );
};