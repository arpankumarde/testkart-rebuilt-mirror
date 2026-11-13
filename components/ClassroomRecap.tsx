import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, PenTool } from "lucide-react";
import { getMentorshipClassroomChatList } from "../endpoints/mentorship/classroom/chat/list_GET.schema";
import { getMentorshipClassroomWhiteboard } from "../endpoints/mentorship/classroom/whiteboard/get_GET.schema";
import { staticBoard } from "../helpers/useClassroomWhiteboard";
import type { ClassroomKind } from "../helpers/useLiveClassroom";
import { ClassroomChat } from "./ClassroomChat";
import { ClassroomWhiteboard } from "./ClassroomWhiteboard";
import styles from "./ClassroomRecap.module.css";

type Tab = "chat" | "board";

/** After a class: its saved chat and whiteboard, both view only. */
export const ClassroomRecap: React.FC<{ kind: ClassroomKind; id: string; viewerId: number | null; fileName: string }> = ({
  kind,
  id,
  viewerId,
  fileName,
}) => {
  const [tab, setTab] = useState<Tab>("chat");
  const chatQuery = useQuery({
    queryKey: ["mentorship", "classroom", "recap-chat", kind, id],
    queryFn: () => getMentorshipClassroomChatList({ kind, id, limit: 200 }),
    refetchOnMount: true,
    staleTime: 0,
  });
  const boardQuery = useQuery({
    queryKey: ["mentorship", "classroom", "recap-board", kind, id],
    queryFn: () => getMentorshipClassroomWhiteboard({ kind, id }),
    refetchOnMount: true,
    staleTime: 0,
  });
  const ops = boardQuery.data?.ops;
  const board = useMemo(() => staticBoard(ops ?? []), [ops]);

  return (
    <section className={styles.recap} aria-label="Class chat and whiteboard">
      <div className={styles.tabs} role="tablist" aria-label="Class chat and whiteboard">
        <button type="button" role="tab" aria-selected={tab === "chat"} className={styles.tab} onClick={() => setTab("chat")}>
          <MessageSquare size={16} aria-hidden="true" /> Chat
        </button>
        <button type="button" role="tab" aria-selected={tab === "board"} className={styles.tab} onClick={() => setTab("board")}>
          <PenTool size={16} aria-hidden="true" /> Whiteboard
        </button>
      </div>

      <div className={styles.body} role="tabpanel">
        {tab === "chat" ? (
          chatQuery.isError ? (
            <p className={styles.note}>Could not load the chat. Try again in a moment.</p>
          ) : (
            <ClassroomChat
              messages={chatQuery.data?.messages ?? []}
              viewerId={viewerId}
              isLoading={chatQuery.isLoading}
              isSending={false}
              onSend={async () => false}
              readOnly
            />
          )
        ) : boardQuery.isError ? (
          <p className={styles.note}>Could not load the whiteboard. Try again in a moment.</p>
        ) : boardQuery.isLoading ? (
          <p className={styles.note}>Loading the whiteboard...</p>
        ) : board.ops.length === 0 ? (
          <p className={styles.note}>Nothing was drawn on the whiteboard in this class.</p>
        ) : (
          <ClassroomWhiteboard board={board} onClose={() => setTab("chat")} fileName={fileName} readOnly />
        )}
      </div>
    </section>
  );
};
