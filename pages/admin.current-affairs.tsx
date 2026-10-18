import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  LayoutList,
  Link2,
  ListChecks,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import {
  useAdminCurrentAffairsList,
  useCurrentAffairsStatusMutation,
  useDeleteCurrentAffairsMutation,
  useDuplicateCurrentAffairsMutation,
} from "../helpers/useAdminCurrentAffairs";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import type { CurrentAffairsListRow, InputType as ListInput } from "../endpoints/admin/current-affairs/list_GET.schema";
import type { InputType as StatusInput } from "../endpoints/admin/current-affairs/status_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
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
import styles from "./admin.current-affairs.module.css";

const NEW_HREF = "/admin/current-affairs/e/new";
const ALL = "__all";
const PAGE_SIZE = 20;
const VISIBLE_TAGS = 3;

const TYPE_ICONS = {
  daily_digest: CalendarDays,
  weekly_digest: CalendarRange,
  monthly_digest: Calendar,
  editorial_analysis: CalendarDays,
  individual_item: CalendarDays,
} as const;

type StatusAction = StatusInput["action"];

const STATUS_VALUES = ["draft", "scheduled", "published", "archived"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const isStatus = (value: string | null): value is StatusFilter =>
  !!value && (STATUS_VALUES as readonly string[]).includes(value);

const timingLine = (row: CurrentAffairsListRow): string => {
  if (row.status === "published" && row.publishedAt) return `Published ${currentAffairsMeta.formatIst(row.publishedAt)}`;
  if (row.status === "scheduled" && row.publishAt) return `Goes live ${currentAffairsMeta.formatIst(row.publishAt)}`;
  return `Created ${currentAffairsMeta.formatIst(row.createdAt)}`;
};

/** An icon button with a tooltip; the label doubles as its accessible name. */
const IconAction: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const CONFIRM_COPY: Record<StatusAction, { title: string; body: string; confirm: string }> = {
  publish: {
    title: "Publish now?",
    body: "It goes live immediately. A scheduled time set in the editor is replaced with now.",
    confirm: "Publish",
  },
  unpublish: {
    title: "Unpublish this post?",
    body: "It moves back to Draft and stops showing on the site. Nothing is deleted.",
    confirm: "Unpublish",
  },
  archive: {
    title: "Archive this post?",
    body: "Archived posts are hidden from the site and the default list. You can restore it later.",
    confirm: "Archive",
  },
  restore: {
    title: "Restore this post?",
    body: "It comes back as a draft, ready to edit and publish again.",
    confirm: "Restore",
  },
};

const AdminCurrentAffairsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const input: ListInput = {
    search: params.get("q") || undefined,
    status,
    contentType: (params.get("type") as ListInput["contentType"]) || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminCurrentAffairsList(input);
  const searchInput = useDebouncedInput(params.get("q") ?? "", (value) => updateParams({ q: value.trim() || undefined }));
  const statusMutation = useCurrentAffairsStatusMutation();
  const duplicateMutation = useDuplicateCurrentAffairsMutation();
  const deleteMutation = useDeleteCurrentAffairsMutation();

  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<{ row: CurrentAffairsListRow; action: StatusAction } | null>(null);
  const [toDelete, setToDelete] = useState<CurrentAffairsListRow | null>(null);

  useEffect(() => setNow(Date.now()), [dataUpdatedAt]);

  const updateParams = (changes: Record<string, string | undefined>, keepPage = false) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!keepPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const hasFilters = !!params.get("type");

  const statusCounts = data?.statusCounts;
  const allCount = statusCounts ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0) : undefined;
  const tabs = [
    { value: ALL, label: "All", count: allCount },
    ...currentAffairsMeta.STATUSES.map((s) => ({ value: s.value, label: s.label, count: statusCounts?.[s.value] })),
  ];

  const runAction = () => {
    if (!pendingAction) return;
    const { row, action } = pendingAction;
    statusMutation.mutate(
      { id: row.id, action },
      {
        onSuccess: () => setPendingAction(null),
        onError: (err) => {
          setPendingAction(null);
          toast.error(parseErrorMessage(err), {
            action:
              action === "publish"
                ? { label: "Open editor", onClick: () => navigate(`/admin/current-affairs/e/${row.id}`) }
                : undefined,
          });
        },
      }
    );
  };

  const rows = data?.rows ?? [];

  const renderRow = (row: CurrentAffairsListRow) => {
    const editHref = `/admin/current-affairs/e/${row.id}`;
    const previewHref = `/admin/current-affairs/preview/${row.id}`;
    const canDelete = row.status === "draft" || row.status === "archived";
    // Topics first, then exams; syllabus tags stay in the editor to keep the card short.
    const pillTags = [...row.tags.filter((t) => t.kind === "topic"), ...row.tags.filter((t) => t.kind === "exam")];
    const extraTags = pillTags.length - VISIBLE_TAGS;
    const TypeIcon = TYPE_ICONS[row.contentType];
    const period = row.digestDate ? currentAffairsMeta.periodLabel(row.contentType, row.digestDate) : "";
    const path = currentAffairsMeta.canonicalPath(row);

    return (
      <article key={row.id} className={`${styles.card} ${styles[`type_${row.contentType}`] ?? ""}`}>
        {row.coverImageUrl ? (
          <img src={row.coverImageUrl} alt="" className={styles.thumb} loading="lazy" />
        ) : (
          <div className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
            <TypeIcon size={20} />
            {row.digestDate && (
              <span className={styles.thumbLabel}>{currentAffairsMeta.periodShort(row.contentType, row.digestDate)}</span>
            )}
          </div>
        )}

        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>
            <Link to={editHref} className={styles.titleLink}>
              {row.title || "Untitled"}
            </Link>
          </h3>

          <ul className={styles.pills} aria-label="Status and tags">
            <li className={`${styles.pill} ${styles[`status_${row.status}`]}`}>
              {currentAffairsMeta.statusLabel(row.status)}
            </li>
            <li className={`${styles.pill} ${styles.typePill}`}>
              <TypeIcon size={12} aria-hidden="true" />
              {currentAffairsMeta.contentTypeShort(row.contentType)}
            </li>
            {row.language === "hi" && <li className={`${styles.pill} ${styles.neutralPill}`}>Hindi</li>}
            {row.quiz && (
              <li className={`${styles.pill} ${styles.neutralPill}`}>
                <ListChecks size={12} aria-hidden="true" />
                Quiz {row.quiz.questionCount}
                {row.quiz.isPublished ? "" : " (hidden)"}
              </li>
            )}
            {pillTags.slice(0, VISIBLE_TAGS).map((tag) => (
              <li key={`${tag.kind}-${tag.name}`} className={`${styles.pill} ${styles[`tag_${tag.kind}`]}`}>
                {tag.name}
              </li>
            ))}
            {extraTags > 0 && (
              <li className={`${styles.pill} ${styles.neutralPill}`} title={pillTags.slice(VISIBLE_TAGS).map((t) => t.name).join(", ")}>
                +{extraTags}
              </li>
            )}
          </ul>

          <ul className={styles.meta}>
            <li>
              <UserRound size={14} aria-hidden="true" />
              {row.authorName ?? "No author"}
            </li>
            <li>
              <CalendarCheck size={14} aria-hidden="true" />
              {timingLine(row)}
            </li>
            {period && (
              <li>
                <CalendarRange size={14} aria-hidden="true" />
                Covers {period}
              </li>
            )}
            <li>
              <LayoutList size={14} aria-hidden="true" />
              {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
            </li>
            <li>
              <Clock size={14} aria-hidden="true" />
              Updated {adminFormat.relativeTime(row.updatedAt, now)}
            </li>
          </ul>

          {row.status === "published" ? (
            <a
              href={currentAffairsMeta.openHref(row)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.urlLink}
              onClick={(e) => e.stopPropagation()}
              title="Open the public page in a new tab"
            >
              <Link2 size={14} aria-hidden="true" />
              <span className={styles.urlText}>{path}</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : (
            <p className={styles.urlMuted}>
              <Link2 size={14} aria-hidden="true" />
              <span className={styles.urlText}>{path}</span>
              <span className={styles.urlNote}>not live</span>
              <Link to={previewHref} className={styles.urlPreview} onClick={(e) => e.stopPropagation()}>
                Preview
              </Link>
            </p>
          )}
        </div>

        <div className={styles.rowActions}>
          <IconAction label="View">
            <Button asChild variant="ghost" size="icon-md" className={styles.actionButton} aria-label={`View ${row.title}`}>
              <Link to={previewHref}>
                <Eye size={17} />
              </Link>
            </Button>
          </IconAction>
          <IconAction label="Edit">
            <Button asChild variant="ghost" size="icon-md" className={styles.actionButton} aria-label={`Edit ${row.title}`}>
              <Link to={editHref}>
                <Edit size={17} />
              </Link>
            </Button>
          </IconAction>
          <DropdownMenu modal={false}>
            <IconAction label="More">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-md" className={styles.actionButton} aria-label={`More actions for ${row.title}`}>
                  <MoreHorizontal size={17} />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end" sideOffset={6} className={styles.menu}>
              {(row.status === "draft" || row.status === "scheduled") && (
                <DropdownMenuItem className={styles.menuItem} onSelect={() => setPendingAction({ row, action: "publish" })}>
                  <Rocket size={16} className={styles.menuIcon} aria-hidden="true" />
                  Publish now
                </DropdownMenuItem>
              )}
              {(row.status === "published" || row.status === "scheduled") && (
                <DropdownMenuItem className={styles.menuItem} onSelect={() => setPendingAction({ row, action: "unpublish" })}>
                  <Undo2 size={16} className={styles.menuIcon} aria-hidden="true" />
                  Unpublish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={styles.menuItem}
                onSelect={() => duplicateMutation.mutate(row.id)}
                disabled={duplicateMutation.isPending}
              >
                <Copy size={16} className={styles.menuIcon} aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className={styles.menuSeparator} />
              {row.status === "archived" ? (
                <DropdownMenuItem className={styles.menuItem} onSelect={() => setPendingAction({ row, action: "restore" })}>
                  <ArchiveRestore size={16} className={styles.menuIcon} aria-hidden="true" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className={styles.menuItem} onSelect={() => setPendingAction({ row, action: "archive" })}>
                  <Archive size={16} className={styles.menuIcon} aria-hidden="true" />
                  Archive
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem className={`${styles.menuItem} ${styles.menuDanger}`} onSelect={() => setToDelete(row)}>
                  <Trash2 size={16} className={styles.menuIcon} aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>
    );
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.list} aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} style={{ height: "6.5rem", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      );
    }

    if (isError && !data) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load current affairs"
          description={error instanceof Error ? error.message : "Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (rows.length === 0) {
      const filtered = !!input.search || hasFilters || !!status;
      return (
        <ConsoleListEmpty
          className={styles.emptyCompact}
          icon={<CalendarDays size={24} />}
          title={filtered ? "Nothing matches these filters" : "No current affairs yet"}
          description={
            filtered
              ? "Try a different search, status or content type."
              : "Create the first daily digest, editorial or single item."
          }
        >
          {filtered ? (
            <Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          ) : (
            <Button asChild className={styles.emptyCreate}>
              <Link to={NEW_HREF}>
                <Plus size={16} /> Create Current Affairs
              </Link>
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.list}>{rows.map(renderRow)}</div>
        {data && data.totalPages > 1 && (
          <nav className={styles.pager} aria-label="Pages">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => updateParams({ page: String(page - 1) }, true)}
            >
              Previous
            </Button>
            <span className={styles.pagerLabel}>
              Page {page} of {data.totalPages} - {adminFormat.count(data.total)} posts
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages || isFetching}
              onClick={() => updateParams({ page: String(page + 1) }, true)}
            >
              Next
            </Button>
          </nav>
        )}
      </>
    );
  };

  const confirmCopy = pendingAction ? CONFIRM_COPY[pendingAction.action] : null;
  const updatedLabel = dataUpdatedAt > 0 ? `Updated ${adminFormat.relativeTime(new Date(dataUpdatedAt), now)}` : "Refresh";

  return (
    <>
      <Helmet>
        <title>Current Affairs - Testkart Admin</title>
        <meta name="description" content="Daily digests, editorials and quizzes for the Current Affairs hub." />
      </Helmet>

      <div className={styles.page}>
        <h1 className={styles.srOnly}>Current Affairs</h1>

        {/* One band: status tabs on the left, search, type, refresh and create on the right.
            The right group drops to its own line when the band is too narrow for both. */}
        <div className={styles.bar}>
          <ConsoleListToolbar
            className={styles.tabsBand}
            tabs={tabs}
            value={status ?? ALL}
            onValueChange={(value) => updateParams({ status: value === ALL ? undefined : value })}
            tabsLabel="Status"
            panelId="current-affairs-list"
          />
          <div className={styles.controls}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search title or slug"
                aria-label="Search current affairs"
                value={searchInput.value}
                onChange={(e) => searchInput.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchInput.flush();
                }}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.typeFilter}>
            <Select
              value={params.get("type") ?? ALL}
              onValueChange={(value) => updateParams({ type: value === ALL ? undefined : value })}
            >
              <SelectTrigger className={consoleToolbarControlClass} aria-label="Content type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {currentAffairsMeta.DIGEST_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className={styles.actions}>
            <Button
              variant="outline"
              size="icon-md"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={`Refresh list. ${updatedLabel}`}
              title={updatedLabel}
              className={styles.refresh}
            >
              <RefreshCw size={16} className={isFetching ? styles.spin : undefined} />
            </Button>
            <Button asChild className={styles.create}>
              <Link to={NEW_HREF}>
                <Plus size={16} /> Create Current Affairs
              </Link>
            </Button>
            </div>
          </div>
        </div>

        {isError && data && (
          <div className={styles.error} role="alert">
            The list could not be refreshed, so it may be out of date.{" "}
            {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div id="current-affairs-list" className={styles.content} aria-busy={isFetching}>
          {renderContent()}
        </div>
      </div>

      {confirmCopy && pendingAction && (
        <ConsoleConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          tone={pendingAction.action === "archive" ? "destructive" : "default"}
          title={confirmCopy.title}
          description={
            <>
              <strong>{pendingAction.row.title}</strong> - {confirmCopy.body}
            </>
          }
          confirmLabel={confirmCopy.confirm}
          isPending={statusMutation.isPending}
          onConfirm={runAction}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteMutation.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
        isPending={deleteMutation.isPending}
        itemName={toDelete?.title}
        itemType="current affairs post"
      />
    </>
  );
};

export default AdminCurrentAffairsPage;