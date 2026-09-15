import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, schema } from "./list_GET.schema";
import superjson from "superjson";
import { ExpressionBuilder } from "kysely";
import { DB } from "../../../helpers/schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    
    // Manually convert page and limit to numbers for zod parsing
    if (params.page) params.page = Number(params.page) as any;
    if (params.limit) params.limit = Number(params.limit) as any;

    const {
      search = "",
      page = 1,
      limit = 20,
      status = "all",
    } = schema.parse(params);

    const offset = (page - 1) * limit;

    const baseQuery = db
      .selectFrom("teacherBankDetails")
      .innerJoin("users", "teacherBankDetails.teacherId", "users.id");

    let detailsQuery = baseQuery
      .selectAll("teacherBankDetails")
      .select(["users.displayName as teacherName", "users.email as teacherEmail"])
      .orderBy("teacherBankDetails.updatedAt", "desc")
      .limit(limit)
      .offset(offset);

    let countQuery = baseQuery.select((eb) =>
      eb.fn.countAll<string>().as("count")
    );

    if (search) {
      const searchQuery = `%${search}%`;
      const searchFilter = (
        eb: ExpressionBuilder<DB, "teacherBankDetails" | "users">
      ) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
        ]);
      detailsQuery = detailsQuery.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    if (status !== "all") {
      detailsQuery = detailsQuery.where("teacherBankDetails.verificationStatus", "=", status);
      countQuery = countQuery.where("teacherBankDetails.verificationStatus", "=", status);
    }

    const [details, totalResult] = await Promise.all([
      detailsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
      bankDetails: details.map(d => ({
        ...d,
        teacherName: d.teacherName,
        teacherEmail: d.teacherEmail ?? 'N/A',
      })),
      totalCount,
      currentPage: page,
      totalPages,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching teacher bank details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}