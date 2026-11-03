import React from "react";
import { ConsolePageHeader } from "./ConsolePageHeader";
import { TeacherKindTile } from "./TeacherKindTile";
import type { TeacherContentKind } from "../helpers/teacherContentKinds";

/*
 * The teacher console's name for the shared console title row. The markup and
 * styling live in ConsolePageHeader, which the student pages use under its own
 * name - one implementation, so the two consoles cannot drift apart.
 * Content list pages pass `kind` to show that kind's colour tile by the title.
 */
export const TeacherPageHeader: React.FC<
  React.ComponentProps<typeof ConsolePageHeader> & { kind?: TeacherContentKind }
> = ({ kind, leading, ...props }) => (
  <ConsolePageHeader {...props} leading={kind ? <TeacherKindTile kind={kind} /> : leading} />
);
