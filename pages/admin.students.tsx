import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useAdminStudentsQuery } from "../helpers/useAdminStudents";
import { useToggleUserStatusMutation } from "../helpers/useAdminUserActions";
import { useImpersonateMutation } from "../helpers/useImpersonation";
import { useDebounce } from "../helpers/useDebounce";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  UserX,
  LogIn,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Ban,
  UserCheck,
} from "lucide-react";
import { StudentAdminView } from "../endpoints/admin/students/list_GET.schema";
import styles from "./admin.students.module.css";

type SortableColumn = "name" | "email" | "createdAt" | "enrolledTestsCount" | "totalSpent";

const SORTABLE_COLUMNS: { value: SortableColumn; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "createdAt", label: "Registered" },
  { value: "enrolledTestsCount", label: "Enrolled tests" },
  { value: "totalSpent", label: "Total spent" },
];

const defaultSortOrder = (col: SortableColumn): "asc" | "desc" => {
  if (col === "name" || col === "email") return "asc";
  return "desc";
};

const formatCurrency = (amount: number): string => `₹${amount.toLocaleString("en-IN")}`;

const formatDate = (date: Date | null): string => {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colPhone} />
    <col className={styles.colEnrolled} />
    <col className={styles.colMoney} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const StudentRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "80%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "3.75rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const StudentCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

interface SortIconProps {
  column: SortableColumn;
  sortBy: SortableColumn;
  sortOrder: "asc" | "desc";
}

const SortIcon = ({ column, sortBy, sortOrder }: SortIconProps) => {
  if (sortBy !== column) {
    return <ArrowUpDown className={styles.sortIcon} aria-hidden="true" />;
  }
  if (sortOrder === "asc") {
    return <ArrowUp className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
  }
  return <ArrowDown className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
};

const AdminStudentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortableColumn>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusTarget, setStatusTarget] = useState<{ id: number; name: string; isActive: boolean } | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminStudentsQuery({
    page,
    search: debouncedSearchTerm,
    sortBy,
    sortOrder,
  });

  const toggleStatusMutation = useToggleUserStatusMutation();
  const impersonateMutation = useImpersonateMutation();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, sortOrder]);

  const handleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(defaultSortOrder(column));
    }
  };

  const confirmToggleStatus = () => {
    if (!statusTarget) return;
    toggleStatusMutation.mutate(
      { userId: statusTarget.id, isActive: !statusTarget.isActive },
      { onSuccess: () => setStatusTarget(null) }
    );
  };

  const renderSortableHeader = (column: SortableColumn, label: string, numeric = false) => {
    const isActive = sortBy === column;
    return (
      <th
        className={numeric ? styles.num : undefined}
        aria-sort={isActive ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" className={styles.sortButton} onClick={() => handleSort(column)}>
          {label}
          <SortIcon column={column} sortBy={sortBy} sortOrder={sortOrder} />
        </button>
      </th>
    );
  };

  const renderIdentity = (student: StudentAdminView) => (
    <span className={styles.primaryLine}>
      <span className={styles.truncate} title={student.fullName}>{student.fullName}</span>
      {!student.isActive && (
        <Badge variant="destructive" className={styles.flag}>Inactive</Badge>
      )}
    </span>
  );

  const renderActions = (student: StudentAdminView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`Log in as ${student.fullName}`}
            onClick={() => impersonateMutation.mutate({ userId: student.id })}
            disabled={impersonateMutation.isPending}
          >
            <LogIn />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Log in as</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${student.isActive ? styles.iconButtonDanger : ""}`}
            aria-label={`${student.isActive ? "Deactivate" : "Activate"} ${student.fullName}`}
            onClick={() => setStatusTarget({ id: student.id, name: student.fullName, isActive: student.isActive })}
            disabled={toggleStatusMutation.isPending}
          >
            {student.isActive ? <Ban /> : <UserCheck />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{student.isActive ? "Deactivate" : "Activate"}</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <StudentRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <StudentCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the students"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.students.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<UserX size={24} />}
          title={debouncedSearchTerm ? "No students match that search" : "No students yet"}
          description={
            debouncedSearchTerm
              ? `Nothing found for "${debouncedSearchTerm}". Try a different name or email.`
              : "Students who sign up will be listed here."
          }
        >
          {debouncedSearchTerm && (
            <Button variant="outline" onClick={() => setSearchTerm("")}>Clear search</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                {renderSortableHeader("name", "Student")}
                <th>Phone</th>
                {renderSortableHeader("enrolledTestsCount", "Enrolled", true)}
                {renderSortableHeader("totalSpent", "Spent", true)}
                {renderSortableHeader("createdAt", "Registered")}
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className={styles.stack}>
                      {renderIdentity(student)}
                      <span className={styles.secondaryLine} title={student.email}>{student.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={student.mobileNumber ? styles.valueLine : styles.emptyLine}>
                      {student.mobileNumber || "Not given"}
                    </span>
                  </td>
                  <td className={`${styles.num} ${student.enrolledTestsCount === 0 ? styles.zero : ""}`}>
                    {student.enrolledTestsCount}
                  </td>
                  <td
                    className={`${styles.num} ${student.totalSpent === 0 ? styles.zero : ""}`}
                    title={formatCurrency(student.totalSpent)}
                  >
                    {formatCurrency(student.totalSpent)}
                  </td>
                  <td className={styles.date}>{formatDate(student.createdAt)}</td>
                  <td>{renderActions(student)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.students.map((student) => (
            <article key={student.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  {renderIdentity(student)}
                  <span className={styles.secondaryLine} title={student.email}>{student.email}</span>
                </div>
                {renderActions(student)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Phone</dt>
                  <dd>{student.mobileNumber || "Not given"}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Enrolled</dt>
                  <dd className={student.enrolledTestsCount === 0 ? styles.zero : undefined}>
                    {student.enrolledTestsCount}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Spent</dt>
                  <dd className={student.totalSpent === 0 ? styles.zero : undefined}>
                    {formatCurrency(student.totalSpent)}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Registered</dt>
                  <dd>{formatDate(student.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Students - Testkart Admin</title>
        <meta name="description" content="Students on the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Students" />

        <ConsoleListToolbar
          tabs={data ? [{ value: "all", label: "All students", count: data.totalCount }] : undefined}
          value="all"
          tabsLabel="Students"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name or email",
            label: "Search students",
          }}
        >
          <Select
            value={sortBy}
            onValueChange={(val) => {
              const col = val as SortableColumn;
              setSortBy(col);
              setSortOrder(defaultSortOrder(col));
            }}
          >
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort students by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORTABLE_COLUMNS.map((col) => (
                <SelectItem key={col.value} value={col.value}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-lg"
            className={`${styles.iconButton} ${styles.sortDirection}`}
            aria-label={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
          >
            {sortOrder === "asc" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </ConsoleListToolbar>

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConsoleConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        tone={statusTarget?.isActive ? "destructive" : "default"}
        title={statusTarget?.isActive ? "Deactivate this student?" : "Activate this student?"}
        description={
          statusTarget?.isActive
            ? `${statusTarget.name} will not be able to sign in. Their purchases and results are kept.`
            : `${statusTarget?.name} will be able to sign in again.`
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        pendingLabel={statusTarget?.isActive ? "Deactivating..." : "Activating..."}
        isPending={toggleStatusMutation.isPending}
        onConfirm={confirmToggleStatus}
      />
    </>
  );
};

export default AdminStudentsPage;
