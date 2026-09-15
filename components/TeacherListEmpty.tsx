import React from "react";
import { ConsoleListEmpty } from "./ConsoleListEmpty";

/*
 * The teacher console's name for the shared empty/error panel. The markup and
 * styling live in ConsoleListEmpty, which the student pages use under its own
 * name - one implementation, so the two consoles cannot drift apart.
 */
export const TeacherListEmpty: React.FC<
  React.ComponentProps<typeof ConsoleListEmpty>
> = (props) => <ConsoleListEmpty {...props} />;
