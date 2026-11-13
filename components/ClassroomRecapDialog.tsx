import React from "react";
import { useAuth } from "../helpers/useAuth";
import type { ClassroomKind } from "../helpers/useLiveClassroom";
import { Dialog } from "./Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody } from "./ConsoleDialog";
import { ClassroomRecap } from "./ClassroomRecap";

export type ClassroomRecapTarget = {
  kind: ClassroomKind;
  id: string;
  /** The other person in the class: the teacher for a student, the student for a teacher. */
  withName: string;
  startTime: Date | string;
};

const whenFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** A finished class's chat and whiteboard, opened from the student and teacher class lists. */
export const ClassroomRecapDialog: React.FC<{ target: ClassroomRecapTarget | null; onOpenChange: (open: boolean) => void }> = ({
  target,
  onOpenChange,
}) => {
  const { authState } = useAuth();
  const viewerId = authState.type === "authenticated" ? authState.user.id : null;
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      {target && (
        <ConsoleDialogContent size="lg">
          <ConsoleDialogHeader
            title={`Class with ${target.withName}`}
            description={whenFormat.format(new Date(target.startTime))}
          />
          <ConsoleDialogBody>
            <ClassroomRecap
              key={target.id}
              kind={target.kind}
              id={target.id}
              viewerId={viewerId}
              fileName={`class-whiteboard-${target.id.slice(0, 8)}.png`}
            />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      )}
    </Dialog>
  );
};
