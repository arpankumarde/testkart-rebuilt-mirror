import React from "react";
import { teacherContentKind, type TeacherContentKind } from "../helpers/teacherContentKinds";
import { contentToneClass } from "./TeacherConsoleTheme";
import styles from "./TeacherKindTile.module.css";

type Props = {
  kind: TeacherContentKind;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** The content kind's icon on its own colour, the console's marker for a type. */
export const TeacherKindTile = ({ kind, size = "md", className }: Props) => {
  const Icon = teacherContentKind(kind).icon;
  return (
    <span
      className={`${styles.tile} ${styles[size]} ${contentToneClass(kind)} ${className ?? ""}`.trim()}
      aria-hidden="true"
    >
      <Icon className={styles.icon} />
    </span>
  );
};