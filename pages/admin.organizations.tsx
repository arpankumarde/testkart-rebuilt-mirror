import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Eye,
  EyeOff,
  ExternalLink,
  LogIn,
  MoreHorizontal,
  Star,
} from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/Avatar";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/DropdownMenu";
import { useAdminOrganizationsQuery, useSetOrganizationActiveMutation } from "../helpers/useAdminOrganizations";
import { useImpersonateMutation } from "../helpers/useImpersonation";
import { getOrganizationProfilePath } from "../helpers/organizationRoutes";
import { ADMIN_ORG_TYPE_LABELS as ORG_TYPE_LABELS, formatAdminDate } from "../helpers/adminOrganizationLabels";
import type { AdminOrganizationRow, AdminOrganizationSort } from "../endpoints/admin/organizations/list_GET.schema";
import { BulkOrganizationUpload } from "../components/BulkOrganizationUpload";
import styles from "./admin.organizations.module.css";

type TypeFilter = "all" | AdminOrganizationRow["orgType"];
type StatusFilter = "all" | "active" | "hidden";

const TYPE_TABS: TypeFilter[] = ["all", "coaching", "school", "college", "university", "other"];

const SORT_OPTIONS: { value: AdminOrganizationSort; label: string }[] = [
  { value: "createdAt", label: "Registered" },
  { value: "name", label: "Name" },
  { value: "teachersCount", label: "Teachers" },
  { value: "resourcesCount", label: "Resources" },
  { value: "followersCount", label: "Followers" },
  { value: "reviewsCount", label: "Reviews" },
];

const COUNT_FIELDS = [
  { key: "teachersCount", label: "Teachers" },
  { key: "resourcesCount", label: "Resources" },
  { key: "followersCount", label: "Followers" },
] as const;

const defaultSortOrder = (column: AdminOrganizationSort): "asc" | "desc" => (column === "name" ? "asc" : "desc");

const subtitle = (org: AdminOrganizationRow) => [org.location, org.phoneNumber].filter(Boolean).join(" · ");

