import { sql, type Kysely } from "kysely";
import type { DB } from "./schema";
import type { PriceChangeSource } from "./productPriceHistory";

/*
 * Who changed a price. The price history triggers read it from transaction-local
 * settings, so call setPriceChangeActor inside the same transaction that writes
 * the price; outside one it is lost and the change is recorded as "system".
 * The actor always comes from the server session, never from the request body.
 */
export type PriceChangeActor = {
  userId: number | null;
  adminId: number | null;
  source: PriceChangeSource;
};

type SessionContext = {
  user: { id: number; role: string };
  teacherRole?: string;
  impersonatorAdminId?: number | null;
  session: { adminEditType?: unknown };
};

export function priceChangeActor(ctx: SessionContext): PriceChangeActor {
  const adminId = ctx.impersonatorAdminId ?? null;
  if (adminId !== null) {
    return {
      userId: ctx.user.id,
      adminId,
      source: ctx.session.adminEditType !== undefined ? "admin_editor" : "admin_impersonation",
    };
  }
  if (ctx.user.role === "admin") return { userId: ctx.user.id, adminId: null, source: "admin_editor" };
  return { userId: ctx.user.id, adminId: null, source: ctx.teacherRole === "manager" ? "team_member" : "teacher" };
}

export async function setPriceChangeActor(trx: Kysely<DB>, actor: PriceChangeActor): Promise<void> {
  await sql`select
    set_config('tk.price_actor_user', ${actor.userId === null ? "" : String(actor.userId)}, true),
    set_config('tk.price_actor_admin', ${actor.adminId === null ? "" : String(actor.adminId)}, true),
    set_config('tk.price_actor_source', ${actor.source}, true)`.execute(trx);
}