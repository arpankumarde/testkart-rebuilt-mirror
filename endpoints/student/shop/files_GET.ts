import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./files_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const input = schema.parse(queryParams);

    // Verify purchase
    const purchase = await db
      .selectFrom("digitalProductPurchases")
      .select("id")
      .where("productId", "=", input.productId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (!purchase) {
      return new Response(
        superjson.stringify({ error: "Purchase not found or unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Query files, leaving out secure attributes like fileUrl and fileId
    const files = await db
      .selectFrom("digitalProductFiles")
      .select(["id", "title", "fileSizeBytes", "pageCount", "orderIndex"])
      .where("productId", "=", input.productId)
      .orderBy("orderIndex", "asc")
      .execute();

    // Mapping to parse fileSizeBytes since Kysely might return it as a string for int8
    const outputFiles = files.map(f => ({
      id: f.id,
      title: f.title,
      fileSizeBytes: f.fileSizeBytes ? Number(f.fileSizeBytes) : null,
      pageCount: f.pageCount,
      orderIndex: f.orderIndex
    }));

    return new Response(
      superjson.stringify({ files: outputFiles } satisfies OutputType),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching product files:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch files", details: errorMessage }),
      { status: error instanceof Error && error.name === "ZodError" ? 400 : 500, headers: { "Content-Type": "application/json" } }
    );
  }
}