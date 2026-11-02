import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { hasAdminModule } from "../../../helpers/adminPermissions";
import { EXPIRY_CONTENT_TYPES, loadExpiryRows } from "../../../helpers/contentExpiryServer";
import {
  EXPIRY_ADMIN_MODULE,
  expiryLastDay,
  isExpired,
  isPastExpiry,
  listingStatus,
} from "../../../helpers/contentExpiry";
import { schema, type AdminExpiryItem, type ExpiryFilter, type OutputType } from "./list_GET.schema";

const PAGE_SIZE = 25;

const matchesFilter = (item: AdminExpiryItem, filter: ExpiryFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "expired":
      return item.status === "expired";
    case "expiring_soon":
      return item.status === "expiring_soon";
    case "active":
      return item.status !== "expired" && item.status !== "expiring_soon";
  }
};

/* Every teacher item with an expiry date, for the admin Product expiry page. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse({
      filter: url.searchParams.get("filter") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });

    const types = EXPIRY_CONTENT_TYPES.filter((type) => hasAdminModule(admin.permissions, [EXPIRY_ADMIN_MODULE[type]]));
    const now = new Date();
    const all: AdminExpiryItem[] = (await loadExpiryRows(types)).map((row) => {
      const fields = { expiresAt: row.expiresAt, expiredAt: row.expiredAt };
      return {
        contentType: row.contentType,
        id: row.id,
        title: row.title,
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        live: row.live,
        visibility: row.visibility,
        expiryDay: row.expiresAt ? expiryLastDay(row.expiresAt) : null,
        expiresAt: row.expiresAt,
        expiredAt: row.expiredAt,
        relistVisibility: row.preExpiryVisibility ?? "public",
        status: listingStatus({ ...fields, live: row.live, visibility: row.visibility }, now),
        canRelist: isExpired(fields, now) && !isPastExpiry(row.expiresAt, now),
      };
    });

    const search = input.search?.toLowerCase();
    const scoped = all.filter(
      (item) =>
        (input.type === "all" || item.contentType === input.type) &&
        (!search ||
          item.title.toLowerCase().includes(search) ||
          (item.teacherName ?? "").toLowerCase().includes(search))
    );
    const counts = {
      all: scoped.length,
      active: scoped.filter((i) => matchesFilter(i, "active")).length,
      expiring_soon: scoped.filter((i) => matchesFilter(i, "expiring_soon")).length,
      expired: scoped.filter((i) => matchesFilter(i, "expired")).length,
    };
    const filtered = scoped.filter((item) => matchesFilter(item, input.filter));
    if (input.filter !== "expired") {
      filtered.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(input.page, totalPages);
    const output: OutputType = {
      items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      counts,
      types,
      page,
      totalPages,
      total: filtered.length,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing content expiry:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : error instanceof Error && error.name === "ForbiddenError" ? 403 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}