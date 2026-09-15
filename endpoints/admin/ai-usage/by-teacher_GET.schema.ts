import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  searchQuery: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherAiUsageRow = {
  teacherId: number;
  teacherName: string;
  academyName: string | null;
  email: string;
  isVerified: boolean;
  totalAttempts: number;
  doneCount: number;
  pendingCount: number;
  failedCount: number;
  lastUsedAt: string;
};

export type OutputType = {
  teachers: TeacherAiUsageRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export const getAdminAiUsageByTeacher = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
    }
  });

  const result = await fetch(`/_api/admin/ai-usage/by-teacher?${searchParams.toString()}`, {
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
