import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Check, UserPlus } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useFollowTeacherMutation } from "../helpers/useFollowTeacher";
import styles from "./FollowTeacherButton.module.css";

interface FollowTeacherButtonProps {
  teacherId: number;
  teacherSlug: string;
  isFollowing: boolean;
  className?: string;
}

/**
 * A student-only follow toggle for a teacher's public profile. Signed-out
 * visitors are sent to login instead of silently doing nothing, same pattern
 * as add-to-cart on TestCard/CourseCard. Teachers cannot follow, so it is
 * hidden for them.
 */
export const FollowTeacherButton: React.FC<FollowTeacherButtonProps> = ({
  teacherId,
  teacherSlug,
  isFollowing,
  className,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const mutation = useFollowTeacherMutation(teacherSlug);

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  if (isTeacher) return null;

  const handleClick = () => {
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    mutation.mutate(
      { teacherId, follow: !isFollowing },
      {
        onError: (error) =>
          toast.error(error instanceof Error && error.message ? error.message : "Could not update follow status."),
      }
    );
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${isFollowing ? styles.following : ""} ${className ?? ""}`}
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-pressed={isFollowing}
      title={isFollowing ? "Unfollow" : undefined}
    >
      {isFollowing ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
      {isFollowing ? (
        <span className={styles.label}>
          <span className={styles.restLabel}>Following</span>
          <span className={styles.hoverLabel} aria-hidden="true">
            Unfollow
          </span>
        </span>
      ) : (
        "Follow"
      )}
    </button>
  );
};