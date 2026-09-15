import { z } from "zod";
import superjson from "superjson";

const filtersSchema = z.object({
  examId: z.number().optional(),
  teacherId: z.number().optional(),
  hasCustomPrompt: z.boolean().optional(),
  dateFrom: z.string().optional(), // Using string to pass dates easily
  dateTo: z.string().optional(),
  markedForReview: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

export const schema = z.object({
  ids: z.array(z.number()).optional(),
  filters: filtersSchema.optional(),
});

export type InputType = z.infer<typeof schema>;

// Output is a file buffer, not JSON
export type OutputType = Blob;

export const postAdminBulkExportAIQuestions = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/ai-questions/bulk-export`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    // Cannot parse JSON error here as it might not be JSON
    throw new Error("Failed to export questions.");
  }
  return result.blob();
};