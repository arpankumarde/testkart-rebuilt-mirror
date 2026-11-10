import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
  /** Returns messages posted after this message (by time, then id), for incremental catch-up polling. */
  afterId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type InputType = z.infer<typeof schema>;

export type ChatMessageOut = {
  id: string;
  senderId: number;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: Date;
};

export type OutputType = { messages: ChatMessageOut[] };

export const getMentorshipClassroomChatList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, id: String(input.id) });
  if (input.afterId) params.set("afterId", String(input.afterId));
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/mentorship/classroom/chat/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
