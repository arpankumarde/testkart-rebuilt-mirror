import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, BellRing, Edit } from "lucide-react";
import { useAdminExamNewsPost } from "../helpers/useAdminExamNews";
import { examNewsMeta } from "../helpers/examNewsMeta";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ExamNewsPreview } from "../components/ExamNewsPreview";
import { CurrentAffairsStatusBadge } from "../components/CurrentAffairsStatusBadge";
import styles from "./admin.news.preview.$id.module.css";

/** The saved version of a story, laid out like the planned public page. Unsaved edits preview from the editor. */
const AdminExamNewsPreviewPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const id = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;
  const { data, isFetching, isError, error, refetch } = useAdminExamNewsPost(id);
  const post = data?.post;

  return (
    <>
      <Helmet>
        <title>{`Preview${post ? `: ${post.title}` : ""} - Testkart Admin`}</title>
      </Helmet>
      <div className={styles.page}>
        <div className={styles.bar}>
          <Button asChild variant="ghost" size="sm" className={styles.back}>
            <Link to="/admin/news" aria-label="Back to News">
              <ArrowLeft size={16} /> <span className={styles.backLabel}>News</span>
            </Link>
          </Button>
          <span className={styles.divider} aria-hidden="true" />
          <h1 className={styles.heading}>Preview</h1>
          {post && <CurrentAffairsStatusBadge status={post.status} />}
          {post && (
            <span className={styles.path} title="Where the story will live once the public pages are built">
              {examNewsMeta.publicPath(post.slug)}
            </span>
          )}
          {post && (
            <Button asChild size="sm" className={styles.edit}>
              <Link to={examNewsMeta.editPath(post.id)}>
                <Edit size={15} /> Edit
              </Link>
            </Button>
          )}
        </div>

        {id === null ? (
          <ConsoleListEmpty icon={<BellRing size={24} />} title="Story not found" description="The link is wrong." />
        ) : isError && !post ? (
          <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load this story" description={parseErrorMessage(error)}>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        ) : !post || (isFetching && !data) ? (
          <Skeleton style={{ height: "40rem", borderRadius: "var(--radius-lg)" }} />
        ) : (
          <div className={styles.sheet}>
            <ExamNewsPreview
              post={post}
              examName={post.examName}
              authorName={post.authorName}
              publishedAt={post.publishedAt}
              updatedAt={post.updatedAt}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default AdminExamNewsPreviewPage;