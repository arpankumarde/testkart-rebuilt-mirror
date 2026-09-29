import { Link } from "react-router-dom";
import { Button } from "./Button";
import { useAuth } from "../helpers/useAuth";
import styles from "./TeachCtaButton.module.css";

/**
 * The wide "Get started" button on /teach, used by the hero and the closing
 * CTA. A signed-in teacher has already started, so for them the same button
 * opens the dashboard instead of sending them back to sign-up.
 */
export const TeachCtaButton = ({ className }: { className?: string }) => {
  const { authState } = useAuth();
  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";

  return (
    <Button asChild size="lg" className={`${styles.cta} ${className ?? ""}`.trim()}>
      <Link to={isTeacher ? "/teacher/dashboard" : "/teacher/signup"}>
        {isTeacher ? "Go to your dashboard" : "Get started"}
      </Link>
    </Button>
  );
};