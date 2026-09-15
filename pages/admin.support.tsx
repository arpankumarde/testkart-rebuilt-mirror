import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import {
  useAdminThreadsQuery,
  useAdminThreadMessagesQuery,
  useAdminReplyMutation,
  useUpdateThreadStatusMutation,
} from "../helpers/useAdminSupport";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { linkifyText } from "../helpers/linkifyText";
import { AdminSupportThread } from "../endpoints/admin/support/threads_GET.schema";
import { SupportThreadStatus } from "../helpers/schema";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import {
  Form,
  FormItem,
  FormControl,
  useForm,
} from "../components/Form";
import { Textarea } from "../components/Textarea";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  CheckCircle,
  Archive,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import styles from "./admin.support.module.css";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_VALUES = ["all", "open", "resolved", "closed"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const LIST_FILTERS = ["unread"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const formatDate = (dateString: string | Date) => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(dateString));
};

const formatTime = (dateString: string | Date) => {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(dateString));
};

const replySchema = z.object({
  message: z.string().min(1, "Write a reply before sending."),
});

const getStatusBadgeVariant = (status: string): "warning" | "success" | "secondary" | "default" => {
  switch (status) {
    case "open": return "warning";
    case "resolved": return "success";
    case "closed": return "secondary";
    default: return "default";
  }
};

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colTeacher} />
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
  </colgroup>
);

const TableHead = () => (
  <thead>
    <tr>
      <th>Teacher</th>
      <th>Subject</th>
      <th>Status</th>
      <th>Last message</th>
    </tr>
  </thead>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const ThreadRowSkeleton = () => (
  <tr>
    <td><Skeleton style={{ height: "0.875rem", width: "70%" }} /></td>
    <td><StackSkeleton top="45%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.25rem" }} /></td>
    <td><StackSkeleton top="80%" bottom="50%" /></td>
  </tr>
);

const ThreadCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
      <Skeleton style={{ height: "1.125rem", width: "3.25rem", flexShrink: 0 }} />
    </div>
    <StackSkeleton top="50%" bottom="90%" />
  </div>
);

const renderTeacher = (thread: AdminSupportThread) => (
  <span className={styles.primaryLine}>
    <span className={styles.truncate} title={thread.teacherName}>{thread.teacherName}</span>
    {thread.unreadCount > 0 && (
      <span className={styles.unreadDot}>{thread.unreadCount}</span>
    )}
  </span>
);

const renderSubject = (thread: AdminSupportThread) => (
  <div className={styles.stack}>
    <span className={styles.subjectLine} title={thread.subject}>{thread.subject}</span>
    <span className={styles.secondaryLine} title={thread.lastMessagePreview}>{thread.lastMessagePreview}</span>
  </div>
);

const renderStatus = (thread: AdminSupportThread) => (
  <Badge variant={getStatusBadgeVariant(thread.status)} className={styles.flag}>
    {statusLabel(thread.status)}
  </Badge>
);

