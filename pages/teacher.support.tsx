import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Plus, LifeBuoy } from "lucide-react";
import { Button } from "../components/Button";
import { useTeacherThreadsQuery } from "../helpers/useTeacherSupport";
import { useListUrlParams } from "../helpers/useListUrlParams";
import type { SupportThreadWithUnread } from "../endpoints/teacher/support/threads_GET.schema";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { TeacherSupportThreadList } from "../components/TeacherSupportThreadList";
import { TeacherSupportMessageView } from "../components/TeacherSupportMessageView";
import { TeacherSupportNewDialog } from "../components/TeacherSupportNewDialog";
import styles from "./teacher.support.module.css";

const LIST_FILTERS = ["unread"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

export default function TeacherSupportPage() {
  const { read, write } = useListUrlParams();
  const unreadOnly = read<ListFilter | "none">("filter", LIST_FILTERS, "none") === "unread";
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  // Opening a thread marks its replies read, so the next refetch of the unread
  // list drops it. The copy taken on open keeps the thread on screen.
  const [openedThread, setOpenedThread] = useState<SupportThreadWithUnread | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  // Fetch recent threads. 50 limit keeps context easily loaded.
  const threadsQuery = useTeacherThreadsQuery(1, 50, unreadOnly);
  const threads = threadsQuery.data?.threads ?? [];

  const selectedThread = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId) ??
      (openedThread?.id === selectedThreadId ? openedThread : null)
    : null;

  const selectThread = (id: number) => {
    setSelectedThreadId(id);
    setOpenedThread(threads.find((t) => t.id === id) ?? null);
  };

  return (
    <>
      <Helmet>
        <title>Support - Testkart</title>
        <meta
          name="description"
          content="Get help from the Testkart team. View your support threads and start new conversations."
        />
      </Helmet>

      <div className={styles.page}>
        <TeacherPageHeader title="Support">
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus size={16} />
            New conversation
          </Button>
        </TeacherPageHeader>

        {unreadOnly && (
          <ConsoleFilterNotice
            label="Threads with unread replies"
            count={threadsQuery.data?.totalCount}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}

        <main className={`${styles.workspace} ${unreadOnly ? styles.workspaceWithNotice : ""}`}>
          {/* List pane: hidden on a phone once a thread is open. */}
          <div
            className={`${styles.listPane} ${
              selectedThreadId ? styles.hiddenOnMobile : ""
            }`}
          >
            <TeacherSupportThreadList
              threads={threads}
              isFetching={threadsQuery.isFetching}
              selectedThreadId={selectedThreadId}
              onSelectThread={selectThread}
              emptyTitle={unreadOnly ? "No unread replies" : undefined}
              emptyText={unreadOnly ? "You have read every reply from the Testkart team." : undefined}
            />
          </div>

          {/* Detail pane: hidden on a phone until a thread is open. */}
          <div
            className={`${styles.detailPane} ${
              !selectedThreadId ? styles.hiddenOnMobile : ""
            }`}
          >
            {selectedThreadId && selectedThread ? (
              <TeacherSupportMessageView
                threadId={selectedThreadId}
                thread={selectedThread}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className={styles.emptyDetail}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <LifeBuoy size={26} />
                </span>
                <h2 className={styles.emptyTitle}>Pick a conversation</h2>
                <p className={styles.emptyText}>
                  Choose a thread on the left to read it, or start a new one.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <TeacherSupportNewDialog
        isOpen={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSuccess={(id) => {
          setIsNewDialogOpen(false);
          setSelectedThreadId(id);
          // A new thread has no reply yet, so the unread list would never show it.
          if (unreadOnly) write({ filter: null });
        }}
      />
    </>
  );
}
