import { z } from "zod";
import superjson from "superjson";

export const CONTENT_VIEW_KINDS = ["exam_news", "current_affairs"] as const;
export type ContentViewKind = (typeof CONTENT_VIEW_KINDS)[number];

/** One visitor counts once per post in this window; the page and the server both apply it. */
export const CONTENT_VIEW_DEDUP_MINUTES = 30;

export const schema = z.object({
  kind: z.enum(CONTENT_VIEW_KINDS),
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

/** The count itself is admin-only and never returned here. */
export type OutputType = { counted: boolean };

export const postContentViewRecord = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/content-views/record`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    keepalive: true,
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
