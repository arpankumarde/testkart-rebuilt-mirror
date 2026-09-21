import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { Kysely, sql } from "kysely";
import { DB } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const params = {
      status: url.searchParams.get("status"),
      sortBy: url.searchParams.get("sortBy"),
      sortOrder: url.searchParams.get("sortOrder"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    };

    const { status, sortBy, sortOrder, limit, offset } = schema.parse(params);

    let query = db.selectFrom("contactSubmissions");
    if (status) {
      query = query.where("status", "=", status);
    }

    let listQuery = query.selectAll();
    if (sortBy) {
      const direction = sortOrder === "desc" ? "desc" : "asc";
      listQuery = listQuery.orderBy(sortBy, sql`${sql.raw(direction)} nulls last`);
    }

    const submissions = await listQuery
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const totalResult = await query
      .select(db.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow();

    const responseData: OutputType = {
      submissions,
      total: parseInt(totalResult.count, 10),
    };

    return new Response(superjson.stringify(responseData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch contact submissions:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid query parameters", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}