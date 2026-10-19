import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { countPromoCodeUses } from "../../../helpers/promoCodeUsage";
import { OutputType, AdminPromoCodeRow } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const codes = await db
      .selectFrom("promoCodes")
      .selectAll()
      .where("appliesTo", "=", "subscription")
      .orderBy("createdAt", "desc")
      .execute();

    const planRows = await db.selectFrom("subscriptionPlans").select(["id", "name"]).execute();
    const planNameById = new Map(planRows.map((p) => [p.id, p.name]));

    const result: AdminPromoCodeRow[] = await Promise.all(
      codes.map(async (code) => ({
        ...code,
        usedCount: await countPromoCodeUses(db, code.id),
        planNames: code.targetItemIds
          ? code.targetItemIds.map((id) => planNameById.get(id) ?? `#${id}`)
          : null,
      }))
    );

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load promo codes" }),
      { status: 400 }
    );
  }
}
