import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  useAdminBlogPostsQuery, 
  useAdminBlogCategoriesQuery, 
  useDeleteBlogPostMutation 
} from "../helpers/useAdminBlog";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { SortOrder } from "../helpers/useTableSort";
import { SortableTh } from "./SortableTh";
import { BlogContentType, BlogPostStatus } from "../helpers/schema";
import {
  AdminPostListItem,
  AdminPostListFilter,
  AdminPostListFilterValues,
  AdminPostSortBy,
} from "../endpoints/admin/blog/posts/list_GET.schema";
import { CONTENT_STALE_DAYS } from "../endpoints/admin/content/dashboard_GET.schema";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { Badge } from "./Badge";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { Skeleton } from "./Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "./Pagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { Search, Edit, Trash2, Plus, FileText, ExternalLink } from "lucide-react";
import styles from "./AdminBlogContentTab.module.css";

interface AdminBlogContentTabProps {
  type: BlogContentType;
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const STATUS_VALUES: readonly (BlogPostStatus | "all")[] = ["all", "published", "draft", "archived"];

const FILTER_PHRASES: Record<AdminPostListFilter, string> = {
  "missing-seo": "missing an SEO title or description",
  "missing-og-image": "with no social share image",
  uncategorised: "with no category",
  stale: `not edited in ${CONTENT_STALE_DAYS} days`,
};

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (words[0][0] + last).toUpperCase();
};

const AuthorLine = ({ name, avatar }: { name: string | null; avatar: string | null }) => {
  if (!name) return <span className={styles.emptyLine}>Unknown</span>;
  return (
    <span className={styles.author} title={name}>
      <Avatar className={styles.authorAvatar} aria-hidden="true">
        {avatar && <AvatarImage src={avatar} alt="" />}
        <AvatarFallback className={styles.authorInitials}>{initials(name)}</AvatarFallback>
      </Avatar>
      <span className={styles.truncate}>{name}</span>
    </span>
  );
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colAuthor} />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
    <col className={styles.colViews} />
    <col className={styles.colReadTime} />
    <col className={styles.colActions} />
  </colgroup>
);

const PostRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "30%" }} />
      </div>
    </td>
    <td>
      <div className={styles.author}>
        <Skeleton style={{ height: "1.5rem", width: "1.5rem", borderRadius: "9999px", flexShrink: 0 }} />
        <Skeleton style={{ height: "0.875rem", width: "5.5rem" }} />
      </div>
    </td>
    <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "2.5rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const PostCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "6rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

