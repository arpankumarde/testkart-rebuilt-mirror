import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { AlertCircle, CalendarClock, CalendarCog, RotateCcw } from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Dialog } from "../components/Dialog";
import {
  ConsoleDialogBody,
  ConsoleDialogContent,
  ConsoleDialogFooter,
  ConsoleDialogHeader,
} from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ExpiryDateField } from "../components/ExpiryDateField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  useAdminContentExpiryList,
  useAdminRelistContent,
  useAdminUpdateContentExpiry,
} from "../helpers/useAdminContentExpiry";
import {
  EXPIRY_HELP,
  formatExpiryDay,
  formatExpiryMoment,
  LISTING_STATUS_META,
} from "../helpers/contentExpiry";
import type { ContentType } from "../helpers/schema";
import type {
  AdminExpiryItem,
  ExpiryFilter,
} from "../endpoints/admin/content-expiry/list_GET.schema";
import styles from "./admin.product-expiry.module.css";

const TYPE_LABELS: Record<ContentType, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study note",
  live_test: "Live test",
  course_bundle: "Bundle",
};

type TypeFilter = ContentType | "all";

const itemKey = (item: AdminExpiryItem) => `${item.contentType}:${item.id}`;

/* Expired is the system's doing; Unlisted is the teacher's. The second line says which. */
const StatusCell: React.FC<{ item: AdminExpiryItem }> = ({ item }) => {
  const meta = LISTING_STATUS_META[item.status];
  const origin =
    item.status === "expired"
      ? "Unlisted automatically"
      : item.status === "unlisted"
        ? "Unlisted by teacher"
        : item.status === "draft"
          ? "Not published"
          : "Listed";
  return (
    <div className={styles.stack}>
      <Badge variant={meta.variant} className={styles.flag} title={meta.hint}>
        {meta.label}
      </Badge>
      <span className={styles.secondaryLine}>{origin}</span>
    </div>
  );
};

const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
    <col className={styles.colMoment} />
    <col className={styles.colActions} />
  </colgroup>
);

