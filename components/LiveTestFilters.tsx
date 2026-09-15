import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { useIsMobile } from '../helpers/useIsMobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select';
import { LiveTestStatus, LiveTestStatusArray } from '../endpoints/live-tests/list_GET.schema';
import styles from './LiveTestFilters.module.css';

type StatusFilter = 'all' | LiveTestStatus;

interface LiveTestFiltersProps {
  selectedStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live Now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
];

export const LiveTestFilters: React.FC<LiveTestFiltersProps> = ({
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  className,
}) => {
  const isMobile = useIsMobile();

  const renderDesktopFilters = () => (
    <div className={styles.desktopContainer}>
      <div className={styles.tabs}>
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedStatus === option.value ? 'primary' : 'ghost'}
            onClick={() => onStatusChange(option.value)}
            className={styles.tabButton}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className={styles.desktopFiltersRight}>
        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <Input
            type="search"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>
    </div>
  );

  const renderMobileFilters = () => (
    <div className={styles.mobileContainer}>
      <div className={styles.searchContainer}>
        <Search size={18} className={styles.searchIcon} />
        <Input
          type="search"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as StatusFilter)}>
        <SelectTrigger className={styles.mobileSelectTrigger}>
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {isMobile ? renderMobileFilters() : renderDesktopFilters()}
    </div>
  );
};