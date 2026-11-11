import React from "react";
import { Button } from "./Button";
import { TeacherListEmpty } from "./TeacherListEmpty";
import { TeacherCreateButton, type TeacherCreateAction } from "./TeacherCreateButton";
import type { TeacherContentKind } from "../helpers/teacherContentKinds";

type Common = {
  kind: TeacherContentKind;
  /** The kind in a sentence, plural and lower case: "courses", "notes or PDFs". */
  plural: string;
};

export type TeacherContentEmptyProps = Common &
  (
    | { reason: "none"; description: string; create: TeacherCreateAction }
    | { reason: "status"; statusWord: string }
    | { reason: "search"; query: string; statusWord?: string; onClearSearch: () => void }
    | { reason: "filter"; title: string; description: string; children?: React.ReactNode }
  );

/**
 * Every empty state on the teacher content lists, worded from one place:
 * "none" when the teacher has nothing at all, "status" when the selected tab
 * is empty, "search" when nothing matches, "filter" for any other narrowing.
 */
export const TeacherContentEmpty = (props: TeacherContentEmptyProps) => {
  const { kind, plural } = props;

  switch (props.reason) {
    case "none":
      return (
        <TeacherListEmpty kind={kind} title={`No ${plural} yet`} description={props.description}>
          <TeacherCreateButton {...props.create} />
        </TeacherListEmpty>
      );
    case "status":
      return (
        <TeacherListEmpty
          kind={kind}
          title={`No ${props.statusWord} ${plural} yet`}
          description="Nothing here yet. The other tabs may have what you are looking for."
        />
      );
    case "search":
      return (
        <TeacherListEmpty
          kind={kind}
          title={`No ${props.statusWord ? `${props.statusWord} ` : ""}${plural} match "${props.query}"`}
          description={props.statusWord ? "Try a different word, or check the other tabs." : "Try a different word."}
        >
          <Button variant="outline" onClick={props.onClearSearch}>
            Clear search
          </Button>
        </TeacherListEmpty>
      );
    case "filter":
      return (
        <TeacherListEmpty kind={kind} title={props.title} description={props.description}>
          {props.children}
        </TeacherListEmpty>
      );
  }
};