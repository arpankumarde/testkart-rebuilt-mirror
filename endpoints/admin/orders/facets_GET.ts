import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { TEACHER_ID_EXPR } from "../../../helpers/adminOrderQuery";
import type { FacetOption, OutputType } from "./facets_GET.schema";

const toOptions = (rows: { value: string | null; count: string }[]): FacetOption[] =>
  rows.map((row) => ({ value: row.value, count: Number(row.count) }));

/** The values the Transactions filters can offer, each with how many orders carry it. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const facet = (column: string) =>
      db
        .selectFrom("orders")
        .select([sql<string | null>`${sql.raw(`orders.${column}`)}`.as("value"), sql<string>`count(*)`.as("count")])
        .groupBy(sql`1`)
        .orderBy(sql`count(*) desc`)
        .execute();

    const [osNames, browsers, brands, paymentMethods, teacherCounts, promoCodes] = await Promise.all([
      facet("client_os_name"),
      facet("client_browser_name"),
      facet("client_device_brand"),
      facet("payment_method"),
      db
        .selectFrom("orders")
        .select([TEACHER_ID_EXPR.as("teacherId"), sql<string>`count(*)`.as("count")])
        .groupBy(sql`1`)
        .execute(),
      db
        .selectFrom("orders")
        .innerJoin("promoCodes", "promoCodes.id", "orders.promoCodeId")
        .select(["promoCodes.code", sql<string>`count(*)`.as("count")])
        .groupBy("promoCodes.code")
        .orderBy(sql`count(*) desc`)
        .execute(),
    ]);

    const teacherIds = teacherCounts.map((t) => t.teacherId).filter((id): id is number => typeof id === "number");
    const names = teacherIds.length
      ? await db.selectFrom("users").select(["id", "displayName"]).where("id", "in", teacherIds).execute()
      : [];
    const nameById = new Map(names.map((n) => [n.id, n.displayName]));
    const teachers = teacherCounts
      .filter((t): t is { teacherId: number; count: string } => typeof t.teacherId === "number")
      .map((t) => ({ id: t.teacherId, name: nameById.get(t.teacherId) ?? `Teacher #${t.teacherId}`, count: Number(t.count) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const output: OutputType = {
      osNames: toOptions(osNames),
      browsers: toOptions(browsers),
      brands: toOptions(brands),
      paymentMethods: toOptions(paymentMethods),
      teachers,
      promoCodes: promoCodes.map((p) => ({ code: p.code, count: Number(p.count) })),
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[admin/orders/facets] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}