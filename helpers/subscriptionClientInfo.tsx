import type { Kysely } from "kysely";
import type { DB } from "./schema";

/*
 * Source attribution for subscription payments. A payment the teacher starts
 * (checkout, mandate sign-up, wallet) spreads getOrderClientInfo(request) into
 * the subscription_transactions insert, exactly like orders. A charge the
 * server starts on its own (scheduled renewal, the browser's auto-renew check,
 * an admin retry) has no meaningful device of its own, so it copies the source
 * of the payment that set the subscription up and records which one in
 * client_inherited_from. It never uses the admin's or the job's request.
 */

const CLIENT_COLUMNS = [
  "clientSource",
  "clientDeviceType",
  "clientBrowser",
  "clientOs",
  "clientAppVersion",
  "clientUserAgent",
  "clientIp",
  "clientOsName",
  "clientOsVersion",
  "clientBrowserName",
  "clientBrowserVersion",
  "clientDeviceBrand",
  "clientDeviceModel",
  "clientScreen",
  "clientReferrer",
] as const;

type InheritedClient = Partial<Record<(typeof CLIENT_COLUMNS)[number], string | null>> & {
  clientInheritedFrom?: number;
};

export async function inheritedSubscriptionClient(
  executor: Kysely<DB>,
  teacherId: number,
  subscriptionId: number | null
): Promise<InheritedClient> {
  const base = executor
    .selectFrom("subscriptionTransactions")
    .select(["id", ...CLIENT_COLUMNS])
    .where("teacherId", "=", teacherId)
    .where("clientSource", "is not", null)
    .where("clientInheritedFrom", "is", null);

  const source =
    (subscriptionId !== null
      ? await base.where("subscriptionId", "=", subscriptionId).orderBy("id", "asc").limit(1).executeTakeFirst()
      : undefined) ?? (await base.orderBy("id", "desc").limit(1).executeTakeFirst());

  if (!source) return {};
  const { id, ...client } = source;
  return { ...client, clientInheritedFrom: id };
}
