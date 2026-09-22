import { db } from "../../../helpers/db";
import { sql } from "kysely";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { pendingReviewIds } from "../../../helpers/contentReviewQueue";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const queryInput = {
      status: searchParams.get("status") || undefined,
      category: searchParams.get("category") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
    };
    
    const input = schema.parse(queryInput);

    let query = db
      .selectFrom("digitalProducts")
      .selectAll()
      .where("teacherId", "=", effectiveTeacherId);

    if (input.status) {
      query = query.where("status", "=", input.status);
    }

    if (input.category) {
      query = query.where("category", "=", input.category);
    }

    if (input.search) {
      const pattern = `%${input.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      query = query.where((eb) =>
        eb.or([
          eb("title", "ilike", pattern),
          eb("category", "ilike", pattern),
          eb("examName", "ilike", pattern),
        ])
      );
    }

    const offset = (input.page - 1) * input.limit;

    // The total rides on each row so the list and its count cost one round trip.
    const rows = await query
      .select(sql<string>`count(*) over()`.as("totalCount"))
      .orderBy("createdAt", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute();

    const total = rows.length > 0 ? Number(rows[0].totalCount) : 0;
    const products = rows.map(({ totalCount: _totalCount, ...product }) => product);

    const inReview = await pendingReviewIds(db, "digital_product", products.map((p) => p.id));

    const output: OutputType = {
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        rating: p.rating ? Number(p.rating) : null,
        fileSizeBytes: p.fileSizeBytes ? Number(p.fileSizeBytes) : null,
        inReview: inReview.has(p.id),
      })),
      page: input.page,
      limit: input.limit,
      total,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing teacher products:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to list products", details: errorMessage }),
      { status: 500 }
    );
  }
}