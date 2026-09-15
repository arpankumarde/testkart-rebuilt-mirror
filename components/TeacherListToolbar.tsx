import React from "react";
import {
  ConsoleListToolbar,
  consoleToolbarControlClass,
  type ConsoleListTab,
} from "./ConsoleListToolbar";

/*
 * The teacher console's name for the shared filter band. The markup and
 * styling live in ConsoleListToolbar, which the student pages use under its
 * own name - one implementation, so the two consoles cannot drift apart.
 */
export type TeacherListTab = ConsoleListTab;

/* Give this to a SelectTrigger dropped into the toolbar so it sizes like the
   sort control on Test series. */
export const teacherToolbarControlClass = consoleToolbarControlClass;

export const TeacherListToolbar: React.FC<
  React.ComponentProps<typeof ConsoleListToolbar>
> = (props) => <ConsoleListToolbar {...props} />;
