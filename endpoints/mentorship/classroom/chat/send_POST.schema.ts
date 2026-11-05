import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});
export type InputType = z.infer<typeof schema>;

export type ChatMessageOut = {
  id: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: Date;
};

export type OutputType = { message: ChatMessageOut };

export const postMentorshipClassroomChatSend = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/classroom/chat/send`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
