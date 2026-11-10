import { z } from "zod";
import superjson from "superjson";
import type { ContentReportStatus } from "../../../helpers/schema";
import { CONTENT_REPORT_STATUS_VALUES } from "../../../helpers/contentReportTypes";

export const schema = z
  .object({
    id: z.number().int().positive(),
    status: z.enum(CONTENT_REPORT_STATUS_VALUES).optional(),
    adminNotes: z.string().max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: "Nothing to update",
  });

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  status: ContentReportStatus;
  adminNotes: string | null;
};

export const postAdminUpdateContentReport = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/admin/content-reports/update`, {
    method: "POST",
    body: superjson.stringify(validated),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const responseJson = superjson.parse(await result.text());
  if (!result.ok) {
    throw new Error((responseJson as { error?: string }).error || "Failed to update the report");
  }
  return responseJson as OutputType;
};