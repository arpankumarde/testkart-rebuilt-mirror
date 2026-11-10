import { z } from "zod";
import superjson from "superjson";
import type {
  ContentReportCategory,
  ContentReportCopyrightMaterial,
  ContentReportStatus,
} from "../../../helpers/schema";
import {
  CONTENT_REPORT_CATEGORY_VALUES,
  CONTENT_REPORT_STATUS_VALUES,
  CONTENT_REPORT_TYPE_VALUES,
} from "../../../helpers/contentReportTypes";

export const schema = z.object({
  status: z.enum(CONTENT_REPORT_STATUS_VALUES).optional().nullable(),
  contentType: z.enum(CONTENT_REPORT_TYPE_VALUES).optional().nullable(),
  category: z.enum(CONTENT_REPORT_CATEGORY_VALUES).optional().nullable(),
  search: z.string().trim().max(200).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type InputType = z.infer<typeof schema>;

export type AdminContentReport = {
  id: number;
  contentType: string;
  contentId: number | null;
  contentSlug: string | null;
  parentSlug: string | null;
  pageUrl: string;
  pageTitle: string | null;
  category: ContentReportCategory;
  description: string;
  locationHint: string | null;
  detectedSection: string | null;
  selectedText: string | null;
  suggestedCorrection: string | null;
  reporterEmail: string | null;
  reporterName: string | null;
  reporterPhone: string | null;
  reporterUserId: number | null;
  reporterUserName: string | null;
  copyrightMaterialType: ContentReportCopyrightMaterial | null;
  copyrightMaterialLocation: string | null;
  copyrightOriginalSource: string | null;
  captchaVerifiedAt: Date | null;
  status: ContentReportStatus;
  adminNotes: string | null;
  reviewedByName: string | null;
  statusChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OutputType = {
  reports: AdminContentReport[];
  total: number;
  /** Per status, under the type, category and search filters but not the status one. */
  statusCounts: Record<ContentReportStatus, number>;
};

export const getAdminContentReports = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const query = new URLSearchParams();
  if (validated.status) query.set("status", validated.status);
  if (validated.contentType) query.set("contentType", validated.contentType);
  if (validated.category) query.set("category", validated.category);
  if (validated.search) query.set("search", validated.search);
  query.set("limit", String(validated.limit));
  query.set("offset", String(validated.offset));

  const result = await fetch(`/_api/admin/content-reports/list?${query.toString()}`, {
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