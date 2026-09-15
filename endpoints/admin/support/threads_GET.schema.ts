import { z } from "zod";
import superjson from 'superjson';
import { SupportThreadStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
  status: z.enum(SupportThreadStatusArrayValues).optional(),
  search: z.string().optional(),
  /* Only threads holding a teacher message nobody on the team has read yet. */
  unread: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
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
  teacherId: number | null;
  unreadCount: number;
  lastMessagePreview: string;
};

export type OutputType = {
  threads: AdminSupportThread[];
  totalCount: number;
  page: number;
  limit: number;
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