const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colType} />
    <col className={styles.colOwner} />
    <col className={styles.colCount} />
    <col className={styles.colCountWide} />
    <col className={styles.colCountWide} />
    <col className={styles.colRating} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const RowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.identity}>
        <Skeleton style={{ width: "2rem", height: "2rem", borderRadius: "999px", flexShrink: 0 }} />
        <div className={styles.stack} style={{ flex: 1 }}>
          <Skeleton style={{ height: "0.875rem", width: "60%" }} />
          <Skeleton style={{ height: "0.75rem", width: "80%" }} />
        </div>
      </div>
    </td>
    <td><Skeleton style={{ height: "1.25rem", width: "4.5rem" }} /></td>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "70%" }} />
        <Skeleton style={{ height: "0.75rem", width: "85%" }} />
      </div>
    </td>
    {COUNT_FIELDS.map((field) => (
      <td key={field.key}><Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} /></td>
    ))}
    <td><Skeleton style={{ height: "0.875rem", width: "3rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const CardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.identity} style={{ flex: 1 }}>
        <Skeleton style={{ width: "2.25rem", height: "2.25rem", borderRadius: "999px", flexShrink: 0 }} />
        <div className={styles.stack} style={{ flex: 1 }}>
          <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
          <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
        </div>
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

const OrgLogo: React.FC<{ name: string; logoUrl: string | null; className?: string }> = ({ name, logoUrl, className }) => (
  <Avatar className={`${styles.logo} ${className ?? ""}`}>
    <AvatarImage src={logoUrl ?? undefined} alt="" />
    <AvatarFallback>{name.charAt(0).toUpperCase() || <Building2 size={14} />}</AvatarFallback>
  </Avatar>
);

const AdminOrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<AdminOrganizationSort>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibilityTarget, setVisibilityTarget] = useState<AdminOrganizationRow | null>(null);

  const { data, isPending, isFetching, isError, error, refetch } = useAdminOrganizationsQuery({
    page,
    search: searchTerm,
    orgType: typeFilter,
    status: statusFilter,
    sortBy,
    sortOrder,
  });
  const setActiveMutation = useSetOrganizationActiveMutation();
  const impersonateMutation = useImpersonateMutation();

  const handleBulkUploadSuccess = () => {
    refetch();
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, statusFilter, sortBy, sortOrder]);

  const handleSort = (column: AdminOrganizationSort) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(defaultSortOrder(column));
    }
  };

  const confirmVisibility = () => {
    if (!visibilityTarget) return;
    setActiveMutation.mutate(
      { organizationId: visibilityTarget.id, isActive: !visibilityTarget.isActive },
      { onSuccess: () => setVisibilityTarget(null) }
    );
  };

  const renderSortableHeader = (column: AdminOrganizationSort, label: string, numeric = false) => {
    const isActive = sortBy === column;
    const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        key={column}
        className={numeric ? styles.num : undefined}
        aria-sort={isActive ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" className={styles.sortButton} onClick={() => handleSort(column)}>
          {label}
          <Icon className={`${styles.sortIcon} ${isActive ? styles.sortIconActive : ""}`} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const renderIdentity = (org: AdminOrganizationRow) => (
    <div className={styles.identity}>
      <OrgLogo name={org.name} logoUrl={org.logoUrl} />
      <div className={styles.stack}>
        <span className={styles.primaryLine}>
          <span className={styles.truncate} title={org.name}>{org.name}</span>
          {!org.isActive && <Badge variant="warning" className={styles.flag}>Hidden</Badge>}
          {org.claimStatus !== "claimed" && <Badge variant="outline" className={styles.flag}>Unclaimed</Badge>}
        </span>
        <span className={styles.secondaryLine} title={subtitle(org) || undefined}>
          {subtitle(org) || "No location or phone"}
        </span>
      </div>
    </div>
  );

  const renderRating = (org: AdminOrganizationRow) =>
    org.reviewsCount > 0 && org.averageRating !== null ? (
      <span className={styles.rating}>
        <Star aria-hidden="true" />
        {org.averageRating.toFixed(1)}
        <span className={styles.ratingCount}>({org.reviewsCount})</span>
      </span>
    ) : (
      <span className={styles.zero}>None</span>
    );

  const renderActions = (org: AdminOrganizationRow) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details of ${org.name}`}
            onClick={() => navigate(`/admin/organizations/${org.id}`)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-md" className={styles.iconButton} asChild>
            <a
              href={getOrganizationProfilePath(org.orgType, org.slug)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open the public page of ${org.name}`}
            >
              <ExternalLink />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{org.isActive ? "Open public page" : "Open public page (hidden)"}</TooltipContent>
      </Tooltip>
      {/* Non-modal so the confirm dialog it opens does not inherit the menu's pointer lock. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-md" className={styles.iconButton} aria-label={`More actions for ${org.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {org.ownerId != null && (
            <>
              <DropdownMenuItem
                className={styles.menuItem}
                disabled={impersonateMutation.isPending}
                onSelect={() => impersonateMutation.mutate({ userId: org.ownerId as number })}
              >
                <LogIn size={16} /> Log in as owner
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className={`${styles.menuItem} ${org.isActive ? styles.menuItemDanger : ""}`}
            disabled={setActiveMutation.isPending}
            onSelect={() => setVisibilityTarget(org)}
          >
            {org.isActive ? (
              <><EyeOff size={16} /> Hide from site</>
            ) : (
              <><Eye size={16} /> Show on site</>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const renderContent = () => {
    if (isPending) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the organizations"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    const filtered = !!searchTerm || typeFilter !== "all" || statusFilter !== "all";
    if (!data || data.organizations.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Building2 size={24} />}
          title={filtered ? "No organizations match these filters" : "No organizations yet"}
          description={
            filtered
              ? "Try a different name, owner or filter."
              : "Institutes, schools and colleges that teachers create will be listed here."
          }
        >
          {filtered && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={isFetching ? styles.refreshing : undefined} aria-busy={isFetching}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                {renderSortableHeader("name", "Organization")}
                <th>Type</th>
                <th>Owner</th>
                {renderSortableHeader("teachersCount", "Teachers", true)}
                {renderSortableHeader("resourcesCount", "Resources", true)}
                {renderSortableHeader("followersCount", "Followers", true)}
                {renderSortableHeader("reviewsCount", "Rating", true)}
                {renderSortableHeader("createdAt", "Registered")}
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.organizations.map((org) => (
                <tr key={org.id}>
                  <td>{renderIdentity(org)}</td>
                  <td><Badge variant="outline" className={styles.typeBadge}>{ORG_TYPE_LABELS[org.orgType]}</Badge></td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine} title={org.ownerName ?? undefined}>
                        {org.ownerName ?? (org.claimStatus === "claimed" ? "Deleted teacher" : "Unclaimed")}
                      </span>
                      <span className={styles.secondaryLine} title={org.ownerEmail ?? undefined}>{org.ownerEmail ?? "No email"}</span>
                    </div>
                  </td>
                  <td className={styles.num}>
                    <div className={styles.stack}>
                      <span className={org.teachersCount === 0 ? styles.zero : undefined}>{org.teachersCount}</span>
                      {org.pendingCount > 0 && <span className={styles.pending}>{org.pendingCount} pending</span>}
                    </div>
                  </td>
                  <td className={`${styles.num} ${org.resourcesCount === 0 ? styles.zero : ""}`}>{org.resourcesCount}</td>
                  <td className={`${styles.num} ${org.followersCount === 0 ? styles.zero : ""}`}>{org.followersCount}</td>
                  <td className={styles.num}>{renderRating(org)}</td>
                  <td className={styles.date}>{formatAdminDate(org.createdAt)}</td>
                  <td>{renderActions(org)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.organizations.map((org) => (
            <article key={org.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(org)}
                {renderActions(org)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Type</dt>
                  <dd>{ORG_TYPE_LABELS[org.orgType]}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Owner</dt>
                  <dd title={org.ownerEmail ?? undefined}>
                    {org.ownerName ?? (org.claimStatus === "claimed" ? "Deleted teacher" : "Unclaimed")}
                  </dd>
                </div>
                {COUNT_FIELDS.map((field) => (
                  <div key={field.key} className={styles.cardStat}>
                    <dt>{field.label}</dt>
                    <dd className={org[field.key] === 0 ? styles.zero : undefined}>
                      {org[field.key]}
                      {field.key === "teachersCount" && org.pendingCount > 0 && (
                        <span className={styles.pending}> +{org.pendingCount} pending</span>
                      )}
                    </dd>
                  </div>
                ))}
                <div className={styles.cardStat}>
                  <dt>Rating</dt>
                  <dd>{renderRating(org)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Registered</dt>
                  <dd>{formatAdminDate(org.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const tabs = data
    ? TYPE_TABS.filter((type) => type === "all" || type === typeFilter || data.typeCounts[type] > 0).map((type) => ({
        value: type,
        label: type === "all" ? "All organizations" : ORG_TYPE_LABELS[type],
        count: data.typeCounts[type],
      }))
    : undefined;

  return (
    <>
      <Helmet>
        <title>Organizations - Testkart Admin</title>
        <meta name="description" content="Coaching institutes, schools and colleges on the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Organizations">
          <BulkOrganizationUpload onSuccess={handleBulkUploadSuccess} />
        </ConsolePageHeader>

        <ConsoleListToolbar
          tabs={tabs}
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as TypeFilter)}
          tabsLabel="Organization types"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search name, place or owner",
            label: "Search organizations",
          }}
        >
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Filter by visibility">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Visible on site</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              const column = value as AdminOrganizationSort;
              setSortBy(column);
              setSortOrder(defaultSortOrder(column));
            }}
          >
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort organizations by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
          <ConsoleListPagination page={data.currentPage} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>

      <ConsoleConfirmDialog
        open={!!visibilityTarget}
        onOpenChange={(open) => !open && setVisibilityTarget(null)}
        tone={visibilityTarget?.isActive ? "destructive" : "default"}
        icon={visibilityTarget?.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
        title={visibilityTarget?.isActive ? "Hide this organization from the site?" : "Show this organization on the site?"}
        description={
          visibilityTarget?.isActive
            ? `${visibilityTarget.name}'s public page stops loading for visitors. Its teachers, their content and the owner's settings are not changed, and you can show it again at any time.`
            : `${visibilityTarget?.name}'s public page loads for visitors again.`
        }
        confirmLabel={visibilityTarget?.isActive ? "Hide" : "Show"}
        pendingLabel="Saving..."
        isPending={setActiveMutation.isPending}
        onConfirm={confirmVisibility}
      />
    </>
  );
};

export default AdminOrganizationsPage;