export const AdminBlogContentTab: React.FC<AdminBlogContentTabProps> = ({ type }) => {
  // status and filter live in the URL so a content dashboard tile lands on exactly the rows it counted.
  const { read, write } = useListUrlParams();
  const status = read<BlogPostStatus | "all">("status", STATUS_VALUES, "all");
  const filter = read<AdminPostListFilter | "none">("filter", AdminPostListFilterValues, "none");

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [pickedCategoryId, setPickedCategoryId] = useState<number | "all">("all");
  // A post with no category cannot be in one, so the uncategorised filter overrides the picker.
  const categoryId = filter === "uncategorised" ? "all" : pickedCategoryId;

  const [sortBy, setSortBy] = useState<AdminPostSortBy | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const sort = {
    sortBy,
    sortOrder,
    toggleSort: (column: AdminPostSortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        return;
      }
      setSortBy(column);
      setSortOrder(column === "title" || column === "author" || column === "status" ? "asc" : "desc");
    },
  };

  // A page number belongs to one set of list inputs, so changing any of them starts again at page 1.
  const listKey = `${status}|${filter}|${categoryId}|${debouncedSearch}|${sortBy}|${sortOrder}`;
  const [pagination, setPagination] = useState({ key: listKey, page: 1 });
  const page = pagination.key === listKey ? pagination.page : 1;

  const [postToDelete, setPostToDelete] = useState<{ id: number; title: string } | null>(null);

  // Queries for stats (lightweight limit:1 queries to get total counts)
  const { data: allStats } = useAdminBlogPostsQuery({ type, page: 1, limit: 1 });
  const { data: pubStats } = useAdminBlogPostsQuery({ type, status: "published", page: 1, limit: 1 });
  const { data: draftStats } = useAdminBlogPostsQuery({ type, status: "draft", page: 1, limit: 1 });
  const { data: archStats } = useAdminBlogPostsQuery({ type, status: "archived", page: 1, limit: 1 });

  // Main data query
  const { data, isFetching, error, refetch } = useAdminBlogPostsQuery({
    search: debouncedSearch || undefined,
    type,
    status: status === "all" ? undefined : status,
    categoryId: categoryId === "all" ? undefined : categoryId,
    filter: filter === "none" ? undefined : filter,
    sortBy: sortBy ?? undefined,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
    limit: 20
  });
  useRefetchOnLinkArrival(status !== "all" || filter !== "none", isFetching, refetch);

  const { data: categoriesData } = useAdminBlogCategoriesQuery();
  // Filter categories by type
  const typeCategories = categoriesData?.categories.filter(c => c.type === type) || [];

  const deleteMutation = useDeleteBlogPostMutation();

  const handlePageChange = (newPage: number) => {
    setPagination({ key: listKey, page: newPage });
  };

  const handleCategoryChange = (value: string) => {
    const next = value === "all" ? "all" : Number(value);
    setPickedCategoryId(next);
    if (next !== "all" && filter === "uncategorised") write({ filter: null });
  };

  const itemNoun = type === "blog" ? "posts" : "help pages";
  const filterLabel =
    filter === "none"
      ? null
      : `${status === "all" ? sentenceCase(itemNoun) : `${sentenceCase(status)} ${itemNoun}`} ${FILTER_PHRASES[filter]}`;

  const getStatusVariant = (st: string) => {
    if (st === "published") return "success";
    if (st === "draft") return "outline";
    return "secondary";
  };

  const createButtonText = type === "blog" ? "New Blog Post" : "New Article";
  const createLink = `/admin/blog/e/new?type=${type}`;

  const renderStatusFlag = (post: AdminPostListItem) => (
    <Badge variant={getStatusVariant(post.status)} className={styles.flag}>
      {sentenceCase(post.status)}
    </Badge>
  );

  const renderActions = (post: AdminPostListItem) => (
    <div className={styles.rowActions}>
      {post.status === "published" && post.slug && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-md" asChild className={styles.iconButton}>
              <a
                href={`https://testkart.in/${post.type === "blog" ? "blog" : "help"}/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${post.title} on the site`}
              >
                <ExternalLink />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View on the site</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-md" asChild className={styles.iconButton}>
            <Link to={`/admin/blog/e/${post.id}`} aria-label={`Edit ${post.title}`}>
              <Edit />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={() => setPostToDelete({ id: post.id, title: post.title })}
            aria-label={`Delete ${post.title}`}
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <PostRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (error) {
      return (
        <div className={styles.messageContainer}>
          <FileText className={styles.emptyIcon} />
          <h3>Failed to load posts</h3>
          <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
        </div>
      );
    }

    if (!data || data.posts.length === 0) {
      return (
        <div className={styles.messageContainer}>
          <FileText className={styles.emptyIcon} />
          <h3>No posts found</h3>
          <p>We couldn't find any {type === 'blog' ? 'blog posts' : 'articles'} matching your current filters.</p>
        </div>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="title" sort={sort}>Title</SortableTh>
                <SortableTh column="author" sort={sort}>Author</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="publishedAt" sort={sort}>Published</SortableTh>
                <SortableTh column="viewCount" sort={sort} className={styles.num}>Views</SortableTh>
                <SortableTh column="readingTimeMinutes" sort={sort} className={styles.num}>Read time</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map(post => (
                <tr key={post.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine} title={post.title}>{post.title}</span>
                      <span className={styles.secondaryLine} title={post.categoryName || undefined}>
                        {post.categoryName || "Uncategorized"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <AuthorLine name={post.authorName} avatar={post.authorAvatar} />
                  </td>
                  <td>{renderStatusFlag(post)}</td>
                  <td className={styles.date}>
                    {post.publishedAt ? formatDate(post.publishedAt) : <span className={styles.emptyLine}>Not published</span>}
                  </td>
                  <td className={`${styles.num} ${post.viewCount === 0 ? styles.zero : ""}`}>{post.viewCount}</td>
                  <td className={styles.num}>{post.readingTimeMinutes} min</td>
                  <td>{renderActions(post)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {data.posts.map(post => (
            <article key={post.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.cardTitleLine}>
                    <span className={styles.truncate} title={post.title}>{post.title}</span>
                    {renderStatusFlag(post)}
                  </span>
                  <span className={styles.secondaryLine} title={post.categoryName || undefined}>
                    {post.categoryName || "Uncategorized"}
                  </span>
                </div>
                {renderActions(post)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Author</dt>
                  <dd>
                    <AuthorLine name={post.authorName} avatar={post.authorAvatar} />
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Published</dt>
                  <dd className={post.publishedAt ? undefined : styles.empty}>
                    {post.publishedAt ? formatDate(post.publishedAt) : "Not published"}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Views</dt>
                  <dd className={post.viewCount === 0 ? styles.zero : undefined}>{post.viewCount}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Read time</dt>
                  <dd>{post.readingTimeMinutes} min</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={styles.tabContentContainer}>
      <div className={styles.tabHeader}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total {type === "blog" ? "Posts" : "Articles"}</div>
            <div className={styles.statValue}>{allStats?.total ?? "..."}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Published</div>
            <div className={styles.statValue}>{pubStats?.total ?? "..."}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Drafts</div>
            <div className={styles.statValue}>{draftStats?.total ?? "..."}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Archived</div>
            <div className={styles.statValue}>{archStats?.total ?? "..."}</div>
          </div>
        </div>
        <Button asChild className={styles.createButton}>
          <Link to={createLink}><Plus size={16} /> {createButtonText}</Link>
        </Button>
      </div>

      <div className={styles.filtersBar}>
        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <Input 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterDropdowns}>
          <Select value={status} onValueChange={(val) => write({ status: val === "all" ? null : val })}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(categoryId)} onValueChange={handleCategoryChange}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {typeCategories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filterLabel && (
        <ConsoleFilterNotice
          label={filterLabel}
          count={data?.total}
          onClear={() => write({ filter: null })}
          className={styles.filterNotice}
        />
      )}

      <div className={styles.results}>{renderContent()}</div>

      {data && data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(Math.max(1, page - 1)); }} />
            </PaginationItem>
            <PaginationItem>
              <span style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", padding: "0 var(--spacing-2)" }}>
                Page {page} of {data.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(Math.min(data.totalPages, page + 1)); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <DeleteConfirmationDialog
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => {
          if (postToDelete) {
            deleteMutation.mutate({ id: postToDelete.id }, {
              onSuccess: () => setPostToDelete(null)
            });
          }
        }}
        isPending={deleteMutation.isPending}
        itemName={postToDelete?.title}
        itemType={type === "blog" ? "post" : "article"}
      />
    </div>
  );
};
