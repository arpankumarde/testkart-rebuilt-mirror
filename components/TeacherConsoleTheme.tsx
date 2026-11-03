import type { TeacherContentKind } from "../helpers/teacherContentKinds";
import styles from "./TeacherConsoleTheme.module.css";

/**
 * Set once on the teacher layout root. Every teacher page reads its surfaces,
 * the pine panel and money colour from the --tc-* variables this defines.
 * The plain "tk-teacher-console" class lets shared kit modules (Button) raise
 * their touch targets inside the console only.
 */
export const teacherConsoleClass = `${styles.console} tk-teacher-console`;

/**
 * Sets --tone-tint / --tone-line / --tone-edge / --tone-ink for one content
 * kind on the element it is applied to: test series blue, courses lavender,
 * notes butter, live tests peach, bundles mint.
 */
export const contentToneClass = (kind: TeacherContentKind) => styles[kind];