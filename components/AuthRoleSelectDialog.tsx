import React from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, BookOpen, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import styles from "./AuthRoleSelectDialog.module.css";

interface AuthRoleSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "login" | "signup";
  redirectTo?: string | null;
}

export const AuthRoleSelectDialog: React.FC<AuthRoleSelectDialogProps> = ({
  open,
  onOpenChange,
  type,
  redirectTo,
}) => {
  const navigate = useNavigate();

  const handleSelect = (role: "student" | "teacher") => {
    onOpenChange(false);

    let path = "";
    if (role === "student") {
      path = type === "login" ? "/login" : "/signup";
    } else {
      path = type === "login" ? "/teacher/login" : "/teacher/signup";
    }

    if (redirectTo) {
      // Ensure we don't double encode or create invalid params
      const separator = path.includes("?") ? "&" : "?";
      path += `${separator}redirectTo=${encodeURIComponent(redirectTo)}`;
    }

    navigate(path);
  };

  const title = type === "login" ? "Log In as..." : "Sign Up as...";
  const description =
    type === "login"
      ? "Choose your account type to continue to your dashboard."
      : "Create an account to get started with Testkart.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>{title}</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.cardsContainer}>
          <button
            className={styles.roleCard}
            onClick={() => handleSelect("student")}
            type="button"
          >
            <div className={`${styles.iconWrapper} ${styles.studentIcon}`}>
              <GraduationCap size={32} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>I'm a Student</h3>
              <p className={styles.cardSubtitle}>
                Access tests, track progress, and prepare for exams
              </p>
            </div>
            <ChevronRight className={styles.chevron} size={20} />
          </button>

          <button
            className={styles.roleCard}
            onClick={() => handleSelect("teacher")}
            type="button"
          >
            <div className={`${styles.iconWrapper} ${styles.teacherIcon}`}>
              <BookOpen size={32} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>I'm a Teacher</h3>
              <p className={styles.cardSubtitle}>
                Create tests, manage students, and earn money
              </p>
            </div>
            <ChevronRight className={styles.chevron} size={20} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};