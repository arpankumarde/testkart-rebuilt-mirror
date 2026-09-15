import React from "react";
import { ConsolePageHeader } from "./ConsolePageHeader";

/*
 * The teacher console's name for the shared console title row. The markup and
 * styling live in ConsolePageHeader, which the student pages use under its own
 * name - one implementation, so the two consoles cannot drift apart.
 */
export const TeacherPageHeader: React.FC<
  React.ComponentProps<typeof ConsolePageHeader>
> = (props) => <ConsolePageHeader {...props} />;
