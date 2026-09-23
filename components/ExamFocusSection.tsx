import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../helpers/useAuth";
import { useSaveExamFocusMutation } from "../helpers/useExamFocus";
import type { ExamFocusItem } from "../helpers/examFocusShared";
import { Button } from "./Button";
import { ExamFocusPicker } from "./ExamFocusPicker";
import styles from "./ExamFocusSection.module.css";

const sameIds = (a: ExamFocusItem[], b: ExamFocusItem[]) =>
  a.length === b.length && a.every((exam, index) => exam.id === b[index].id);

// Profile card for editing the exams picked in the sign-in prompt or teacher onboarding.
export const ExamFocusSection: React.FC<{ className?: string }> = ({ className }) => {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const saved = user?.examFocus ?? [];
  const [picks, setPicks] = useState<ExamFocusItem[]>(saved);
  const save = useSaveExamFocusMutation();

  useEffect(() => {
    setPicks(user?.examFocus ?? []);
  }, [user?.examFocus]);

  if (!user || (user.role !== "student" && user.role !== "teacher") || user.teacherRole === "manager") {
    return null;
  }

  const isTeacher = user.role === "teacher";
  const dirty = !sameIds(picks, saved);

  const handleSave = () => {
    save.mutate(
      picks.map((exam) => exam.id),
      {
        onSuccess: () => toast.success("Exam focus updated."),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your exams."),
      }
    );
  };

  return (
    <section className={`${styles.section} ${className ?? ""}`} aria-labelledby="exam-focus-heading">
      <div className={styles.header}>
        <h2 id="exam-focus-heading" className={styles.title}>
          Exam focus
        </h2>
        <p className={styles.description}>
          {isTeacher
            ? "The exams you prepare students for. Pick up to 5."
            : "The exams you are preparing for. Pick up to 5."}
        </p>
      </div>
      <ExamFocusPicker value={picks} onChange={setPicks} disabled={save.isPending} />
      <div className={styles.actions}>
        {dirty && (
          <Button variant="ghost" onClick={() => setPicks(saved)} disabled={save.isPending}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={!dirty || picks.length === 0 || save.isPending}>
          {save.isPending ? "Saving..." : "Save exams"}
        </Button>
      </div>
    </section>
  );
};