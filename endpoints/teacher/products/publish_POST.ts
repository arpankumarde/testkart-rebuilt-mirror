import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { getProductPublishIssues, formatPublishIssues } from "../../../helpers/digitalProductRules";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const product = await db
      .selectFrom("digitalProducts")
      .select(["id", "teacherId", "pdfUrl", "price", "title", "description", "status"])
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    if (product.status === "published") {
      return new Response(
        superjson.stringify({ error: "Product is already published" }),
        { status: 400 }
      );
    }

    const files = await db
      .selectFrom("digitalProductFiles")
      .select("fileUrl")
      .where("productId", "=", input.id)
      .execute();

    const issues = getProductPublishIssues({ ...product, fileUrls: files.map((f) => f.fileUrl) });
    if (issues.length > 0) {
      return new Response(
        superjson.stringify({ error: `Cannot publish yet. ${formatPublishIssues(issues)}.` }),
        { status: 400 }
      );
    }

    // Publish the product directly
    await db
      .updateTable("digitalProducts")
      .set({
        status: "published",
        isPublished: true,
        publishedAt: new Date(),
      })
      .where("id", "=", input.id)
      .execute();

    console.log(`Digital product ${input.id} published by teacher ${product.teacherId}`);

    const output: OutputType = {
      success: true,
      message: "Your product has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to publish product", details: errorMessage }),
      { status: 500 }
    );
  }
}