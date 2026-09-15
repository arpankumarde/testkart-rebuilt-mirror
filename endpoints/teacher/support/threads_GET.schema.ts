import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportThreads } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
  /* Only threads with an admin message the teacher has not read - the dashboard's unread support count. */
  unreadOnly: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
});

export type InputType = z.infer<typeof schema>;

export type SupportThreadWithUnread = Selectable<SupportThreads> & {
  unreadCount: number;
};

export type OutputType = {
  threads: SupportThreadWithUnread[];
  totalCount: number;
  page: number;
  limit: number;
};

export const getTeacherSupportThreads = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const url = new URL("/_api/teacher/support/threads", window.location.origin);
  if (query.page) url.searchParams.set("page", query.page.toString());
  if (query.limit) url.searchParams.set("limit", query.limit.toString());
  if (query.unreadOnly) url.searchParams.set("unreadOnly", "true");

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