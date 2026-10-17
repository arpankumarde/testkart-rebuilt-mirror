import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Clock,
  Edit,
  ExternalLink,
  Eye,
  FilePenLine,
  Link2,
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
  useAdminExamNewsList,
  useDeleteExamNewsMutation,
  useExamNewsExamSearch,
  useExamNewsStatusMutation,
} from "../helpers/useAdminExamNews";
import { examNewsMeta } from "../helpers/examNewsMeta";
import { EXAM_NEWS_TYPE_ICONS } from "../helpers/examNewsIcons";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import type { ExamNewsListRow, InputType as ListInput } from "../endpoints/admin/exam-news/list_GET.schema";
import type { InputType as StatusInput } from "../endpoints/admin/exam-news/status_POST.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ExamNewsExamPicker } from "../components/ExamNewsExamPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/DropdownMenu";
import styles from "./admin.news.module.css";

const NEW_HREF = examNewsMeta.editPath("new");
const ALL = "__all";
const PAGE_SIZE = 20;

type StatusAction = StatusInput["action"];

const STATUS_VALUES = ["draft", "scheduled", "published", "archived"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const isStatus = (value: string | null): value is StatusFilter =>
  !!value && (STATUS_VALUES as readonly string[]).includes(value);

const timingLine = (row: ExamNewsListRow): string => {
  if (row.status === "published" && row.publishedAt) return `Published ${examNewsMeta.formatIst(row.publishedAt)}`;
  if (row.status === "scheduled" && row.publishAt) return `Goes live ${examNewsMeta.formatIst(row.publishAt)}`;
  return `Created ${examNewsMeta.formatIst(row.createdAt)}`;
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
    title: "Unpublish this story?",
    body: "It moves back to Draft and stops showing on the site. Nothing is deleted.",
    confirm: "Unpublish",
  },
  archive: {
    title: "Archive this story?",
    body: "Archived stories are hidden from the site and the default list. You can restore it later.",
    confirm: "Archive",
  },
  restore: {
    title: "Restore this story?",
    body: "It comes back as a draft, ready to edit and publish again.",
    confirm: "Restore",
  },
};

const AdminExamNewsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : undefined;
  const typeParam = params.get("type");
  const newsType = examNewsMeta.isNewsType(typeParam) ? typeParam : undefined;
  const examParam = Number(params.get("exam"));
  const examId = Number.isInteger(examParam) && examParam > 0 ? examParam : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const input: ListInput = {
    search: params.get("q") || undefined,
    status,
    newsType,
    examId,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminExamNewsList(input);
  const examLookup = useExamNewsExamSearch({ id: examId }, !!examId);
  const examChoice = examId
    ? { id: examId, name: examLookup.data?.exams.find((e) => e.id === examId)?.examName ?? "Selected exam" }
    : null;
  const searchInput = useDebouncedInput(params.get("q") ?? "", (value) => updateParams({ q: value.trim() || undefined }));
  const statusMutation = useExamNewsStatusMutation();
  const deleteMutation = useDeleteExamNewsMutation();

  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<{ row: ExamNewsListRow; action: StatusAction } | null>(null);
  const [toDelete, setToDelete] = useState<ExamNewsListRow | null>(null);

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

  const hasFilters = !!newsType || !!examId;

  const statusCounts = data?.statusCounts;
  const allCount = statusCounts ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0) : undefined;
  const tabs = [
    { value: ALL, label: "All", count: allCount },
    ...examNewsMeta.STATUSES.map((s) => ({ value: s.value, label: s.label, count: statusCounts?.[s.value] })),
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
                ? { label: "Open editor", onClick: () => navigate(examNewsMeta.editPath(row.id)) }
                : undefined,
          });
        },
      }
    );
  };

  const rows = data?.rows ?? [];

  const renderRow = (row: ExamNewsListRow) => {
    const editHref = examNewsMeta.editPath(row.id);
    const previewHref = examNewsMeta.previewPath(row.id);
    const canDelete = row.status === "draft" || row.status === "archived";
    const TypeIcon = EXAM_NEWS_TYPE_ICONS[row.newsType];
    const path = examNewsMeta.publicPath(row.slug);

    return (
      <article key={row.id} className={`${styles.card} ${styles[`type_${row.newsType}`] ?? ""}`}>
        {row.heroImageUrl ? (
          <img src={row.heroImageUrl} alt="" className={styles.thumb} loading="lazy" />
        ) : (
          <div className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
            <TypeIcon size={22} />
            <span className={styles.thumbLabel}>{examNewsMeta.newsTypeLabel(row.newsType)}</span>
          </div>
        )}

        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>
            <Link to={editHref} className={styles.titleLink}>
              {row.title || "Untitled"}
            </Link>
          </h3>

          <ul className={styles.pills} aria-label="Status, type and exam">
            <li className={`${styles.pill} ${styles[`status_${row.status}`]}`}>{examNewsMeta.statusLabel(row.status)}</li>
            <li className={`${styles.pill} ${styles.typePill}`}>
              <TypeIcon size={12} aria-hidden="true" />
              {examNewsMeta.newsTypeLabel(row.newsType)}
            </li>
            {row.examName ? (
              <li className={`${styles.pill} ${styles.examPill}`}>{row.examName}</li>
            ) : (
              <li className={`${styles.pill} ${styles.neutralPill}`}>No exam</li>
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
            <li>
              <Clock size={14} aria-hidden="true" />
              Updated {adminFormat.relativeTime(row.updatedAt, now)}
            </li>
            {row.keyDateCount > 0 && (
              <li>
                <CalendarClock size={14} aria-hidden="true" />
                {row.keyDateCount} key date{row.keyDateCount === 1 ? "" : "s"}
              </li>
            )}
            {row.correctionCount > 0 && (
              <li>
                <FilePenLine size={14} aria-hidden="true" />
                {row.correctionCount} correction{row.correctionCount === 1 ? "" : "s"}
              </li>
            )}
          </ul>

          <a
            href={examNewsMeta.openHref(row)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.urlLink}
            title="Open the preview in a new tab"
          >
            <Link2 size={14} aria-hidden="true" />
            <span className={styles.urlText}>{path}</span>
            <span className={styles.urlNote}>{row.status === "published" ? "public page pending" : "not live"}</span>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>

        <div className={styles.rowActions}>
          <IconAction label="Preview">
            <Button asChild variant="ghost" size="icon-md" className={styles.actionButton} aria-label={`Preview ${row.title}`}>
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
          title="Could not load news"
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
          icon={<BellRing size={24} />}
          title={filtered ? "Nothing matches these filters" : "No news yet"}
          description={
            filtered
              ? "Try a different search, status, news type or exam."
              : "Write the first result, admit card or date change story."
          }
        >
          {filtered ? (
            <Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          ) : (
            <Button asChild className={styles.emptyCreate}>
              <Link to={NEW_HREF}>
                <Plus size={16} /> Create News
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
              Page {page} of {data.totalPages} - {adminFormat.count(data.total)} stories
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
        <title>News - Testkart Admin</title>
        <meta name="description" content="Exam results, admit cards, answer keys and date changes for the News hub." />
      </Helmet>

      <div className={styles.page}>
        <h1 className={styles.srOnly}>News</h1>

        {/* Row one: status tabs, refresh and create. Row two: search, news type and exam. */}
        <div className={styles.bar}>
          <div className={styles.barTop}>
            <ConsoleListToolbar
              className={styles.tabsBand}
              tabs={tabs}
              value={status ?? ALL}
              onValueChange={(value) => updateParams({ status: value === ALL ? undefined : value })}
              tabsLabel="Status"
              panelId="exam-news-list"
            />
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
                  <Plus size={16} /> Create News
                </Link>
              </Button>
            </div>
          </div>
          <div className={styles.filters}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search title or slug"
                aria-label="Search news"
                value={searchInput.value}
                onChange={(e) => searchInput.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchInput.flush();
                }}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.typeFilter}>
              <Select value={newsType ?? ALL} onValueChange={(value) => updateParams({ type: value === ALL ? undefined : value })}>
                <SelectTrigger className={consoleToolbarControlClass} aria-label="News type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  {examNewsMeta.NEWS_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ExamNewsExamPicker
              className={styles.examFilter}
              value={examChoice}
              onChange={(choice) => updateParams({ exam: choice ? String(choice.id) : undefined })}
              placeholder="All exams"
              clearLabel="All exams"
              allowClear
            />
          </div>
        </div>

        {isError && data && (
          <div className={styles.error} role="alert">
            The list could not be refreshed, so it may be out of date.{" "}
            {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div id="exam-news-list" className={styles.content} aria-busy={isFetching}>
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
        itemType="news story"
      />
    </>
  );
};

export default AdminExamNewsPage;