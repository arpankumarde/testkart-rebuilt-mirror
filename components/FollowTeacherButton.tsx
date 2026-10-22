import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
 * visitors and teachers (who can't follow another teacher here) are sent to
 * login instead of silently doing nothing, same pattern as add-to-cart on
 * TestCard/CourseCard.
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
    mutation.mutate({ teacherId, follow: !isFollowing });
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${isFollowing ? styles.following : ""} ${className ?? ""}`}
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-pressed={isFollowing}
    >
      {isFollowing ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
};
