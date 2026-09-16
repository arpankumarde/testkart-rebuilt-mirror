import { z } from "zod";
import superjson from 'superjson';
import { SupportThreadStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
  status: z.enum(SupportThreadStatusArrayValues).optional(),
  /* Matches the teacher's name or email, or the thread subject. */
  search: z.string().optional(),
  /* Only threads holding a teacher message nobody on the team has read yet. */
  unread: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  /* Narrows the result to one thread, so a linked thread that is not on the page in view can still open. */
  threadId: z.coerce.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminSupportThread = {
  id: number;
  subject: string;
  status: string;
  createdAt: Date;
  lastMessageAt: Date;
  updatedAt: Date;
  teacherName: string;
  /* Null once the teacher has closed their account. */
  teacherEmail: string | null;
  teacherId: number | null;
  unreadCount: number;
  lastMessagePreview: string;
  /* "teacher" or "admin"; null for a thread with no messages. */
  lastSenderType: string | null;
};

/*
 * Tab counts. Each status count follows the search and the unread filter; the
 * unread count follows the search and the status, so every number is what the
 * list shows after that one click.
 */
export type AdminSupportThreadCounts = {
  all: number;
  open: number;
  resolved: number;
  closed: number;
  unread: number;
};

export type OutputType = {
  threads: AdminSupportThread[];
  totalCount: number;
  page: number;
  limit: number;
  counts: AdminSupportThreadCounts;
};

export const getAdminSupportThreads = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const url = new URL("/_api/admin/support/threads", window.location.origin);
  if (query.page) url.searchParams.set("page", query.page.toString());
  if (query.limit) url.searchParams.set("limit", query.limit.toString());
  if (query.status) url.searchParams.set("status", query.status);
  if (query.search) url.searchParams.set("search", query.search);
  if (query.unread) url.searchParams.set("unread", "true");
  if (query.threadId) url.searchParams.set("threadId", query.threadId.toString());

  const result = await fetch(url.toString(), {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};