import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useAdminContactSubmissionsQuery, useUpdateContactSubmissionStatusMutation } from '../helpers/useAdminContactSubmissions';
import { Selectable } from 'kysely';
import { ContactSubmissionStatus, ContactSubmissions } from '../helpers/schema';
import { SortOrder } from '../helpers/useTableSort';
import { SortableTh } from '../components/SortableTh';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Dialog } from '../components/Dialog';
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from '../components/ConsoleDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListToolbar } from '../components/ConsoleListToolbar';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { ConsoleListPagination } from '../components/ConsoleListPagination';
import { AlertCircle, Inbox } from "lucide-react";
import styles from "./admin.contact-submissions.module.css";

const STATUS_MAP: Record<ContactSubmissionStatus, {label: string;variant: 'destructive' | 'warning' | 'success' | 'secondary';}> = {
  new: { label: "New", variant: "destructive" },
  read: { label: "Read", variant: "warning" },
  responded: { label: "Responded", variant: "success" },
  archived: { label: "Archived", variant: "secondary" }
};

const STATUS_OPTIONS: ContactSubmissionStatus[] = ["new", "read", "responded", "archived"];

type SubmissionSortBy = "name" | "status" | "createdAt";
const TEXT_SORTS: ReadonlyArray<SubmissionSortBy> = ["name", "status"];

const STATUS_TABS = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_MAP[s].label }))
];

type Submission = Selectable<ContactSubmissions>;

const formatDate = (date: Date | string | null): string => {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatTime = (date: Date | string | null): string => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatReceived = (date: Date | string | null): string =>
  [formatDate(date), formatTime(date)].filter(Boolean).join(", ");

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colSender} />
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const SubmissionRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="60%" bottom="85%" /></td>
    <td><StackSkeleton top="40%" bottom="90%" /></td>
    <td><Skeleton style={{ height: "1.75rem", width: "100%" }} /></td>
    <td><StackSkeleton top="85%" bottom="55%" /></td>
  </tr>
);

const SubmissionCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "1.75rem", width: "6.5rem", flexShrink: 0 }} />
    </div>
    <StackSkeleton top="50%" bottom="90%" />
  </div>
);

const SubmissionDetailsDialog: React.FC<{
  submission: Submission | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ submission, isOpen, onClose }) => {
  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title={`Message from ${submission.name}`}
          description={submission.subject || "No subject"}
        />
        <ConsoleDialogBody>
          <dl className={styles.details}>
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Email</dt>
              <dd className={styles.detailValue}>{submission.email}</dd>
            </div>
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Received</dt>
              <dd className={`${styles.detailValue} ${styles.figure}`}>
                {new Date(submission.createdAt!).toLocaleString()}
              </dd>
            </div>
            <div className={`${styles.detailItem} ${styles.detailItemWide}`}>
              <dt className={styles.detailLabel}>Message</dt>
              <dd className={styles.message}>{submission.message}</dd>
            </div>
          </dl>
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>);

};

const AdminContactSubmissions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const status = (searchParams.get("status") || "all") as ContactSubmissionStatus | "all";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;
  const [sortBy, setSortBy] = useState<SubmissionSortBy | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data, isFetching, error, refetch } = useAdminContactSubmissionsQuery({
    status: status === "all" ? null : (status as ContactSubmissionStatus),
    sortBy,
    sortOrder: sortBy ? sortOrder : null,
    limit,
    offset
  });
  const updateStatusMutation = useUpdateContactSubmissionStatusMutation();

  const handleStatusChange = (newStatus: string | null) => {
    setSearchParams((prev) => {
      if (newStatus && newStatus !== "all") {
        prev.set("status", newStatus);
      } else {
        prev.delete("status");
      }
      prev.set("page", "1");
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      prev.set("page", newPage.toString());
      return prev;
    });
  };

  const sort = {
    sortBy,
    sortOrder,
    toggleSort: (column: SubmissionSortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder(TEXT_SORTS.includes(column) ? "asc" : "desc");
      }
      handlePageChange(1);
    },
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const renderStatusSelect = (submission: Submission) => (
    <Select
      value={submission.status!}
      onValueChange={(newStatus: ContactSubmissionStatus) => {
        updateStatusMutation.mutate({ id: submission.id, status: newStatus });
      }}
      disabled={updateStatusMutation.isPending}>

      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        className={styles.statusTrigger}
        aria-label={`Status of the message from ${submission.name}`}>

        <SelectValue>
          <Badge variant={STATUS_MAP[submission.status!].variant} className={styles.flag}>
            {STATUS_MAP[submission.status!].label}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) =>
        <SelectItem key={s} value={s}>
            {STATUS_MAP[s].label}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );

  const renderSender = (submission: Submission) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine} title={submission.name}>{submission.name}</span>
      <span className={styles.secondaryLine} title={submission.email}>{submission.email}</span>
    </div>
  );

  const renderMessage = (submission: Submission) => (
    <div className={styles.stack}>
      <span
        className={submission.subject ? styles.primaryLine : styles.emptyLine}
        title={submission.subject || undefined}>

        {submission.subject || "No subject"}
      </span>
      <span className={styles.secondaryLine} title={submission.message}>{submission.message}</span>
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer} aria-busy="true">
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <SubmissionRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer} aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => <SubmissionCardSkeleton key={i} />)}
          </div>
        </>);

    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the submissions"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>);

    }

    if (!data || data.submissions.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Inbox size={24} />}
          title={status === "all" ? "No messages yet" : `No ${STATUS_MAP[status].label.toLowerCase()} messages`}
          description={
            status === "all"
              ? "Messages sent through the site's contact form arrive here."
              : "Nothing sitting at this status right now."
          }
        >
          {status !== "all" && (
            <Button variant="outline" onClick={() => handleStatusChange("all")}>Show all messages</Button>
          )}
        </ConsoleListEmpty>);

    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="name" sort={sort}>Sender</SortableTh>
                <th>Message</th>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Received</SortableTh>
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((submission) =>
              <tr key={submission.id} className={styles.clickable} onClick={() => setSelectedSubmission(submission)}>
                  <td>{renderSender(submission)}</td>
                  <td>{renderMessage(submission)}</td>
                  <td>{renderStatusSelect(submission)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatDate(submission.createdAt)}</span>
                      <span className={styles.secondaryLine}>{formatTime(submission.createdAt)}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.submissions.map((submission) =>
          <article
            key={submission.id}
            className={`${styles.card} ${styles.clickable}`}
            onClick={() => setSelectedSubmission(submission)}>

              <div className={styles.cardHeader}>
                {renderSender(submission)}
                {renderStatusSelect(submission)}
              </div>
              <div className={styles.cardBody}>{renderMessage(submission)}</div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Received</dt>
                  <dd>{formatReceived(submission.createdAt)}</dd>
                </div>
              </dl>
            </article>
          )}
        </div>
      </>);

  };

  return (
    <>
      <Helmet>
        <title>Contact submissions - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Contact submissions" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={status}
          onValueChange={handleStatusChange}
          tabsLabel="Submission status"
        />

        <div className={styles.results}>{renderContent()}</div>

        {!isFetching && !error && data && data.submissions.length > 0 && totalPages > 1 &&
        <ConsoleListPagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
        }
      </div>
      <SubmissionDetailsDialog
        submission={selectedSubmission}
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)} />

    </>);

};

export default AdminContactSubmissions;
