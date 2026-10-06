import { sql, RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { containsPattern, orderNullsLast, pageWindow } from "../../../helpers/adminCatalogueListQuery";
import { schema, OutputType, NotesSortColumn } from "./page_GET.schema";
import superjson from "superjson";

// digitalProductRules' real-file rule, kept identical to the catalogue dashboard's
// notes_without_file count so its tile lands on the same rows.
const hasRealFile = sql<boolean>`CASE
  WHEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = digital_products.id)
  THEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = digital_products.id
    AND btrim(f.file_url) <> '' AND strpos(lower(f.file_url), 'placeholder') = 0)
  ELSE btrim(digital_products.pdf_url) <> '' AND strpos(lower(digital_products.pdf_url), 'placeholder') = 0
END`;

/* Text sorts ignore case; a blank category sorts with the empty values at the bottom. */
const SORT_EXPRESSIONS: Record<NotesSortColumn, RawBuilder<unknown>> = {
  title: sql`lower(${sql.ref("digitalProducts.title")})`,
  status: sql`${sql.ref("digitalProducts.status")}`,
  category: sql`nullif(lower(btrim(${sql.ref("digitalProducts.category")})), '')`,
  price: sql`${sql.ref("digitalProducts.price")}`,
  sales: sql`${sql.ref("digitalProducts.totalPurchases")}`,
  createdAt: sql`${sql.ref("digitalProducts.createdAt")}`,
};

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));

    let filtered = db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId");
    if (input.status) filtered = filtered.where("digitalProducts.status", "=", input.status);
    if (input.filter === "no-file") filtered = filtered.where(sql<boolean>`NOT (${hasRealFile})`);
    if (input.id) filtered = filtered.where("digitalProducts.id", "=", input.id);
    if (input.search) {
      const pattern = containsPattern(input.search);
      filtered = filtered.where((eb) =>
        eb.or([eb("digitalProducts.title", "ilike", pattern), eb("users.displayName", "ilike", pattern)])
      );
    }

    const totalRow = await filtered
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .executeTakeFirst();
    const total = Number(totalRow?.total ?? 0);
    const paging = pageWindow(input.page, total);

    const sortExpression = SORT_EXPRESSIONS[input.sortBy ?? "createdAt"];
    const sortOrder = input.sortBy ? input.sortOrder ?? "asc" : "desc";

    const rows = await filtered
      .select([
        "digitalProducts.id",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.status",
        "digitalProducts.createdAt",
        "digitalProducts.price",
        "digitalProducts.totalPurchases",
        "digitalProducts.category",
        "users.displayName as teacherName",
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
      .orderBy(orderNullsLast(sortExpression, sortOrder))
      .orderBy("digitalProducts.id", "desc")
      .limit(paging.limit)
      .offset(paging.offset)
      .execute();

    const statusRows = await db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .select(["digitalProducts.status"])
      .select((eb) => eb.fn.countAll<string>().as("cnt"))
      .groupBy("digitalProducts.status")
      .execute();
    const countFor = (status: string) =>
      Number(statusRows.find((row) => row.status === status)?.cnt ?? 0);

    const output: OutputType = {
      items: rows.map((row) => ({
        ...row,
        price: Number(row.price),
        filesCount: Number(row.filesCount ?? 0),
        totalPages: Number(row.totalPages ?? 0),
      })),
      total,
      page: paging.page,
      totalPages: paging.totalPages,
      statusCounts: {
        all: statusRows.reduce((sum, row) => sum + Number(row.cnt), 0),
        published: countFor("published"),
        draft: countFor("draft"),
        archived: countFor("archived"),
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin notes page:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}