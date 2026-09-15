import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { 
  useAdminBlogCommentsQuery, 
  useAdminBlogPostsQuery,
  useModerateBlogCommentMutation 
} from "../helpers/useAdminBlog";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { BlogCommentStatus } from "../helpers/schema";
import { Button } from "../components/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { MessageSquare, Check, X, AlertCircle } from "lucide-react";
import styles from "./admin.blog.comments.module.css";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STATUS_VALUES: readonly (BlogCommentStatus | "all")[] = ["pending", "approved", "rejected", "all"];

const AdminBlogCommentsPage = () => {
  // Status lives in the URL so the content dashboard's pending tile opens this exact list.
  const { read, write, searchParams } = useListUrlParams();
  const statusFilter = read<BlogCommentStatus | "all">("status", STATUS_VALUES, "pending");
  const [postFilter, setPostFilter] = useState<number | undefined>(undefined);

  // A page number belongs to one status and post, so changing either starts again at page 1.
  const listKey = `${statusFilter}|${postFilter ?? ""}`;
  const [pagination, setPagination] = useState({ key: listKey, page: 1 });
  const page = pagination.key === listKey ? pagination.page : 1;
  const setPage = (next: number) => setPagination({ key: listKey, page: next });

  const [commentToDelete, setCommentToDelete] = useState<{ id: number } | null>(null);

  // Fetch recent posts to populate the post filter dropdown
  const { data: postsData } = useAdminBlogPostsQuery({ page: 1, limit: 100 });

  const { data, isFetching, error, refetch } = useAdminBlogCommentsQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    postId: postFilter,
    page,
    limit: 20
  });
  useRefetchOnLinkArrival(searchParams.has("status"), isFetching, refetch);

  const moderateMutation = useModerateBlogCommentMutation();

  const handleModerate = (commentId: number, action: "approve" | "reject" | "delete") => {
    moderateMutation.mutate({ commentId, action });
  };

  const getStatusVariant = (st: string) => {
    if (st === "approved") return "success";
    if (st === "rejected") return "destructive";
    return "warning";
  };

  const statusLabel = (st: string) => st.charAt(0).toUpperCase() + st.slice(1);

  const isFiltered = statusFilter !== "all" || postFilter !== undefined;

  const clearFilters = () => {
    write({ status: "all" });
    setPostFilter(undefined);
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.skeletonStack} aria-busy="true">
          <Skeleton style={{ height: "9rem", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "9rem", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "9rem", borderRadius: "var(--radius-md)" }} />
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the comments"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.comments.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<MessageSquare size={24} />}
          title={isFiltered ? "No comments match these filters" : "No comments yet"}
          description={
            isFiltered
              ? "Nothing here for this status and post. Widen the filters to see the rest."
              : "Comments left on blog posts and help page guides land here for moderation."
          }
        >
          {isFiltered && (
            <Button variant="outline" onClick={clearFilters}>Show all comments</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.commentsGrid}>
        {data.comments.map(comment => (
          <div key={comment.id} className={styles.commentCard}>
            <div className={styles.commentHeader}>
              <div className={styles.commentAuthor}>
                <div className={styles.avatar}>
                  {comment.authorAvatar ? (
                    <img src={comment.authorAvatar} alt={comment.authorName} className={styles.avatarImg} />
                  ) : (
                    <div className={styles.avatarFallback}>{comment.authorName.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className={styles.commentMeta}>
                  <span className={styles.authorName}>{comment.authorName}</span>
                  <span className={styles.postTitle}>on <strong>{comment.postTitle}</strong></span>
                  <span className={styles.dateText}>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Badge variant={getStatusVariant(comment.status)}>{statusLabel(comment.status)}</Badge>
            </div>

            <div className={styles.commentContent}>
              {comment.content}
            </div>

            <div className={styles.commentActions}>
              {comment.status !== 'approved' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleModerate(comment.id, 'approve')} 
                  disabled={moderateMutation.isPending}
                  className={styles.approveButton}
                >
                  <Check size={16} /> Approve
                </Button>
              )}
              {comment.status !== 'rejected' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleModerate(comment.id, 'reject')} 
                  disabled={moderateMutation.isPending}
                  className={styles.rejectButton}
                >
                  <X size={16} /> Reject
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCommentToDelete({ id: comment.id })} 
                disabled={moderateMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Comments - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="Comments" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={statusFilter}
          onValueChange={(val) => write({ status: val === "pending" ? null : val })}
          tabsLabel="Comment status"
        >
          <Select 
            value={postFilter ? String(postFilter) : "__empty"} 
            onValueChange={(val) => setPostFilter(val === "__empty" ? undefined : Number(val))}
          >
            <SelectTrigger className={consoleToolbarControlClass}>
              <SelectValue placeholder="All posts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty">All posts</SelectItem>
              {postsData?.posts.map(post => (
                <SelectItem key={post.id} value={String(post.id)}>{post.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {renderContent()}

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <DeleteConfirmationDialog
        isOpen={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={() => {
          if (commentToDelete) {
            handleModerate(commentToDelete.id, "delete");
            setCommentToDelete(null);
          }
        }}
        isPending={moderateMutation.isPending}
        itemType="comment"
      />
    </>
  );
};

export default AdminBlogCommentsPage;
