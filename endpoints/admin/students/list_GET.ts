import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

function getStudentSortExpression(sortBy: string) {
  switch (sortBy) {
    case "name":
      return "users.displayName" as const;
    case "email":
      return "users.email" as const;
    case "createdAt":
      return "users.createdAt" as const;
    case "enrolledTestsCount":
      return sql`"enrolled_tests_count"`;
    case "totalSpent":
      return sql`"total_spent"`;
    default:
      return "users.createdAt" as const;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = (url.searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const baseQuery = db
      .selectFrom("users")
      .where("users.role", "=", "student");

    let studentsQuery = baseQuery
      .selectAll("users")
      .select([
        sql<string>`(
          SELECT COUNT(DISTINCT oi.mock_test_id)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.user_id = users.id AND o.status = 'completed'
        )`.as("enrolledTestsCount"),
        sql<string>`(
          SELECT COALESCE(SUM(o.total_amount), 0)
          FROM orders o
          WHERE o.user_id = users.id AND o.status = 'completed'
        )`.as("totalSpent"),
      ])
      .orderBy(getStudentSortExpression(sortBy), sortOrder)
      .limit(limit)
      .offset(offset);

    let countQuery = baseQuery.select((eb) =>
      eb.fn.countAll<string>().as("count")
    );

    if (search) {
      const searchQuery = `%${search}%`;
            studentsQuery = studentsQuery.where((eb) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
          eb("users.mobileNumber", "ilike", searchQuery),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
          eb("users.mobileNumber", "ilike", searchQuery),
        ])
      );
    }

    

    const [students, totalResult] = await Promise.all([
      studentsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
      students: students.map((s) => ({
        id: s.id,
        fullName: s.displayName,
        email: s.email ?? "N/A",
        mobileNumber: s.mobileNumber,
        createdAt: s.createdAt,
        isActive: s.isActive,
        enrolledTestsCount: parseInt(s.enrolledTestsCount as any, 10),
        totalSpent: parseFloat(s.totalSpent as any),
      })),
      totalCount,
      currentPage: page,
      totalPages,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching students list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}