import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogComments } from "../../../../helpers/schema";

export const schema = z.object({
  status: z.enum(["approved", "pending", "rejected"]).optional(),
  postId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.infer<typeof schema>;

export type AdminCommentListItem = Selectable<BlogComments> & {
  authorName: string;
  authorAvatar: string | null;
  postTitle: string;
};

export type OutputType = {
  comments: AdminCommentListItem[];
  total: number;
  totalPages: number;
};

export const getAdminBlogCommentsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.status) params.append("status", input.status);
  if (input.postId) params.append("postId", input.postId.toString());
  if (input.page) params.append("page", input.page.toString());
  if (input.limit) params.append("limit", input.limit.toString());

  const result = await fetch(`/_api/admin/blog/comments/list?${params.toString()}`, {
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