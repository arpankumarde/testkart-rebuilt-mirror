import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import styles from "./ConsoleListPagination.module.css";

interface ConsoleListPaginationProps {
  page: number;
  /* Omit when the endpoint returns no total - pass hasNext instead. */
  totalPages?: number;
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

/* TeacherListPagination re-exports this. */
export const ConsoleListPagination: React.FC<ConsoleListPaginationProps> = ({
  page,
  totalPages,
  hasNext,
  onPageChange,
  className,
}) => {
  const canGoNext = typeof totalPages === "number" ? page < totalPages : !!hasNext;

  return (
    <nav className={`${styles.pagination} ${className ?? ""}`} aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft size={16} />
        Previous
      </Button>
      <span className={styles.pageInfo}>
        {typeof totalPages === "number" ? `Page ${page} of ${totalPages}` : `Page ${page}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
      >
        Next
        <ChevronRight size={16} />
      </Button>
    </nav>
  );
};
