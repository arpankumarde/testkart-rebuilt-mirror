import React from "react";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { TeacherKindTile } from "./TeacherKindTile";
import type { TeacherContentKind } from "../helpers/teacherContentKinds";

/*
 * The teacher console's name for the shared empty/error panel. The markup and
 * styling live in ConsoleListEmpty, which the student pages use under its own
 * name - one implementation, so the two consoles cannot drift apart.
 * A first-time empty list passes `kind` to lead with that kind's colour tile.
 */
export const TeacherListEmpty: React.FC<
  React.ComponentProps<typeof ConsoleListEmpty> & { kind?: TeacherContentKind }
> = ({ kind, icon, ...props }) =>
  kind && props.tone !== "error" ? (
    <ConsoleListEmpty {...props} visual={<TeacherKindTile kind={kind} size="lg" />} />
  ) : (
    <ConsoleListEmpty {...props} icon={icon} />
  );
