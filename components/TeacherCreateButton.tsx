import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import styles from "./TeacherCreateButton.module.css";

/** Where a content page's create action goes: a route, or a handler. */
export type TeacherCreateAction = {
  label: string;
  to?: string;
  onClick?: () => void;
};

type Props = TeacherCreateAction & { className?: string };

/**
 * The primary create action on teacher content pages, in the header and in
 * first-run empty states: the peach CTA of the sidebar's Create button.
 */
export const TeacherCreateButton = ({ label, to, onClick, className }: Props) => {
  const classes = `${styles.button} ${className ?? ""}`;
  const content = (
    <>
      <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
};