const AdminProductExpiryPage: React.FC = () => {
  const [filter, setFilter] = useState<ExpiryFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminExpiryItem | null>(null);
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [relisting, setRelisting] = useState<AdminExpiryItem | null>(null);

  const { data, isFetching, isError, error, refetch } = useAdminContentExpiryList({ filter, type, search, page });
  const update = useAdminUpdateContentExpiry();
  const relist = useAdminRelistContent();

  useEffect(() => {
    setPage(1);
  }, [filter, type, search]);

  const openEdit = (item: AdminExpiryItem) => {
    setDraftDay(item.expiryDay);
    setEditing(item);
  };

  const saveEdit = () => {
    if (!editing) return;
    update.mutate(
      { contentType: editing.contentType, contentId: editing.id, expiryDay: draftDay },
      { onSuccess: () => setEditing(null) }
    );
  };

  const renderActions = (item: AdminExpiryItem) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`Change the expiry date of ${item.title}`}
            onClick={() => openEdit(item)}
          >
            <CalendarCog />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Change expiry date</TooltipContent>
      </Tooltip>
      {item.status === "expired" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={styles.tooltipAnchor}>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.iconButton}
                aria-label={`Relist ${item.title}`}
                disabled={!item.canRelist}
                onClick={() => setRelisting(item)}
              >
                <RotateCcw />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {item.canRelist ? "Relist" : "Set a future date or remove it to relist"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const identity = (item: AdminExpiryItem) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine} title={item.title}>
        {item.title}
      </span>
      <span className={styles.secondaryLine}>
        {TYPE_LABELS[item.contentType]} - {item.teacherName ?? "Unknown teacher"}
      </span>
    </div>
  );

  const expiryText = (item: AdminExpiryItem) => (item.expiryDay ? formatExpiryDay(item.expiryDay) : "Removed");
  const momentText = (item: AdminExpiryItem) => (item.expiredAt ? formatExpiryMoment(new Date(item.expiredAt)) : "Not yet");

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.cardsContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "6rem", width: "100%" }} />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load product expiry"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.items.length === 0) {
      const narrowed = search || type !== "all" || filter !== "all";
      return (
        <ConsoleListEmpty
          icon={<CalendarClock size={24} />}
          title={narrowed ? "Nothing matches these filters" : "No products have an expiry date"}
          description={
            narrowed
              ? "Try another status, type or search."
              : "Products show here once a teacher or admin sets an expiry date."
          }
        >
          {narrowed && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setType("all");
                setFilter("all");
              }}
            >
              Clear filters
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
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Last day on sale</th>
                <th>Unlisted at</th>
                <th>
                  <span className={styles.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={itemKey(item)}>
                  <td>{identity(item)}</td>
                  <td>
                    <StatusCell item={item} />
                  </td>
                  <td className={item.expiryDay ? styles.date : styles.emptyLine}>{expiryText(item)}</td>
                  <td className={item.expiredAt ? styles.date : styles.emptyLine}>{momentText(item)}</td>
                  <td>{renderActions(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.items.map((item) => (
            <article key={itemKey(item)} className={styles.card}>
              <div className={styles.cardHeader}>
                {identity(item)}
                {renderActions(item)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Status</dt>
                  <dd>
                    <StatusCell item={item} />
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Last day on sale</dt>
                  <dd>{expiryText(item)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Unlisted at</dt>
                  <dd>{momentText(item)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  const counts = data?.counts;
  const typeOptions = (data?.types ?? []).map((value) => ({ value, label: TYPE_LABELS[value] }));

  return (
    <>
      <Helmet>
        <title>Product expiry - Testkart Admin</title>
        <meta name="description" content="Teacher products with an expiry date." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Product expiry" />

        <ConsoleListToolbar
          tabs={[
            { value: "all", label: "All", count: counts?.all },
            { value: "active", label: "Active", count: counts?.active },
            { value: "expiring_soon", label: "Expiring soon", count: counts?.expiring_soon },
            { value: "expired", label: "Expired", count: counts?.expired },
          ]}
          value={filter}
          onValueChange={(value) => setFilter(value as ExpiryFilter)}
          tabsLabel="Expiry status"
          panelId="product-expiry-results"
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by product or teacher",
            label: "Search products with an expiry date",
          }}
        >
          <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Product type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        <div id="product-expiry-results" role="tabpanel" className={styles.results}>
          {renderContent()}
        </div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setEditing(null);
        }}
      >
        <ConsoleDialogContent size="sm">
          <ConsoleDialogHeader
            icon={<CalendarCog size={20} />}
            title="Change expiry date"
            description={editing ? `${TYPE_LABELS[editing.contentType]}: ${editing.title}` : undefined}
          />
          <ConsoleDialogBody className={styles.dialogBody}>
            <ExpiryDateField value={draftDay} onChange={setDraftDay} disabled={update.isPending} />
            <p className={styles.dialogHelp}>
              {EXPIRY_HELP} The last day picked stays on sale until 23:59 IST.
              {editing?.status === "expired" ? " A new date does not relist it; use Relist afterwards." : ""}
            </p>
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={update.isPending || draftDay === editing?.expiryDay}>
              {update.isPending ? "Saving..." : "Save expiry date"}
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={relisting !== null}
        onOpenChange={(open) => {
          if (!open && !relist.isPending) setRelisting(null);
        }}
        icon={<RotateCcw size={20} />}
        title="Relist this product?"
        description={
          relisting
            ? `"${relisting.title}" goes back on sale as ${relisting.relistVisibility === "public" ? "public and listed" : "unlisted"}${relisting.expiryDay ? `, until the end of ${formatExpiryDay(relisting.expiryDay)}` : ""}.`
            : undefined
        }
        confirmLabel="Relist"
        pendingLabel="Relisting..."
        isPending={relist.isPending}
        onConfirm={() => {
          if (!relisting) return;
          relist.mutate(
            { contentType: relisting.contentType, contentId: relisting.id },
            { onSettled: () => setRelisting(null) }
          );
        }}
      />
    </>
  );
};

export default AdminProductExpiryPage;