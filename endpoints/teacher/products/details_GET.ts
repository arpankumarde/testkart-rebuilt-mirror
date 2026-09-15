import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./details_GET.schema";
import superjson from "superjson";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";

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
    const idParam = url.searchParams.get("id");
    
    if (!idParam) {
      return new Response(
        superjson.stringify({ error: "Product ID is required" }),
        { status: 400 }
      );
    }

    const input = schema.parse({ id: Number(idParam) });

    const product = await db
      .selectFrom("digitalProducts")
      .selectAll()
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // Fetch associated files
    const productFiles = await db
      .selectFrom("digitalProductFiles")
      .selectAll()
      .where("productId", "=", input.id)
      .orderBy("orderIndex", "asc")
      .execute();

    const files: DigitalProductFileItem[] = productFiles.map((f) => ({
      id: f.id,
      title: f.title,
      fileUrl: f.fileUrl,
      fileId: f.fileId,
      fileSizeBytes: f.fileSizeBytes ? Number(f.fileSizeBytes) : null,
      pageCount: f.pageCount,
      orderIndex: f.orderIndex,
    }));

    const output: OutputType = {
      ...product,
      price: Number(product.price),
      rating: product.rating ? Number(product.rating) : null,
      fileSizeBytes: product.fileSizeBytes ? Number(product.fileSizeBytes) : null,
      files,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching product details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch product details", details: errorMessage }),
      { status: 500 }
    );
  }
}