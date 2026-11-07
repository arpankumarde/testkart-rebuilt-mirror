import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./Collapsible";
import styles from "./TeacherFoldedPanel.module.css";

/*
 * A closed card for the optional parts of a teacher form (storefront extras,
 * rules, visibility and expiry), so the required fields stay short. Open it
 * from the parent with `open` / `onOpenChange`, for example to show an error
 * inside; otherwise it keeps its own state from `defaultOpen`.
 */
export const TeacherFoldedPanel = ({
  title,
  hint,
  open,
  onOpenChange,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isOpen = open ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className={styles.panel}>
      <CollapsibleTrigger className={styles.trigger}>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {hint && <span className={styles.hint}>{hint}</span>}
        </span>
        <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className={styles.content}>{children}</CollapsibleContent>
    </Collapsible>
  );
};