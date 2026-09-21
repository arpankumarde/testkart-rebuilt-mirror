import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const products = await db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .select([
        "digitalProducts.id",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.status",
        "digitalProducts.createdAt",
        "digitalProducts.price",
        "digitalProducts.totalPurchases",
        "digitalProducts.category",
        "digitalProducts.isPublished",
        "users.displayName as teacherName",
        "users.id as teacherId",
      ])
      .select((eb) =>
        eb
          .selectFrom("digitalProductFiles")
          .whereRef("digitalProductFiles.productId", "=", "digitalProducts.id")
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("filesCount")
      )
      .select((eb) =>
        eb
          .selectFrom("digitalProductFiles")
          .whereRef("digitalProductFiles.productId", "=", "digitalProducts.id")
          .select((eb2) => eb2.fn.sum<string>("digitalProductFiles.pageCount").as("sum"))
          .as("totalPages")
      )
      // digitalProductRules' real-file rule, kept identical to the catalogue dashboard's
      // notes_without_file count so its tile lands on the same rows.
      .select(
        sql<boolean>`CASE
          WHEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = digital_products.id)
          THEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = digital_products.id
            AND btrim(f.file_url) <> '' AND strpos(lower(f.file_url), 'placeholder') = 0)
          ELSE btrim(digital_products.pdf_url) <> '' AND strpos(lower(digital_products.pdf_url), 'placeholder') = 0
        END`.as("hasRealFile")
      )
      .orderBy("digitalProducts.createdAt", "desc")
      .execute();

    const output: OutputType = products.map((product) => ({
      ...product,
      price: Number(product.price),
      filesCount: Number(product.filesCount ?? 0),
      totalPages: Number(product.totalPages ?? 0),
      hasRealFile: product.hasRealFile === true,
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin products list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}