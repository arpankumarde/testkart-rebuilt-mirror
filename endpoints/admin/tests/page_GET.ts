import { sql, RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { containsPattern, orderNullsLast, pageWindow } from "../../../helpers/adminCatalogueListQuery";
import { schema, OutputType, TestSeriesSortColumn } from "./page_GET.schema";
import superjson from "superjson";

// Live counts with the catalogue dashboard's conditions, so its empty-series and
// tests-without-questions tiles land on the same rows here.
const liveItemCount = sql<string>`(SELECT count(*) FROM mock_test_items i
  WHERE i.package_id = mock_tests.id AND i.deleted_at IS NULL)`;
const emptyTestCount = sql<string>`(SELECT count(*) FROM mock_test_items i
  WHERE i.package_id = mock_tests.id AND i.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM test_questions q WHERE q.test_id = i.id))`;
const completedOrders = sql<string>`(SELECT count(*) FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.mock_test_id = mock_tests.id AND o.status = 'completed')`;

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));

    let filtered = db.selectFrom("mockTests").innerJoin("users", "users.id", "mockTests.teacherId");
    if (input.status === "published") filtered = filtered.where("mockTests.isPublished", "=", true);
    if (input.status === "unpublished") filtered = filtered.where(sql<boolean>`mock_tests.is_published IS NOT TRUE`);
    if (input.filter) {
      filtered = filtered
        .where("mockTests.isPublished", "=", true)
        .where("mockTests.deletedAt", "is", null)
        .where(input.filter === "no-tests" ? sql<boolean>`${liveItemCount} = 0` : sql<boolean>`${emptyTestCount} > 0`);
    }
    if (input.id) filtered = filtered.where("mockTests.id", "=", input.id);
    if (input.search) {
      const pattern = containsPattern(input.search);
      filtered = filtered.where((eb) =>
        eb.or([eb("mockTests.title", "ilike", pattern), eb("users.displayName", "ilike", pattern)])
      );
    }

    const totals = await filtered
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .$if(input.filter === "empty-tests", (qb) =>
        qb.select(sql<string>`coalesce(sum(${emptyTestCount}), 0)`.as("emptyTests"))
      )
      .executeTakeFirst();
    const total = Number(totals?.total ?? 0);
    const paging = pageWindow(input.page, total);

    // Dashboard subsets show the live item count in the Tests column, so they sort by it too.
    const sortExpressions: Record<TestSeriesSortColumn, RawBuilder<unknown>> = {
      title: sql`lower(${sql.ref("mockTests.title")})`,
      students: sql`${sql.ref("mockTests.studentsEnrolled")}`,
      tests: input.filter ? liveItemCount : sql`${sql.ref("mockTests.totalTests")}`,
      price: sql`${sql.ref("mockTests.price")}`,
      createdAt: sql`${sql.ref("mockTests.createdAt")}`,
    };
    const sortOrder = input.sortBy ? input.sortOrder ?? "asc" : "desc";

    const rows = await filtered
      .select([
        "mockTests.id",
        "mockTests.title",
        "mockTests.slug",
        "mockTests.isPublished",
        "mockTests.createdAt",
        "mockTests.studentsEnrolled",
        "mockTests.totalTests",
        "mockTests.totalQuestions",
        "mockTests.isFree",
        "mockTests.price",
        "users.displayName as teacherName",
      ])
      .select([
        completedOrders.as("totalOrders"),
        liveItemCount.as("liveItemCount"),
        emptyTestCount.as("emptyTestCount"),
      ])
      .orderBy(orderNullsLast(sortExpressions[input.sortBy ?? "createdAt"], sortOrder))
      .orderBy("mockTests.id", "desc")
      .limit(paging.limit)
      .offset(paging.offset)
      .execute();

    const statusRows = await db
      .selectFrom("mockTests")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .select(sql<boolean>`mock_tests.is_published IS TRUE`.as("published"))
      .select((eb) => eb.fn.countAll<string>().as("cnt"))
      .groupBy(sql`mock_tests.is_published IS TRUE`)
      .execute();
    const published = Number(statusRows.find((row) => row.published)?.cnt ?? 0);
    const unpublished = Number(statusRows.find((row) => !row.published)?.cnt ?? 0);

    const output: OutputType = {
      items: rows.map((row) => ({
        ...row,
        isPublished: row.isPublished === true,
        studentsEnrolled: Number(row.studentsEnrolled ?? 0),
        totalTests: Number(row.totalTests ?? 0),
        totalQuestions: Number(row.totalQuestions ?? 0),
        price: Number(row.price),
        totalOrders: Number(row.totalOrders ?? 0),
        liveItemCount: Number(row.liveItemCount ?? 0),
        emptyTestCount: Number(row.emptyTestCount ?? 0),
      })),
      total,
      page: paging.page,
      totalPages: paging.totalPages,
      statusCounts: { all: published + unpublished, published, unpublished },
      emptyTestTotal:
        input.filter === "empty-tests" && totals && "emptyTests" in totals ? Number(totals.emptyTests) : null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin test series page:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}