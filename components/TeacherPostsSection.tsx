import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useTeacherPublicPostsQuery, useLikeTeacherPostMutation } from "../helpers/useTeacherPublicPosts";
import { Skeleton } from "./Skeleton";
import styles from "./TeacherPostsSection.module.css";

interface TeacherPostsSectionProps {
  teacherSlug: string;
  shortName: string;
}

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * A public broadcast feed on a teacher's profile - anyone can read it,
 * signed in or not. Liking is the only gated action: an unauthenticated
 * visitor is sent to login instead, same redirect pattern as
 * FollowTeacherButton and add-to-cart elsewhere.
 */
export const TeacherPostsSection: React.FC<TeacherPostsSectionProps> = ({ teacherSlug, shortName }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const { data, isFetching } = useTeacherPublicPostsQuery(teacherSlug, true);
  const likeMutation = useLikeTeacherPostMutation(teacherSlug);

  const posts = data?.posts ?? [];

  // No posts yet - don't show an empty "Community Posts" section for that.
  if (!isFetching && posts.length === 0) return null;

  const handleLike = (postId: number) => {
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    likeMutation.mutate(postId);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{shortName}'s Community Posts</h2>
      </div>

      <div className={styles.panel}>
        {isFetching && !data ? (
          <div className={styles.skeletonList}>
            <Skeleton style={{ height: "5rem", borderRadius: "1.25rem" }} />
          </div>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.post}>
                <p className={styles.postBody}>{post.body}</p>
                {post.imageUrl && <img src={post.imageUrl} alt="" className={styles.postImage} />}
                <div className={styles.postFooter}>
                  <span className={styles.postDate}>{formatDate(post.createdAt)}</span>
                  <button
                    type="button"
                    className={`${styles.likeButton} ${post.likedByMe ? styles.liked : ""}`}
                    onClick={() => handleLike(post.id)}
                    disabled={likeMutation.isPending}
                    aria-pressed={post.likedByMe}
                  >
                    <Heart size={15} aria-hidden="true" fill={post.likedByMe ? "currentColor" : "none"} />
                    {post.likeCount > 0 ? post.likeCount : "Like"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
