import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow, ForbiddenError, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { containsPattern, pageWindow } from "../../../helpers/adminCatalogueListQuery";
import { permittedPriceHistoryTypes } from "../../../helpers/productPriceHistory";
import { PRICE_HISTORY_COLUMNS, priceHistoryRows, toPriceHistoryEntry } from "../../../helpers/productPriceHistoryQuery";
import { schema, OutputType } from "./list_GET.schema";

const istDayStart = (day: string) => sql<Date>`(${day}::date)::timestamp at time zone 'Asia/Kolkata'`;
const istDayEnd = (day: string) => sql<Date>`(${day}::date + 1)::timestamp at time zone 'Asia/Kolkata'`;

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const allowed = permittedPriceHistoryTypes(admin.permissions);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));

    if (allowed.length === 0 || (input.productType && !allowed.includes(input.productType))) {
      return new Response(
        superjson.stringify({ error: "Your admin account does not have access to this product type's price history." }),
        { status: 403 }
      );
    }

    let filtered = priceHistoryRows(db).where("h.productType", "in", input.productType ? [input.productType] : allowed);
    if (input.teacherId) filtered = filtered.where("h.teacherId", "=", input.teacherId);
    if (input.search) {
      const pattern = containsPattern(input.search);
      filtered = filtered.where((eb) =>
        eb.or([
          eb("h.productTitle", "ilike", pattern),
          eb("teacher.displayName", "ilike", pattern),
          eb("teacher.email", "ilike", pattern),
        ])
      );
    }
    if (input.from) filtered = filtered.where("h.changedAt", ">=", istDayStart(input.from));
    if (input.to) filtered = filtered.where("h.changedAt", "<", istDayEnd(input.to));
    switch (input.movement) {
      case "increase":
        filtered = filtered.where((eb) => eb("h.newPrice", ">", eb.ref("h.previousPrice")));
        break;
      case "decrease":
        filtered = filtered.where((eb) => eb("h.newPrice", "<", eb.ref("h.previousPrice")));
        break;
      case "free_to_paid":
        filtered = filtered.where("h.previousPrice", "=", "0").where("h.newPrice", ">", "0");
        break;
      case "paid_to_free":
        filtered = filtered.where("h.previousPrice", ">", "0").where("h.newPrice", "=", "0");
        break;
      case "list_only":
        filtered = filtered.where((eb) => eb("h.newPrice", "=", eb.ref("h.previousPrice")));
        break;
    }

    const totalRow = await filtered.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirst();
    const total = Number(totalRow?.total ?? 0);
    const paging = pageWindow(input.page, total);
    const direction = input.sort === "oldest" ? "asc" : "desc";

    const rows = await filtered
      .select(PRICE_HISTORY_COLUMNS)
      .orderBy("h.changedAt", direction)
      .orderBy("h.id", direction)
      .limit(paging.limit)
      .offset(paging.offset)
      .execute();

    const teacherRows = await db
      .selectFrom("productPriceHistory as h")
      .leftJoin("teachers as teacher", "teacher.id", "h.teacherId")
      .where("h.productType", "in", allowed)
      .where("h.teacherId", "is not", null)
      .select(["h.teacherId", "teacher.displayName", "teacher.email"])
      .select((eb) => eb.fn.countAll<string>().as("cnt"))
      .groupBy(["h.teacherId", "teacher.displayName", "teacher.email"])
      .orderBy("teacher.displayName", "asc")
      .limit(1000)
      .execute();

    const output: OutputType = {
      items: rows.map(toPriceHistoryEntry),
      total,
      page: paging.page,
      totalPages: paging.totalPages,
      productTypes: allowed,
      teachers: teacherRows.map((row) => ({
        id: row.teacherId as number,
        name: row.displayName || row.email || `Teacher #${row.teacherId}`,
        count: Number(row.cnt),
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    console.error("Error fetching price history:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}