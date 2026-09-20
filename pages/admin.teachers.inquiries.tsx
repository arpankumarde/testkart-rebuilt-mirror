import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useAdminInquiriesQuery } from "../helpers/useAdminInquiries";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { OutputType } from "../endpoints/admin/inquiries_GET.schema";
import { useTableSort, SortAccessors, TableSortState } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  Inbox,
  ChevronDown,
  MessageSquare,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { InquiryStatus, InquiryStatusArrayValues } from "../helpers/schema";
import styles from "./admin.teachers.inquiries.module.css";

type Inquiry = OutputType["inquiries"][0];

type InquirySortKey = "name" | "status" | "createdAt";

const SORT_ACCESSORS: SortAccessors<Inquiry, InquirySortKey> = {
  name: (i) => i.name,
  status: (i) => i.status,
  createdAt: (i) => (i.createdAt ? new Date(i.createdAt) : null),
};

const STATUS_TABS = [
  { value: "all", label: "All" },
  ...InquiryStatusArrayValues.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  })),
];

const formatDate = (date: Date | string | null): string => {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date: Date | string | null): string => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusVariant = (
  status: InquiryStatus
): "default" | "secondary" | "success" | "warning" => {
  switch (status) {
    case "pending":
      return "warning";
    case "contacted":
      return "secondary";
    case "resolved":
      return "success";
    case "archived":
      return "default";
    default:
      return "default";
  }
};

const renderStatus = (inquiry: Inquiry) => (
  <Badge variant={getStatusVariant(inquiry.status)} className={styles.flag}>
    {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
  </Badge>
);

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colContact} />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
    <col className={styles.colToggle} />
  </colgroup>
);

const TableHead = ({ sort }: { sort: TableSortState<InquirySortKey> }) => (
  <thead>
    <tr>
      <SortableTh column="name" sort={sort}>Name</SortableTh>
      <th>Contact</th>
      <SortableTh column="status" sort={sort}>Status</SortableTh>
      <SortableTh column="createdAt" sort={sort}>Received</SortableTh>
      <th><span className={styles.srOnly}>Details</span></th>
    </tr>
  </thead>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const InquiryRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="55%" bottom="80%" /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
    <td><StackSkeleton top="85%" bottom="55%" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const InquiryCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "2rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

/* No click handler of its own: the click reaches the row or card, which toggles. */
const DetailsToggle = ({ inquiry, isExpanded }: { inquiry: Inquiry; isExpanded: boolean }) => (
  <div className={styles.rowActions}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          className={styles.iconButton}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Hide" : "Show"} details for ${inquiry.name}`}
        >
          <ChevronDown className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isExpanded ? "Hide details" : "Show details"}</TooltipContent>
    </Tooltip>
  </div>
);

const InquiryDetails = ({ inquiry }: { inquiry: Inquiry }) => (
  <div className={styles.expandedContent}>
    {inquiry.message && (
      <div className={styles.detailSection}>
        <h4 className={styles.detailTitle}>
          <MessageSquare size={16} /> Message
        </h4>
        <p className={styles.detailText}>{inquiry.message}</p>
      </div>
    )}
    <div className={styles.detailSection}>
      <h4 className={styles.detailTitle}>
        <UserCheck size={16} /> Admin notes
      </h4>
      <p className={styles.detailText}>
        {inquiry.adminNotes || "No notes added yet."}
      </p>
    </div>
  </div>
);

const InquiryRow = ({ inquiry }: { inquiry: Inquiry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr
        className={styles.clickable}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td>
          <div className={styles.stack}>
            <span className={styles.primaryLine} title={inquiry.name}>{inquiry.name}</span>
            <span className={styles.secondaryLine} title={inquiry.email}>{inquiry.email}</span>
          </div>
        </td>
        <td>
          <div className={styles.stack}>
            <span className={styles.valueLine} title={inquiry.phone}>{inquiry.phone}</span>
            <span className={styles.secondaryLine} title={inquiry.instituteName || undefined}>
              {inquiry.instituteName || "Not given"}
            </span>
          </div>
        </td>
        <td>{renderStatus(inquiry)}</td>
        <td>
          <div className={styles.stack}>
            <span className={styles.valueLine}>{formatDate(inquiry.createdAt)}</span>
            <span className={styles.secondaryLine}>{formatTime(inquiry.createdAt)}</span>
          </div>
        </td>
        <td>
          <DetailsToggle inquiry={inquiry} isExpanded={isExpanded} />
        </td>
      </tr>
      {isExpanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={5}>
            <InquiryDetails inquiry={inquiry} />
          </td>
        </tr>
      )}
    </>
  );
};

const InquiryCard = ({ inquiry }: { inquiry: Inquiry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className={styles.cardHeader}>
        <div className={styles.stack}>
          <span className={styles.cardTitleLine}>
            <span className={styles.truncate} title={inquiry.name}>{inquiry.name}</span>
            {renderStatus(inquiry)}
          </span>
          <span className={styles.secondaryLine} title={inquiry.email}>{inquiry.email}</span>
        </div>
        <DetailsToggle inquiry={inquiry} isExpanded={isExpanded} />
      </div>
      <dl className={styles.cardStats}>
        <div className={styles.cardStat}>
          <dt>Phone</dt>
          <dd>{inquiry.phone}</dd>
        </div>
        <div className={styles.cardStat}>
          <dt>Institute</dt>
          <dd>{inquiry.instituteName || "Not given"}</dd>
        </div>
        <div className={styles.cardStat}>
          <dt>Received</dt>
          <dd>{formatDate(inquiry.createdAt)}, {formatTime(inquiry.createdAt)}</dd>
        </div>
      </dl>
      {isExpanded && <InquiryDetails inquiry={inquiry} />}
    </article>
  );
};

const AdminInquiriesPage: React.FC = () => {
  const { read, write } = useListUrlParams();
  const statusFilter = read<InquiryStatus | "all">("status", InquiryStatusArrayValues, "all");

  const { data, isFetching, isError, error, refetch } = useAdminInquiriesQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  useRefetchOnLinkArrival(statusFilter !== "all", isFetching, refetch);
  const { sorted: sortedInquiries, ...sort } = useTableSort(data?.inquiries, SORT_ACCESSORS);

  const renderBody = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <TableHead sort={sort} />
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <InquiryRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => (
              <InquiryCardSkeleton key={i} />
            ))}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the inquiries"
          description={
            error instanceof Error
              ? error.message
              : "The request did not come back. Check your connection and try again."
          }
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.inquiries.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Inbox size={24} />}
          title={statusFilter === "all" ? "No inquiries yet" : "Nothing at this status"}
          description={
            statusFilter === "all"
              ? "Teachers and institutes who ask about joining Testkart appear here."
              : "No inquiry is sitting at this status right now."
          }
        >
          {statusFilter !== "all" && (
            <Button variant="outline" onClick={() => write({ status: null })}>
              Show all inquiries
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <TableHead sort={sort} />
            <tbody>
              {sortedInquiries.map((inquiry) => (
                <InquiryRow key={inquiry.id} inquiry={inquiry} />
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedInquiries.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Teacher inquiries - Testkart Admin</title>
        <meta
          name="description"
          content="Inquiries from teachers and institutes on Testkart."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Teacher inquiries" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={statusFilter}
          onValueChange={(value) => write({ status: value === "all" ? null : value })}
          tabsLabel="Inquiry status"
        />

        <div className={styles.results}>{renderBody()}</div>
      </div>
    </>
  );
};

export default AdminInquiriesPage;
