import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  status: z.enum(["pending", "done", "failed"]).optional(),
  feature: z.enum(["question_generation", "rewrite", "generate_all"]).optional(),
  teacherId: z.number().optional(),
  searchQuery: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export type InputType = z.infer<typeof schema>;

export type AiUsageLogRow = {
  id: number;
  teacherId: number;
  teacherName: string;
  feature: string;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type OutputType = {
  logs: AiUsageLogRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export const getAdminAiUsageLogs = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
    }
  });

  const result = await fetch(`/_api/admin/ai-usage/logs?${searchParams.toString()}`, {
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