export default function AdminSupportPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedThread, setSelectedThread] = useState<AdminSupportThread | null>(null);
  const { read, write } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "all");
  const listFilter = read<ListFilter | "none">("filter", LIST_FILTERS, "none");
  const unreadOnly = listFilter === "unread";

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminThreadsQuery(
    page,
    20,
    statusFilter !== "all" ? (statusFilter as SupportThreadStatus) : undefined,
    debouncedSearchTerm,
    unreadOnly
  );
  useRefetchOnLinkArrival(statusFilter !== "all" || unreadOnly, isFetching, refetch);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, unreadOnly]);

  const totalPages = data ? Math.ceil(data.totalCount / data.limit) : 0;
  const isFiltered = debouncedSearchTerm !== "" || statusFilter !== "all" || unreadOnly;

  const renderThreadList = () => {
    return (
      <div className={styles.page}>
        <ConsolePageHeader title="Support inbox" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={statusFilter}
          onValueChange={(value) => write({ status: value === "all" ? null : value })}
          tabsLabel="Thread status"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by teacher",
            label: "Search support threads",
          }}
        />

        {unreadOnly && (
          <ConsoleFilterNotice
            label="Threads with unread teacher messages"
            count={data?.totalCount}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>
          {isFetching && !data ? (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <TableColumns />
                  <TableHead />
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => <ThreadRowSkeleton key={i} />)}
                  </tbody>
                </table>
              </div>
              <div className={styles.cardsContainer}>
                {Array.from({ length: 4 }).map((_, i) => <ThreadCardSkeleton key={i} />)}
              </div>
            </>
          ) : isError ? (
            <ConsoleListEmpty
              tone="error"
              icon={<AlertCircle size={24} />}
              title="Could not load the support threads"
              description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
            >
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </ConsoleListEmpty>
          ) : !data || data.threads.length === 0 ? (
            <ConsoleListEmpty
              icon={<MessageSquare size={24} />}
              title={isFiltered ? "No threads match these filters" : "The inbox is clear"}
              description={
                isFiltered
                  ? "Nothing here for this status and search. Widen the filters to see the rest."
                  : "Messages from teachers land here. Nothing is waiting on you."
              }
            >
              {isFiltered && (
                <Button
                  variant="outline"
                  onClick={() => { setSearchTerm(""); write({ status: null, filter: null }); }}
                >
                  Show all threads
                </Button>
              )}
            </ConsoleListEmpty>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <TableColumns />
                  <TableHead />
                  <tbody>
                    {data.threads.map((thread) => (
                      <tr key={thread.id} className={styles.clickable} onClick={() => setSelectedThread(thread)}>
                        <td>{renderTeacher(thread)}</td>
                        <td>{renderSubject(thread)}</td>
                        <td>{renderStatus(thread)}</td>
                        <td>
                          <div className={styles.stack}>
                            <span className={styles.valueLine}>{formatDate(thread.lastMessageAt)}</span>
                            <span className={styles.secondaryLine}>{formatTime(thread.lastMessageAt)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.cardsContainer}>
                {data.threads.map((thread) => (
                  <article
                    key={thread.id}
                    className={`${styles.card} ${styles.clickable}`}
                    onClick={() => setSelectedThread(thread)}
                  >
                    <div className={styles.cardHeader}>
                      {renderTeacher(thread)}
                      {renderStatus(thread)}
                    </div>
                    <div className={styles.cardBody}>{renderSubject(thread)}</div>
                    <dl className={styles.cardStats}>
                      <div className={styles.cardStat}>
                        <dt>Last message</dt>
                        <dd>{formatDate(thread.lastMessageAt)}, {formatTime(thread.lastMessageAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        {!isError && data && data.threads.length > 0 && totalPages > 1 && (
          <ConsoleListPagination
            page={data.page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    );
  };

  const renderDetailView = () => {
    if (!selectedThread) return null;

    return (
      <div className={styles.page}>
        <ThreadDetailView 
          thread={selectedThread} 
          onBack={() => setSelectedThread(null)} 
        />
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Support inbox - Testkart Admin</title>
        <meta name="description" content="Support threads from teachers." />
      </Helmet>
      {selectedThread ? renderDetailView() : renderThreadList()}
    </>
  );
}

function ThreadDetailView({ thread, onBack }: { thread: AdminSupportThread, onBack: () => void }) {
  const navigate = useNavigate();
  const { data: messages, isLoading } = useAdminThreadMessagesQuery(thread.id);
  const replyMutation = useAdminReplyMutation();
  const statusMutation = useUpdateThreadStatusMutation();
  const bottomRef = useRef<HTMLDivElement>(null);

  const form = useForm({
    schema: replySchema,
    defaultValues: { message: "" },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReply = (values: z.infer<typeof replySchema>) => {
    replyMutation.mutate({ threadId: thread.id, message: values.message }, {
      onSuccess: () => {
        form.setValues({ message: "" });
      }
    });
  };

  const handleStatusChange = (newStatus: SupportThreadStatus) => {
    statusMutation.mutate({ threadId: thread.id, status: newStatus }, {
      onSuccess: () => {
        // Reflect the change locally so the header updates before the list refetches.
        thread.status = newStatus;
      }
    });
  };

  return (
    <div className={styles.detailContainer}>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to the inbox">
            <ArrowLeft size={20} />
          </Button>
          <div className={styles.detailHeaderInfo}>
            <h2 className={styles.detailSubject}>{thread.subject}</h2>
            <div className={styles.detailTeacher}>
              <span className={styles.detailTeacherName}>
                {thread.teacherName}
                <button
                  type="button"
                  className={styles.teacherLinkButton}
                  aria-label={`Find ${thread.teacherName} in Teachers`}
                  onClick={() => navigate(`/admin/teachers?search=${encodeURIComponent(thread.teacherName)}`)}
                >
                  <ExternalLink size={14} />
                </button>
              </span>
              <Badge variant={getStatusBadgeVariant(thread.status)}>
                {statusLabel(thread.status)}
              </Badge>
            </div>
          </div>
        </div>
        <div className={styles.detailHeaderActions}>
          {thread.status === "open" && (
            <>
              <Button size="sm" variant="primary" onClick={() => handleStatusChange("resolved")} disabled={statusMutation.isPending}>
                <CheckCircle size={16} /> Mark resolved
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("closed")} disabled={statusMutation.isPending}>
                <Archive size={16} /> Close
              </Button>
            </>
          )}
          {thread.status === "resolved" && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("closed")} disabled={statusMutation.isPending}>
                <Archive size={16} /> Close
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("open")} disabled={statusMutation.isPending}>
                <RefreshCw size={16} /> Reopen
              </Button>
            </>
          )}
          {thread.status === "closed" && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("open")} disabled={statusMutation.isPending}>
              <RefreshCw size={16} /> Reopen
            </Button>
          )}
        </div>
      </header>

      <div className={styles.chatArea}>
        {isLoading ? (
          <div className={styles.chatSkeleton}>
            <Skeleton style={{ height: "60px", width: "50%", alignSelf: "flex-start" }} />
            <Skeleton style={{ height: "80px", width: "60%", alignSelf: "flex-end" }} />
            <Skeleton style={{ height: "50px", width: "40%", alignSelf: "flex-start" }} />
          </div>
        ) : (
          messages?.map((msg) => {
            const isAdmin = msg.senderType === "admin";
            return (
              <div key={msg.id} className={`${styles.messageWrapper} ${isAdmin ? styles.admin : styles.teacher}`}>
                <div className={styles.messageMeta}>
                  <span className={styles.messageSender}>{msg.senderName}</span>
                  <span>{formatDate(msg.createdAt)} at {formatTime(msg.createdAt)}</span>
                </div>
                <div className={styles.messageBubble}>
                  {linkifyText(msg.messageText)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.replyContainer}>
        {thread.status === "closed" ? (
          <p className={styles.closedNote}>
            This thread is closed. Reopen it to send a message.
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReply)} className={styles.replyForm}>
              <div className={styles.replyInputWrapper}>
                <FormItem name="message" className={styles.replyField}>
                  <FormControl>
                    <Textarea 
                      placeholder="Write a reply" 
                      value={form.values.message}
                      onChange={(e) => form.setValues(prev => ({ ...prev, message: e.target.value }))}
                      disableResize
                      className={styles.replyTextarea}
                    />
                  </FormControl>
                </FormItem>
              </div>
              <Button type="submit" disabled={replyMutation.isPending}>
                <Send size={16} />
                Send
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
