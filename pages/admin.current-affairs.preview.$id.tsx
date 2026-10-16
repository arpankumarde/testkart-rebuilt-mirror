import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CalendarDays, Edit } from "lucide-react";
import { useAdminCurrentAffairsPost } from "../helpers/useAdminCurrentAffairs";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { CurrentAffairsPreview } from "../components/CurrentAffairsPreview";
import styles from "./admin.current-affairs.preview.$id.module.css";

/** The saved version of a post, laid out like the public page. Unsaved edits preview from the editor. */
const AdminCurrentAffairsPreviewPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const id = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;
  const { data, isFetching, isError, error, refetch } = useAdminCurrentAffairsPost(id);
  const post = data?.post;

  return (
    <>
      <Helmet>
        <title>{`Preview${post ? `: ${post.title}` : ""} - Testkart Admin`}</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Preview">
          <Button asChild variant="outline">
            <Link to="/admin/current-affairs">
              <ArrowLeft size={16} /> Current Affairs
            </Link>
          </Button>
          {post && (
            <Button asChild>
              <Link to={`/admin/current-affairs/e/${post.id}`}>
                <Edit size={16} /> Edit
              </Link>
            </Button>
          )}
        </ConsolePageHeader>

        {id === null ? (
          <ConsoleListEmpty icon={<CalendarDays size={24} />} title="Post not found" description="The link is wrong." />
        ) : isError && !post ? (
          <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load this post" description={parseErrorMessage(error)}>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        ) : !post || (isFetching && !data) ? (
          <Skeleton style={{ height: "40rem", borderRadius: "var(--radius-md)" }} />
        ) : (
          <div className={styles.sheet}>
            <CurrentAffairsPreview
              post={post}
              authorName={post.authorName}
              publishedAt={post.publishedAt}
              updatedAt={post.updatedAt}
              related={post.related}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default AdminCurrentAffairsPreviewPage;