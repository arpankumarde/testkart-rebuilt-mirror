import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  useAdminNewsQuery,
  useDeleteNewsMutation,
} from "../helpers/useAdminNews";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import {
  AlertCircle,
  Edit,
  Trash2,
  Plus,
  Newspaper,
  ExternalLink,
  Eye,
  RefreshCw,
} from "lucide-react";
import styles from "./admin.news.module.css";

/** The live site, so "View article" opens the real page rather than the preview. */
const PUBLIC_ORIGIN = "https://testkart.in";

const NEW_COVERAGE_HREF = "/admin/news/e/new";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const AdminNewsPage: React.FC = () => {
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } =
    useAdminNewsQuery();
  const deleteMutation = useDeleteNewsMutation();

  const [now, setNow] = useState(() => Date.now());
  const [itemToDelete, setItemToDelete] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);

  const items = data?.items ?? [];
  const publishedCount = items.filter((item) => item.isPublished).length;
  const withSource = items.filter((item) => item.coverageUrl).length;

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.skeletonList} aria-busy="true">
          <Skeleton style={{ height: "5.5rem", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "5.5rem", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "5.5rem", borderRadius: "var(--radius-md)" }} />
        </div>
      );
    }

    if (isError && !data) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the coverage list"
          description={
            error instanceof Error
              ? error.message
              : "The request did not come back. Check your connection and try again."
          }
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (items.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Newspaper size={24} />}
          title="No coverage yet"
          description="Add a press mention or event and it appears on /news-and-events."
        >
          <Button asChild>
            <Link to={NEW_COVERAGE_HREF}>
              <Plus size={16} /> New coverage
            </Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.list}>
          {items.map((item) => (
            <div key={item.id} className={styles.row}>
              <img src={item.imageUrl} alt="" className={styles.thumb} />
              <div className={styles.rowBody}>
                <div className={styles.rowTitleLine}>
                  <Link to={`/admin/news/e/${item.id}`} className={styles.rowTitle}>
                    {item.title}
                  </Link>
                  <Badge variant={item.isPublished ? "success" : "secondary"}>
                    {item.isPublished ? "Published" : "Hidden"}
                  </Badge>
                </div>
                <div className={styles.rowMeta}>
                  {item.publicationName && <span>{item.publicationName}</span>}
                  <span>{formatDate(item.publishedAt)}</span>
                  <span className={styles.slugPath}>
                    /news-and-events/{item.slug}
                  </span>
                  {item.previousSlugs.length > 0 && (
                    <span>
                      {item.previousSlugs.length} old URL
                      {item.previousSlugs.length === 1 ? "" : "s"} redirecting
                    </span>
                  )}
                  {item.coverageUrl && (
                    <a
                      href={item.coverageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      Source <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <div className={styles.actions}>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-md"
                  aria-label={`View ${item.title} on the site`}
                >
                  <a
                    href={`${PUBLIC_ORIGIN}/news-and-events/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View article"
                  >
                    <Eye size={16} />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-md"
                  aria-label={`Edit ${item.title}`}
                >
                  <Link to={`/admin/news/e/${item.id}`} title="Edit">
                    <Edit size={16} />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-md"
                  onClick={() => setItemToDelete({ id: item.id, title: item.title })}
                  className={styles.deleteAction}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <footer className={styles.totals} aria-label="Coverage totals">
          <div className={styles.total}>
            <span className={styles.totalValue}>{adminFormat.count(items.length)}</span>
            <span className={styles.totalLabel}>entries</span>
          </div>
          <div className={styles.total}>
            <span className={styles.totalValue}>{adminFormat.count(publishedCount)}</span>
            <span className={styles.totalLabel}>published</span>
          </div>
          <div className={styles.total}>
            <span className={styles.totalValue}>
              {adminFormat.count(items.length - publishedCount)}
            </span>
            <span className={styles.totalLabel}>hidden</span>
          </div>
          <div className={styles.total}>
            <span className={styles.totalValue}>{adminFormat.count(withSource)}</span>
            <span className={styles.totalLabel}>with source link</span>
          </div>
        </footer>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>News and events - Testkart Admin</title>
        <meta name="description" content="Press coverage shown on the public site." />
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="News and events">
          {dataUpdatedAt > 0 && (
            <span className={styles.updated}>
              Updated {adminFormat.relativeTime(new Date(dataUpdatedAt), now)}
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh"
            className={styles.refresh}
          >
            <RefreshCw size={16} className={isFetching ? styles.spin : undefined} />
          </Button>
          <Button asChild>
            <Link to={NEW_COVERAGE_HREF}>
              <Plus size={16} /> New coverage
            </Link>
          </Button>
        </ConsolePageHeader>

        {isError && data && (
          <div className={styles.error} role="alert">
            The list could not be refreshed, so it may be out of date.{" "}
            {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div className={styles.content} aria-busy={isFetching}>
          {renderContent()}
        </div>
      </div>

      <DeleteConfirmationDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMutation.mutate(
              { id: itemToDelete.id },
              { onSuccess: () => setItemToDelete(null) }
            );
          }
        }}
        isPending={deleteMutation.isPending}
        itemName={itemToDelete?.title}
        itemType="news coverage"
      />
    </>
  );
};

export default AdminNewsPage;
