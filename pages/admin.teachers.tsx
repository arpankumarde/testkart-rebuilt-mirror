import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useAdminTeachersQuery } from "../helpers/useAdminTeachers";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/DropdownMenu";
import {
  UserX,
  LogIn,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BadgeCheck,
  ShieldOff,
  Eye,
  AlertCircle,
  MoreHorizontal,
  Ban,
  UserCheck,
  Lock,
  LockOpen,
  ShieldCheck,
} from "lucide-react";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useAdminToggleVerifiedMutation } from "../helpers/useAdminToggleVerified";
import { useAdminToggleTeacherDrmMutation } from "../helpers/useAdminToggleTeacherDrm";
import { TeacherProfileDialog } from "../components/TeacherProfileDialog";
import { TeacherAdminView } from "../endpoints/admin/teachers/list_GET.schema";
import styles from "./admin.teachers.module.css";

type SortableColumn = "name" | "email" | "createdAt" | "testsCount" | "bundlesCount" | "coursesCount" | "liveTestsCount" | "productsCount" | "totalEarnings";

const SORTABLE_COLUMNS: { value: SortableColumn; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "createdAt", label: "Registered" },
  { value: "testsCount", label: "Tests" },
  { value: "bundlesCount", label: "Bundles" },
  { value: "coursesCount", label: "Courses" },
  { value: "liveTestsCount", label: "Live tests" },
  { value: "productsCount", label: "Notes" },
  { value: "totalEarnings", label: "Earnings" },
];

const COUNT_FIELDS = [
  { key: "testsCount", label: "Tests" },
  { key: "bundlesCount", label: "Bundles" },
  { key: "coursesCount", label: "Courses" },
  { key: "liveTestsCount", label: "Live tests" },
  { key: "productsCount", label: "Notes" },
] as const;

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
    <col className={styles.colContact} />
    <col className={styles.colCount} />
    <col className={styles.colCountWide} />
    <col className={styles.colCountWide} />
    <col className={styles.colLiveTests} />
    <col className={styles.colCount} />
    <col className={styles.colMoney} />
    <col className={styles.colDate} />
    <col className={styles.colDrm} />
    <col className={styles.colActions} />
  </colgroup>
);

const TeacherRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "80%" }} />
      </div>
    </td>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "75%" }} />
        <Skeleton style={{ height: "0.75rem", width: "55%" }} />
      </div>
    </td>
    {COUNT_FIELDS.map((field) => (
      <td key={field.key}>
        <Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} />
      </td>
    ))}
    <td>
      <Skeleton style={{ height: "0.875rem", width: "4rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td />
    <td>
      <Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const TeacherCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
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

/* Icon-only in the table's DRM column; cards have no column header, so there it carries a label. */
const DrmBadge = ({ withLabel = false }: { withLabel?: boolean }) => (
  <Badge
    variant="success"
    className={withLabel ? `${styles.flag} ${styles.drmFlag}` : styles.drmBadge}
    title="DRM is on for this teacher"
    role={withLabel ? undefined : "img"}
    aria-label={withLabel ? undefined : "DRM on"}
  >
    <ShieldCheck aria-hidden="true" />
    {withLabel && "DRM"}
  </Badge>
);

const SortIcon = ({ column, sortBy, sortOrder }: SortIconProps) => {
  if (sortBy !== column) {
    return <ArrowUpDown className={styles.sortIcon} aria-hidden="true" />;
  }
  if (sortOrder === "asc") {
    return <ArrowUp className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
  }
  return <ArrowDown className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
};

const AdminTeachersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || "");
  const [sortBy, setSortBy] = useState<SortableColumn>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherAdminView | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: number; name: string; isActive: boolean } | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<{ id: number; name: string; isVerified: boolean } | null>(null);
  const [drmTarget, setDrmTarget] = useState<{ id: number; name: string; drmEnabled: boolean } | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminTeachersQuery({
    page,
    search: debouncedSearchTerm,
    sortBy,
    sortOrder,
  });

  const toggleStatusMutation = useToggleUserStatusMutation();
  const toggleVerifiedMutation = useAdminToggleVerifiedMutation();
  const toggleDrmMutation = useAdminToggleTeacherDrmMutation();
  const impersonateMutation = useImpersonateMutation();

  useEffect(() => {
    if (searchParams.has('search')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const confirmToggleVerified = () => {
    if (!verifyTarget) return;
    toggleVerifiedMutation.mutate(
      { userId: verifyTarget.id, isVerified: !verifyTarget.isVerified },
      { onSuccess: () => setVerifyTarget(null) }
    );
  };

  const confirmToggleDrm = () => {
    if (!drmTarget) return;
    toggleDrmMutation.mutate(
      { teacherId: drmTarget.id, drmEnabled: !drmTarget.drmEnabled },
      { onSuccess: () => setDrmTarget(null) }
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

  const renderIdentity = (teacher: TeacherAdminView, withDrmFlag = false) => (
    <span className={styles.primaryLine}>
      <span className={styles.truncate} title={teacher.fullName}>{teacher.fullName}</span>
      <VerifiedBadge isVerified={teacher.isVerified} size="sm" className={styles.verified} />
      {withDrmFlag && teacher.drmEnabled && <DrmBadge withLabel />}
      {!teacher.isActive && (
        <Badge variant="destructive" className={styles.flag}>Inactive</Badge>
      )}
    </span>
  );

  const renderActions = (teacher: TeacherAdminView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View profile of ${teacher.fullName}`}
            onClick={() => setSelectedTeacher(teacher)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View profile</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`Log in as ${teacher.fullName}`}
            onClick={() => impersonateMutation.mutate({ userId: teacher.id })}
            disabled={impersonateMutation.isPending}
          >
            <LogIn />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Log in as</TooltipContent>
      </Tooltip>
      {/* Non-modal so the confirm dialog it opens does not inherit the menu's pointer lock. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`More actions for ${teacher.fullName}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className={styles.menuItem}
            disabled={toggleVerifiedMutation.isPending}
            onSelect={() => setVerifyTarget({ id: teacher.id, name: teacher.fullName, isVerified: teacher.isVerified })}
          >
            {teacher.isVerified ? (
              <><ShieldOff size={16} /> Remove verified mark</>
            ) : (
              <><BadgeCheck size={16} /> Mark verified</>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={styles.menuItem}
            disabled={toggleDrmMutation.isPending}
            onSelect={() => setDrmTarget({ id: teacher.id, name: teacher.fullName, drmEnabled: teacher.drmEnabled })}
          >
            {teacher.drmEnabled ? (
              <><LockOpen size={16} /> Turn off DRM</>
            ) : (
              <><Lock size={16} /> Turn on DRM</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={`${styles.menuItem} ${teacher.isActive ? styles.menuItemDanger : ""}`}
            disabled={toggleStatusMutation.isPending}
            onSelect={() => setStatusTarget({ id: teacher.id, name: teacher.fullName, isActive: teacher.isActive })}
          >
            {teacher.isActive ? (
              <><Ban size={16} /> Deactivate</>
            ) : (
              <><UserCheck size={16} /> Activate</>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
                {Array.from({ length: 10 }).map((_, i) => <TeacherRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <TeacherCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the teachers"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.teachers.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<UserX size={24} />}
          title={debouncedSearchTerm ? "No teachers match that search" : "No teachers yet"}
          description={
            debouncedSearchTerm
              ? `Nothing found for "${debouncedSearchTerm}". Try a different name or email.`
              : "Teachers who sign up will be listed here."
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
                {renderSortableHeader("name", "Teacher")}
                <th>Contact</th>
                {COUNT_FIELDS.map((field) => (
                  <th key={field.key} className={styles.num}>{field.label}</th>
                ))}
                {renderSortableHeader("totalEarnings", "Earnings", true)}
                {renderSortableHeader("createdAt", "Registered")}
                <th>DRM</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <div className={styles.stack}>
                      {renderIdentity(teacher)}
                      <span className={styles.secondaryLine} title={teacher.email}>{teacher.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={teacher.mobileNumber ? styles.valueLine : styles.emptyLine}>
                        {teacher.mobileNumber || "No phone"}
                      </span>
                      <span className={styles.secondaryLine} title={teacher.academyName || undefined}>
                        {teacher.academyName || "No academy"}
                      </span>
                    </div>
                  </td>
                  {COUNT_FIELDS.map((field) => (
                    <td key={field.key} className={`${styles.num} ${teacher[field.key] === 0 ? styles.zero : ""}`}>
                      {teacher[field.key]}
                    </td>
                  ))}
                  <td className={styles.num} title={formatCurrency(teacher.totalEarnings)}>
                    {formatCurrency(teacher.totalEarnings)}
                  </td>
                  <td className={styles.date}>{formatDate(teacher.createdAt)}</td>
                  <td>{teacher.drmEnabled && <DrmBadge />}</td>
                  <td>{renderActions(teacher)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.teachers.map((teacher) => {
            const contact = [teacher.mobileNumber, teacher.academyName].filter(Boolean).join(", ");
            return (
              <article key={teacher.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    {renderIdentity(teacher, true)}
                    <span className={styles.secondaryLine} title={teacher.email}>{teacher.email}</span>
                    <span className={styles.secondaryLine}>{contact || "No phone or academy"}</span>
                  </div>
                  {renderActions(teacher)}
                </div>
                <dl className={styles.cardStats}>
                  {COUNT_FIELDS.map((field) => (
                    <div key={field.key} className={styles.cardStat}>
                      <dt>{field.label}</dt>
                      <dd className={teacher[field.key] === 0 ? styles.zero : undefined}>{teacher[field.key]}</dd>
                    </div>
                  ))}
                  <div className={styles.cardStat}>
                    <dt>Earnings</dt>
                    <dd>{formatCurrency(teacher.totalEarnings)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Registered</dt>
                    <dd>{formatDate(teacher.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Teachers - Testkart Admin</title>
        <meta name="description" content="Teachers on the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Teachers" />

        <ConsoleListToolbar
          tabs={data ? [{ value: "all", label: "All teachers", count: data.totalCount }] : undefined}
          value="all"
          tabsLabel="Teachers"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name or email",
            label: "Search teachers",
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
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort teachers by">
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

      <TeacherProfileDialog
        teacher={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
      />

      <ConsoleConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        tone={statusTarget?.isActive ? "destructive" : "default"}
        title={statusTarget?.isActive ? "Deactivate this teacher?" : "Activate this teacher?"}
        description={
          statusTarget?.isActive
            ? `${statusTarget.name} will not be able to sign in, and their published content comes off the site.`
            : `${statusTarget?.name} will be able to sign in again, and their published content goes back on the site.`
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        pendingLabel={statusTarget?.isActive ? "Deactivating..." : "Activating..."}
        isPending={toggleStatusMutation.isPending}
        onConfirm={confirmToggleStatus}
      />

      <ConsoleConfirmDialog
        open={!!verifyTarget}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
        icon={verifyTarget?.isVerified ? <ShieldOff size={20} /> : <BadgeCheck size={20} />}
        title={verifyTarget?.isVerified ? "Remove the verified mark?" : "Mark this teacher verified?"}
        description={
          verifyTarget?.isVerified
            ? `The verified badge comes off ${verifyTarget.name}'s public profile and their listings.`
            : `${verifyTarget?.name} gets a verified badge on their public profile and their listings.`
        }
        confirmLabel={verifyTarget?.isVerified ? "Remove badge" : "Verify"}
        pendingLabel="Saving..."
        isPending={toggleVerifiedMutation.isPending}
        onConfirm={confirmToggleVerified}
      />

      <ConsoleConfirmDialog
        open={!!drmTarget}
        onOpenChange={(open) => !open && setDrmTarget(null)}
        icon={drmTarget?.drmEnabled ? <LockOpen size={20} /> : <Lock size={20} />}
        title={drmTarget?.drmEnabled ? "Turn off DRM for this teacher?" : "Turn on DRM for this teacher?"}
        description={
          drmTarget?.drmEnabled
            ? `${drmTarget.name}'s videos will no longer be marked for DRM protection.`
            : `${drmTarget?.name}'s videos will be marked for DRM protection. Nothing changes for students yet: protection starts when DRM playback is released.`
        }
        confirmLabel={drmTarget?.drmEnabled ? "Turn off" : "Turn on"}
        pendingLabel="Saving..."
        isPending={toggleDrmMutation.isPending}
        onConfirm={confirmToggleDrm}
      />
    </>
  );
};

export default AdminTeachersPage;
