import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useAdminDeletedAccountsQuery } from "../helpers/useAdminDeletedAccounts";
import { useDebounce } from "../helpers/useDebounce";
import { SortOrder } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { UserX, AlertCircle } from "lucide-react";
import { DeletedAccountView, DeletedAccountSortBy } from "../endpoints/admin/deleted-accounts/list_GET.schema";
import styles from "./admin.deleted-accounts.module.css";

const TEXT_SORTS: ReadonlyArray<DeletedAccountSortBy> = ["displayName", "role"];

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getRoleVariant = (role: string) => {
  switch (role) {
    case "teacher":
      return "default";
    case "student":
      return "secondary";
    default:
      return "outline";
  }
};

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const renderRole = (account: DeletedAccountView) => (
  <Badge variant={getRoleVariant(account.role)} className={styles.flag}>
    {sentenceCase(account.role)}
  </Badge>
);

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colPhone} />
    <col className={styles.colRole} />
    <col className={styles.colReason} />
    <col className={styles.colDate} />
    <col className={styles.colDate} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const AccountRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="60%" bottom="80%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "75%" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
  </tr>
);

const AccountCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "1.125rem", width: "3.5rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const AdminDeletedAccountsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [sortBy, setSortBy] = useState<DeletedAccountSortBy | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const sort = {
    sortBy,
    sortOrder,
    toggleSort: (column: DeletedAccountSortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder(TEXT_SORTS.includes(column) ? "asc" : "desc");
      }
      setPage(1);
    },
  };

  const { data, isFetching, isError, error, refetch } = useAdminDeletedAccountsQuery({
    page,
    search: debouncedSearchTerm,
    sortBy: sortBy ?? undefined,
    sortOrder: sortBy ? sortOrder : undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <AccountRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <AccountCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the deleted accounts"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.accounts.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<UserX size={24} />}
          title={debouncedSearchTerm ? "No accounts match that search" : "No deleted accounts"}
          description={
            debouncedSearchTerm
              ? `Nothing found for "${debouncedSearchTerm}". Try a different name or email.`
              : "Accounts closed by their owner are recorded here."
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
                <SortableTh column="displayName" sort={sort}>Account</SortableTh>
                <th>Phone</th>
                <SortableTh column="role" sort={sort}>Role</SortableTh>
                <th>Reason</th>
                <SortableTh column="registeredAt" sort={sort}>Registered</SortableTh>
                <SortableTh column="deletedAt" sort={sort}>Deleted</SortableTh>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine} title={account.displayName}>{account.displayName}</span>
                      <span className={styles.secondaryLine} title={account.email || undefined}>
                        {account.email || "Not given"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={account.mobileNumber ? styles.valueLine : styles.emptyLine}>
                      {account.mobileNumber || "Not given"}
                    </span>
                  </td>
                  <td>{renderRole(account)}</td>
                  <td>
                    <span
                      className={account.reason ? styles.truncate : styles.emptyLine}
                      title={account.reason || undefined}
                    >
                      {account.reason || "Not given"}
                    </span>
                  </td>
                  <td className={styles.date}>{formatDate(account.registeredAt)}</td>
                  <td className={styles.date}>{formatDate(account.deletedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.accounts.map((account) => (
            <article key={account.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.primaryLine} title={account.displayName}>{account.displayName}</span>
                  <span className={styles.secondaryLine} title={account.email || undefined}>
                    {account.email || "No email"}
                  </span>
                </div>
                {renderRole(account)}
              </div>
              <p className={styles.cardReason}>Reason: {account.reason || "Not given"}</p>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Phone</dt>
                  <dd>{account.mobileNumber || "Not given"}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Registered</dt>
                  <dd>{formatDate(account.registeredAt)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Deleted</dt>
                  <dd>{formatDate(account.deletedAt)}</dd>
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
        <title>Deleted accounts - Testkart Admin</title>
        <meta name="description" content="Accounts closed on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Deleted accounts" />

        <ConsoleListToolbar
          tabs={data ? [{ value: "all", label: "All accounts", count: data.totalCount }] : undefined}
          value="all"
          tabsLabel="Deleted accounts"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name or email",
            label: "Search deleted accounts",
          }}
        />

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </>
  );
};

export default AdminDeletedAccountsPage;
