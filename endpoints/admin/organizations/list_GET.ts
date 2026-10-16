import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { ForbiddenError, getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { schema, type AdminOrganizationRow, type OutputType } from "./list_GET.schema";

// Per-organisation figures as correlated subqueries on organizations.id.
const teachersCountSql = sql<string>`(
  SELECT COUNT(*) FROM organization_teachers ot
  WHERE ot.organization_id = organizations.id AND ot.status = 'approved'
)`;

const pendingCountSql = sql<string>`(
  SELECT COUNT(*) FROM organization_teachers ot
  WHERE ot.organization_id = organizations.id AND ot.status = 'pending'
)`;

// Same items the public profile lists: published content by approved members.
const resourcesCountSql = sql<string>`(
  WITH members AS (
    SELECT ot.teacher_id FROM organization_teachers ot
    WHERE ot.organization_id = organizations.id AND ot.status = 'approved'
  )
  SELECT
    (SELECT COUNT(*) FROM courses c WHERE c.status = 'published' AND c.teacher_id IN (SELECT teacher_id FROM members))
    + (SELECT COUNT(*) FROM mock_tests m WHERE m.is_published AND m.deleted_at IS NULL AND m.teacher_id IN (SELECT teacher_id FROM members))
    + (SELECT COUNT(*) FROM digital_products d WHERE d.status = 'published' AND d.teacher_id IN (SELECT teacher_id FROM members))
    + (SELECT COUNT(*) FROM course_bundles b WHERE b.is_published AND b.teacher_id IN (SELECT teacher_id FROM members))
)`;

const followersCountSql = sql<string>`(
  SELECT COUNT(*) FROM organization_follows f WHERE f.organization_id = organizations.id
)`;

const reviewsCountSql = sql<string>`(
  SELECT COUNT(*) FROM organization_reviews r WHERE r.organization_id = organizations.id
)`;

const averageRatingSql = sql<string | null>`(
  SELECT AVG(r.rating) FROM organization_reviews r WHERE r.organization_id = organizations.id
)`;

const SORT_EXPRESSIONS = {
  name: sql`lower(organizations.name)`,
  createdAt: sql`organizations.created_at`,
  teachersCount: sql`"teachers_count"`,
  resourcesCount: sql`"resources_count"`,
  followersCount: sql`"followers_count"`,
  reviewsCount: sql`"reviews_count"`,
} as const;

const errorResponse = (error: unknown) => {
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 500;
  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return new Response(superjson.stringify({ error: message }), { status });
};

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams));
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const sortBy = input.sortBy ?? "createdAt";
    const sortOrder = input.sortOrder ?? "desc";
    const orgType = input.orgType ?? "all";
    const status = input.status ?? "all";
    const search = input.search ?? "";

    // Search and status apply to everything; the type filter is applied after
    // the per-type counts so the tabs show what each type would return.
    // left join: auto-imported ("unclaimed") organisations have no owner yet
    // (createdByTeacherId is null) and must still show up in this list.
    let filtered = db
      .selectFrom("organizations")
      .leftJoin("users as owner", "owner.id", "organizations.createdByTeacherId");

    if (status === "active") filtered = filtered.where("organizations.isActive", "=", true);
    if (status === "hidden") filtered = filtered.where("organizations.isActive", "=", false);

    if (search) {
      const pattern = `%${search}%`;
      filtered = filtered.where((eb) =>
        eb.or([
          eb("organizations.name", "ilike", pattern),
          eb("organizations.slug", "ilike", pattern),
          eb("organizations.location", "ilike", pattern),
          eb("organizations.phoneNumber", "ilike", pattern),
          eb("owner.displayName", "ilike", pattern),
          eb("owner.email", "ilike", pattern),
        ])
      );
    }

    const typed = orgType === "all" ? filtered : filtered.where("organizations.orgType", "=", orgType);

    const [rows, typeRows] = await Promise.all([
      typed
        .select([
          "organizations.id",
          "organizations.name",
          "organizations.slug",
          "organizations.orgType",
          "organizations.logoUrl",
          "organizations.location",
          "organizations.phoneNumber",
          "organizations.websiteUrl",
          "organizations.isActive",
          "organizations.createdAt",
          "organizations.createdByTeacherId",
          "organizations.claimStatus",
          "owner.displayName as ownerName",
          "owner.email as ownerEmail",
          // camelCase aliases: the db's CamelCasePlugin maps them to the
          // snake_case names SORT_EXPRESSIONS orders by.
          teachersCountSql.as("teachersCount"),
          pendingCountSql.as("pendingCount"),
          resourcesCountSql.as("resourcesCount"),
          followersCountSql.as("followersCount"),
          reviewsCountSql.as("reviewsCount"),
          averageRatingSql.as("averageRating"),
        ])
        .orderBy(SORT_EXPRESSIONS[sortBy], sortOrder)
        .orderBy("organizations.id", "desc")
        .limit(limit)
        .offset((page - 1) * limit)
        .execute(),
      filtered
        .select((eb) => ["organizations.orgType", eb.fn.countAll<string>().as("count")])
        .groupBy("organizations.orgType")
        .execute(),
    ]);

    const typeCounts: OutputType["typeCounts"] = { all: 0, coaching: 0, school: 0, college: 0, university: 0, other: 0 };
    for (const row of typeRows) {
      const count = Number(row.count);
      typeCounts[row.orgType] = count;
      typeCounts.all += count;
    }
    const totalCount = orgType === "all" ? typeCounts.all : typeCounts[orgType];

    const organizations: AdminOrganizationRow[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      orgType: row.orgType,
      logoUrl: row.logoUrl,
      location: row.location,
      phoneNumber: row.phoneNumber,
      websiteUrl: row.websiteUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      ownerId: row.createdByTeacherId,
      claimStatus: row.claimStatus,
      ownerName: row.ownerName,
      ownerEmail: row.ownerEmail,
      teachersCount: Number(row.teachersCount ?? 0),
      pendingCount: Number(row.pendingCount ?? 0),
      resourcesCount: Number(row.resourcesCount ?? 0),
      followersCount: Number(row.followersCount ?? 0),
      reviewsCount: Number(row.reviewsCount ?? 0),
      averageRating: row.averageRating != null ? Number(row.averageRating) : null,
    }));

    const output: OutputType = {
      organizations,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      typeCounts,
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error fetching admin organizations list:", error);
    return errorResponse(error);
  }
}