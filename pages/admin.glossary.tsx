import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, BookA, CheckCircle2, Clock, Edit, Eye, FilePenLine, Library, Plus, Trash2 } from "lucide-react";
import { useAdminGlossaryList, useDeleteGlossaryTermMutation } from "../helpers/useAdminGlossary";
import { adminFormat } from "../helpers/adminFormat";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { RELATED_TERM_COUNT } from "../helpers/glossaryValidation";
import type { GlossaryListRow, InputType as ListInput } from "../endpoints/admin/glossary/list_GET.schema";
import { Button } from "../components/Button";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { GlossaryCategoryTag } from "../components/GlossaryCategoryTag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import styles from "./admin.glossary.module.css";

const ALL = "__all";
const PAGE_SIZE = 20;

/** An icon button with a tooltip; the label doubles as its accessible name. */
const IconAction: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const StatusPill: React.FC<{ row: GlossaryListRow }> = ({ row }) => (
  <span className={`${styles.status} ${styles[`status_${row.status}`]}`}>{glossaryMeta.statusLabel(row.status)}</span>
);

/** A live page showing fewer than three related cards, because a chosen term was unpublished or deleted. */
const RelatedFlag: React.FC<{ row: GlossaryListRow }> = ({ row }) =>
  row.status === "published" && row.liveRelatedCount < RELATED_TERM_COUNT ? (
    <span className={styles.flag}>
      {row.liveRelatedCount} of {RELATED_TERM_COUNT} related terms live
    </span>
  ) : null;

const AdminGlossaryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();

  const categoryParam = params.get("category");
  const category = glossaryMeta.isCategory(categoryParam) ? categoryParam : undefined;
  const statusParam = params.get("status");
  const status = glossaryMeta.isStatus(statusParam) ? statusParam : undefined;
  const sort = params.get("sort") === "alphabetical" ? "alphabetical" : "recent";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";

  const input: ListInput = { search: search || undefined, category, status, sort, page, limit: PAGE_SIZE };
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminGlossaryList(input);
  const deleteMutation = useDeleteGlossaryTermMutation();

  const [now, setNow] = useState(() => Date.now());
  const [toDelete, setToDelete] = useState<GlossaryListRow | null>(null);

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

  const stats = data?.stats;
  const STAT_CARDS = [
    { key: "total", label: "Total terms", value: stats?.total, icon: Library, tone: styles.toneLavender },
    { key: "published", label: "Published", value: stats?.published, icon: CheckCircle2, tone: styles.toneMint },
    { key: "draft", label: "Drafts", value: stats?.draft, icon: FilePenLine, tone: styles.tonePeach },
    { key: "recent", label: "Updated in 7 days", value: stats?.recentlyUpdated, icon: Clock, tone: styles.tonePowder },
  ];

  const rows = data?.rows ?? [];
  const filtered = !!search || !!category || !!status;

  const renderActions = (row: GlossaryListRow) => (
    <div className={styles.actions}>
      <IconAction label="Edit">
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${row.term}`}>
          <Link to={glossaryMeta.editPath(row.id)}>
            <Edit size={16} />
          </Link>
        </Button>
      </IconAction>
      <IconAction label="Preview">
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Preview ${row.term}`}>
          <Link to={glossaryMeta.previewPath(row.id)}>
            <Eye size={16} />
          </Link>
        </Button>
      </IconAction>
      <IconAction label="Delete">
        <Button variant="ghost" size="icon-sm" className={styles.danger} aria-label={`Delete ${row.term}`} onClick={() => setToDelete(row)}>
          <Trash2 size={16} />
        </Button>
      </IconAction>
    </div>
  );

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.loading} aria-busy="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} style={{ height: "3.5rem", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      );
    }

    if (isError && !data) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the glossary"
          description={error instanceof Error ? error.message : "Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (rows.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<BookA size={24} />}
          title={filtered ? "Nothing matches these filters" : "No terms yet"}
          description={filtered ? "Try a different search, category or status." : "Add the first term to start the glossary."}
        >
          {filtered ? (
            <Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          ) : (
            <Button asChild>
              <Link to={glossaryMeta.editPath("new")}>
                <Plus size={16} /> Add New Term
              </Link>
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.results}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col />
              <col className={styles.colCategory} />
              <col className={styles.colSlug} />
              <col className={styles.colStatus} />
              <col className={styles.colUpdated} />
              <col className={styles.colActions} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Term name</th>
                <th scope="col">Category</th>
                <th scope="col">URL slug</th>
                <th scope="col">Status</th>
                <th scope="col">Last updated</th>
                <th scope="col" className={styles.actionsHead}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={glossaryMeta.editPath(row.id)} className={styles.termLink}>
                      {row.term}
                    </Link>
                    <RelatedFlag row={row} />
                  </td>
                  <td>
                    <GlossaryCategoryTag category={row.category} />
                  </td>
                  <td className={styles.slug} title={row.slug}>
                    {row.slug}
                  </td>
                  <td>
                    <StatusPill row={row} />
                  </td>
                  <td className={styles.updated}>{examNewsPublicMeta.formatDate(row.updatedAt)}</td>
                  <td>{renderActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cards}>
          {rows.map((row) => (
            <article key={row.id} className={styles.card}>
              <div className={styles.cardTop}>
                <Link to={glossaryMeta.editPath(row.id)} className={styles.termLink}>
                  {row.term}
                </Link>
                <StatusPill row={row} />
              </div>
              <RelatedFlag row={row} />
              <GlossaryCategoryTag category={row.category} />
              <p className={styles.cardSlug}>/glossary/{row.slug}</p>
              <div className={styles.cardBottom}>
                <span className={styles.updated}>Updated {adminFormat.relativeTime(row.updatedAt, now)}</span>
                {renderActions(row)}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const usedBy = toDelete?.usedByCount ?? 0;

  return (
    <>
      <Helmet>
        <title>Glossary - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="Glossary">
          <Button asChild>
            <Link to={glossaryMeta.editPath("new")}>
              <Plus size={16} /> Add New Term
            </Link>
          </Button>
        </ConsolePageHeader>

        <section className={styles.stats} aria-label="Glossary summary">
          {STAT_CARDS.map(({ key, label, value, icon: Icon, tone }) => (
            <div key={key} className={`${styles.stat} ${tone}`}>
              <span className={styles.statIcon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.statValue}>{value === undefined ? "-" : adminFormat.count(value)}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </section>

        <ConsoleListToolbar
          className={styles.toolbar}
          search={{
            value: search,
            onChange: (value) => updateParams({ q: value.trim() || undefined }),
            placeholder: "Search term name",
            label: "Search glossary terms",
          }}
        >
          <Select value={category ?? ALL} onValueChange={(value) => updateParams({ category: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {glossaryMeta.CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status ?? ALL} onValueChange={(value) => updateParams({ status: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {glossaryMeta.STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => updateParams({ sort: value === "alphabetical" ? value : undefined })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently updated</SelectItem>
              <SelectItem value="alphabetical">A to Z</SelectItem>
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {isError && data && (
          <div className={styles.error} role="alert">
            The list could not be refreshed, so it may be out of date. {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div aria-busy={isFetching}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination page={page} totalPages={data.totalPages} onPageChange={(next) => updateParams({ page: String(next) }, true)} />
        )}
      </div>

      <ConsoleConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this term?"
        description={
          <>
            <strong>{toDelete?.term}</strong> will be removed permanently. This cannot be undone.
            {usedBy > 0 && ` Its card also leaves the ${usedBy} term${usedBy === 1 ? "" : "s"} that list it as related.`}
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (toDelete) deleteMutation.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </>
  );
};

export default AdminGlossaryPage;