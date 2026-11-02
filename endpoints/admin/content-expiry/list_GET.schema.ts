import { z } from "zod";
import superjson from "superjson";
import type { ContentType, ContentVisibility } from "../../../helpers/schema";
import type { ListingStatus } from "../../../helpers/contentExpiry";

export const EXPIRY_FILTERS = ["all", "active", "expiring_soon", "expired"] as const;
export type ExpiryFilter = (typeof EXPIRY_FILTERS)[number];

export const EXPIRY_TYPE_FILTERS = ["all", "mock_test", "course", "digital_product", "live_test", "course_bundle"] as const;

export const schema = z.object({
  filter: z.enum(EXPIRY_FILTERS).default("all"),
  type: z.enum(EXPIRY_TYPE_FILTERS).default("all"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type InputType = z.input<typeof schema>;

export type AdminExpiryItem = {
  contentType: ContentType;
  id: number;
  title: string;
  teacherId: number;
  teacherName: string | null;
  live: boolean;
  visibility: ContentVisibility;
  /** Last day on sale (YYYY-MM-DD, IST), or null when the date was removed after expiry. */
  expiryDay: string | null;
  expiresAt: Date | null;
  /** When the item was unlisted automatically; null while it has not expired. */
  expiredAt: Date | null;
  /** The visibility Relist restores. */
  relistVisibility: ContentVisibility;
  status: ListingStatus;
  canRelist: boolean;
};

export type OutputType = {
  items: AdminExpiryItem[];
  /** Rows per filter tab, before the type and search filters are applied to them. */
  counts: Record<ExpiryFilter, number>;
  /** Content types this admin may see and change. */
  types: ContentType[];
  page: number;
  totalPages: number;
  total: number;
};

export const getAdminContentExpiryList = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const query = new URLSearchParams({
    filter: validated.filter,
    type: validated.type,
    page: String(validated.page),
  });
  if (validated.search) query.set("search", validated.search);
  const result = await fetch(`/_api/admin/content-expiry/list?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
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