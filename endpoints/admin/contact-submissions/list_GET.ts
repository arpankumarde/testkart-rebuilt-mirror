import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { Kysely } from "kysely";
import { DB } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const params = {
      status: url.searchParams.get("status"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    };

    const { status, limit, offset } = schema.parse(params);

    let query = db.selectFrom("contactSubmissions");
    if (status) {
      query = query.where("status", "=", status);
    }

    const submissions = await query
      .selectAll()
      .orderBy("createdAt", "desc")
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