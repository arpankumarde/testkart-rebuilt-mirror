import React from "react";
import { ConsoleListPagination } from "./ConsoleListPagination";

/*
 * The teacher console's name for the shared pager. The markup and styling live
 * in ConsoleListPagination, which the student pages use under its own name -
 * one implementation, so the two consoles cannot drift apart.
 */
export const TeacherListPagination: React.FC<
  React.ComponentProps<typeof ConsoleListPagination>
> = (props) => <ConsoleListPagination {...props} />;
