import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const { page, limit, status } = schema.parse({
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "10",
      status: url.searchParams.get("status"),
    });

    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("promoCodes")
      .where("createdByTeacherId", "=", effectiveTeacherId);

    if (status) {
      const now = new Date();
      if (status === "active") {
        query = query.where("isActive", "=", true)
                     .where("validFrom", "<=", now)
                     .where((eb) => eb.or([
                         eb("validUntil", "is", null),
                         eb("validUntil", ">", now)
                     ]));
      } else if (status === "scheduled") {
        query = query.where("isActive", "=", true)
                     .where("validFrom", ">", now);
      } else if (status === "expired") {
        query = query.where((eb) => eb.or([
            eb("isActive", "=", false),
            eb("validUntil", "<=", now)
        ]));
      }
    }

    const promoCodes = await query
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const totalResult = await query
      .clearSelect()
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow();

    const total = parseInt(totalResult.count, 10);

    return new Response(
      superjson.stringify({ promoCodes, total } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to list promo codes:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to list promo codes", details: errorMessage }), { status: 500 });
  }
}