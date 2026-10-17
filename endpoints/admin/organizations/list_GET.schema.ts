import { z } from "zod";
import superjson from "superjson";
import type { OrganizationTypeValue } from "../../teacher/organizations/create_POST.schema";

export const ADMIN_ORGANIZATION_SORTS = [
  "name",
  "createdAt",
  "teachersCount",
  "resourcesCount",
  "followersCount",
  "reviewsCount",
] as const;

export type AdminOrganizationSort = (typeof ADMIN_ORGANIZATION_SORTS)[number];

export const schema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(ADMIN_ORGANIZATION_SORTS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  orgType: z.enum(["all", "coaching", "school", "college", "university", "other"]).optional(),
  status: z.enum(["all", "active", "hidden"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  orgType: OrganizationTypeValue;
  logoUrl: string | null;
  location: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  ownerId: number | null;
  claimStatus: "unclaimed" | "pending_verification" | "claimed";
  ownerName: string | null;
  ownerEmail: string | null;
  // Approved members; pendingCount is join requests still waiting.
  teachersCount: number;
  pendingCount: number;
  // Published courses, bundles, mock tests and study notes by approved members.
  resourcesCount: number;
  followersCount: number;
  reviewsCount: number;
  averageRating: number | null;
};

export type OutputType = {
  organizations: AdminOrganizationRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  // Matches per type for the current search and status, for the type tabs.
  typeCounts: Record<OrganizationTypeValue | "all", number>;
};

export const getAdminOrganizationsList = async (params: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params.orgType) query.set("orgType", params.orgType);
  if (params.status) query.set("status", params.status);

  const result = await fetch(`/_api/admin/organizations/list?${query.toString()}`, {
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