import React, { useState, useMemo, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useAdminCoursesQuery, useDeactivateCourseMutation } from "../helpers/useAdminCourses";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import {
  CheckCircle2,
  Archive,
  BookCopy,
  AlertTriangle,
  ArchiveRestore,
  Users,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { CourseStatus } from "../helpers/schema";
import { AdminCourseListItem } from "../endpoints/admin/courses/list_GET.schema";
import { AdminProductDetailPanel } from "../components/AdminProductDetailPanel";
import { adminPreviewPath } from "../helpers/useAdminContentPreview";
import styles from "./admin.courses.module.css";

const ALL_TEACHERS = "__all__";

const STATUS_TABS = ["all", "published", "draft", "archived"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

/* Dashboard-only subsets: no control of their own, so a notice names them. */
const LIST_FILTERS = ["no-lessons"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const SORT_ACCESSORS: SortAccessors<AdminCourseListItem, "title" | "status" | "students" | "price" | "createdAt"> = {
  title: (c) => c.title,
  status: (c) => c.status,
  students: (c) => c.studentsEnrolled,
  price: (c) => c.price,
  createdAt: (c) => (c.createdAt ? new Date(c.createdAt) : null),
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colStudents} />
    <col className={styles.colMoney} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const CourseRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "30%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "1.125rem", width: "4.25rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const CourseCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4.25rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const AdminCoursesPage: React.FC = () => {
  const { data: courses, isFetching, isError, error, refetch } = useAdminCoursesQuery();
  const deactivateMutation = useDeactivateCourseMutation();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<{ id: number; title: string } | null>(null);
  const [panelCourse, setPanelCourse] = useState<AdminCourseListItem | null>(null);

  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusTab>("status", STATUS_TABS, "all");
  const listFilter = read<ListFilter | "">("filter", LIST_FILTERS, "");
  const focusId = readId();

  const [searchQuery, setSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState(ALL_TEACHERS);

  const focusedCourse = useMemo(
    () => (focusId === null ? null : courses?.find((c) => c.id === focusId) ?? null),
    [courses, focusId]
  );

  /* A link to one course opens its panel once; a refetch after the admin closes it must not reopen it. */
  const openedFocusId = useRef<number | null>(null);
  useEffect(() => {
    if (!focusedCourse || openedFocusId.current === focusedCourse.id) return;
    openedFocusId.current = focusedCourse.id;
    setPanelCourse(focusedCourse);
  }, [focusedCourse]);

  useRefetchOnLinkArrival(listFilter !== "" || focusId !== null, isFetching, refetch);

  const teachers = useMemo(() => {
    if (!courses) return [];
    return Array.from(new Set(courses.map((c) => c.teacherName))).sort();
  }, [courses]);

  const statusTabs = useMemo(() => {
    const all = courses ?? [];
    return [
      { value: "all", label: "All", count: all.length },
      { value: "published", label: "Published", count: all.filter((c) => c.status === "published").length },
      { value: "draft", label: "Draft", count: all.filter((c) => c.status === "draft").length },
      { value: "archived", label: "Archived", count: all.filter((c) => c.status === "archived").length },
    ];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    return courses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || course.status === statusFilter;
      const matchesTeacher = teacherFilter === ALL_TEACHERS || course.teacherName === teacherFilter;
      const matchesListFilter = listFilter !== "no-lessons" || course.lessonsCount === 0;
      const matchesFocus = focusId === null || course.id === focusId;
      return matchesSearch && matchesStatus && matchesTeacher && matchesListFilter && matchesFocus;
    });
  }, [courses, searchQuery, statusFilter, teacherFilter, listFilter, focusId]);

  const { sorted: sortedCourses, ...sort } = useTableSort(filteredCourses, SORT_ACCESSORS);

  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    teacherFilter !== ALL_TEACHERS ||
    listFilter !== "" ||
    focusId !== null;

  const clearFilters = () => {
    setSearchQuery("");
    setTeacherFilter(ALL_TEACHERS);
    write({ status: null, filter: null, id: null });
  };

  const formatNumber = (num: number): string => num.toLocaleString('en-IN');
  const formatCurrency = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const getCourseUrl = (slug: string): string => `/course/${slug}`;

  const handleDeactivateClick = (courseId: number, courseTitle: string) => {
    setSelectedCourse({ id: courseId, title: courseTitle });
    setIsDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedCourse) return;

    try {
      await deactivateMutation.mutateAsync({ courseId: selectedCourse.id });
      toast.success(`"${selectedCourse.title}" is now archived.`);
      setIsDeactivateDialogOpen(false);
      setSelectedCourse(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not archive the course.";
      toast.error(errorMessage);
    }
  };

  /* The list uses the compact form without the icon; the detail panel keeps the full badge. */
  const getStatusBadge = (status: CourseStatus, compact = false) => {
    const className = compact ? styles.flag : undefined;
    switch (status) {
      case 'published':
        return (
          <Badge variant="success" className={className}>
            {!compact && <CheckCircle2 size={14} />}
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className={className}>
            {!compact && <ArchiveRestore size={14} />}
            Draft
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="destructive" className={className}>
            {!compact && <Archive size={14} />}
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline" className={className}>{status}</Badge>;
    }
  };

  const renderTitle = (course: AdminCourseListItem) => (
    <a
      href={course.status === 'published' ? getCourseUrl(course.slug) : adminPreviewPath("course", course.id)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.titleLink} ${styles.truncate}`}
      title={course.title}
    >
      {course.title}
    </a>
  );

  const renderActions = (course: AdminCourseListItem) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details for ${course.title}`}
            onClick={() => setPanelCourse(course)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      {course.status === 'published' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Archive ${course.title}`}
              onClick={() => handleDeactivateClick(course.id, course.title)}
              disabled={deactivateMutation.isPending && deactivateMutation.variables?.courseId === course.id}
            >
              <Archive />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
      )}
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
                {Array.from({ length: 8 }).map((_, i) => <CourseRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CourseCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the courses"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (filteredCourses.length === 0) {
      const description =
        focusId !== null && !focusedCourse
          ? "The linked course is no longer in the list. It may have been deleted."
          : listFilter === "no-lessons"
            ? "Every course that matches these filters has at least one lesson."
            : hasActiveFilters
              ? "Nothing here for this status, teacher and search. Widen the filters to see the rest."
              : "Courses teachers create will be listed here.";
      return (
        <ConsoleListEmpty
          icon={<BookCopy size={24} />}
          title={hasActiveFilters ? "No courses match these filters" : "No courses yet"}
          description={description}
        >
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Show all courses</Button>
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
                <SortableTh column="title" sort={sort}>Course</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="students" sort={sort} className={styles.num}>Students</SortableTh>
                <SortableTh column="price" sort={sort} className={styles.num}>Price</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Created</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedCourses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine}>{renderTitle(course)}</span>
                      <span className={styles.secondaryLine} title={course.teacherName}>{course.teacherName}</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(course.status, true)}</td>
                  <td className={`${styles.num} ${course.studentsEnrolled === 0 ? styles.zero : ""}`}>
                    {formatNumber(course.studentsEnrolled)}
                  </td>
                  <td className={styles.num} title={formatCurrency(course.price)}>
                    {formatCurrency(course.price)}
                  </td>
                  <td className={styles.date}>{formatDate(course.createdAt)}</td>
                  <td>{renderActions(course)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedCourses.map((course) => (
            <article key={course.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.primaryLine}>
                    {renderTitle(course)}
                    {getStatusBadge(course.status, true)}
                  </span>
                  <span className={styles.secondaryLine} title={course.teacherName}>{course.teacherName}</span>
                </div>
                {renderActions(course)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Students</dt>
                  <dd className={course.studentsEnrolled === 0 ? styles.zero : undefined}>
                    {formatNumber(course.studentsEnrolled)}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Price</dt>
                  <dd>{formatCurrency(course.price)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Created</dt>
                  <dd>{formatDate(course.createdAt)}</dd>
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
        <title>Courses - Testkart Admin</title>
        <meta name="description" content="Courses across the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Courses" />

        <ConsoleListToolbar
          tabs={statusTabs}
          value={statusFilter}
          onValueChange={(value) => write({ status: value === "all" ? null : value })}
          tabsLabel="Course status"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by title",
            label: "Search courses",
          }}
        >
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className={consoleToolbarControlClass}>
              <SelectValue placeholder="All teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEACHERS}>All teachers</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher} value={teacher}>{teacher}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {listFilter === "no-lessons" && (
          <ConsoleFilterNotice
            label="Courses with no lessons"
            count={courses ? filteredCourses.length : undefined}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}
        {focusId !== null && (
          <ConsoleFilterNotice
            label={focusedCourse?.title ?? `Course #${focusId}`}
            count={courses ? filteredCourses.length : undefined}
            onClear={() => write({ id: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>{renderContent()}</div>

        <ConsoleConfirmDialog
          open={isDeactivateDialogOpen}
          onOpenChange={setIsDeactivateDialogOpen}
          title="Archive this course?"
          description={`"${selectedCourse?.title ?? ""}" comes off the site and students can no longer buy it. Anyone already enrolled keeps access.`}
          tone="destructive"
          icon={<Archive size={20} />}
          confirmLabel="Archive course"
          pendingLabel="Archiving..."
          isPending={deactivateMutation.isPending}
          onConfirm={handleDeactivateConfirm}
        />

        {panelCourse && (
          <AdminProductDetailPanel
            open={!!panelCourse}
            onOpenChange={(open) => { if (!open) setPanelCourse(null); }}
            title={panelCourse.title}
            productTypeLabel="Course"
            statusBadge={getStatusBadge(panelCourse.status)}
            isLive={panelCourse.status === 'published'}
            publicUrl={panelCourse.status === 'published' ? getCourseUrl(panelCourse.slug) : null}
            previewUrl={adminPreviewPath("course", panelCourse.id)}
            teacherName={panelCourse.teacherName}
            price={panelCourse.price}
            createdAt={panelCourse.createdAt}
            stats={[
              { label: "Lessons added", value: formatNumber(panelCourse.lessonsCount), icon: <BookCopy size={18} /> },
              { label: "Students enrolled", value: formatNumber(panelCourse.studentsEnrolled), icon: <Users size={18} /> },
            ]}
            onUnpublish={
              panelCourse.status === 'published'
                ? () => {
                    handleDeactivateClick(panelCourse.id, panelCourse.title);
                    setPanelCourse(null);
                  }
                : undefined
            }
            unpublishLabel="Archive"
            unpublishPendingLabel="Archiving..."
            isUnpublishing={deactivateMutation.isPending && deactivateMutation.variables?.courseId === panelCourse.id}
          />
        )}
      </div>
    </>
  );
};

export default AdminCoursesPage;
