import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getTcoinBalance, getTcoinsConfig } from "../../../helpers/tcoins";
import { OutputType, TcoinHistoryEntry } from "./summary_GET.schema";

const HISTORY_LIMIT = 50;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const config = await getTcoinsConfig();

    if (!config.enabled || user.role !== "student") {
      return new Response(
        superjson.stringify({
          enabled: false,
          redeemPercent: 0,
          cashbackPercent: 0,
          maxCashback: 0,
          balance: 0,
          pendingCashback: 0,
          totalEarned: 0,
          totalSpent: 0,
          history: [],
        } satisfies OutputType)
      );
    }

    const [balance, orders] = await Promise.all([
      getTcoinBalance(user.id),
      db
        .selectFrom("orders")
        .leftJoin("courseBundles", "orders.bundleId", "courseBundles.id")
        .where("orders.userId", "=", user.id)
        .where((eb) => eb.or([eb("orders.tcoinsRedeemed", ">", 0), eb("orders.tcoinsCashback", ">", 0)]))
        .where("orders.status", "in", ["pending", "completed", "refunded"])
        .select([
          "orders.id",
          "orders.createdAt",
          "orders.status",
          "orders.totalAmount",
          "orders.tcoinsRedeemed",
          "orders.tcoinsCashback",
          "courseBundles.title as bundleTitle",
        ])
        .orderBy("orders.id", "desc")
        .limit(HISTORY_LIMIT)
        .execute(),
    ]);

    const cartOrderIds = orders.filter((o) => !o.bundleTitle).map((o) => o.id);
    const itemRows = cartOrderIds.length
      ? await db
          .selectFrom("orderItems")
          .leftJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
          .leftJoin("courses", "orderItems.courseId", "courses.id")
          .leftJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
          .where("orderItems.orderId", "in", cartOrderIds)
          .select([
            "orderItems.orderId",
            "mockTests.title as testTitle",
            "courses.title as courseTitle",
            "digitalProducts.title as productTitle",
          ])
          .orderBy("orderItems.id", "asc")
          .execute()
      : [];

    const titlesByOrder = new Map<number, string[]>();
    for (const row of itemRows) {
      const title = row.testTitle ?? row.courseTitle ?? row.productTitle;
      if (!title) continue;
      const list = titlesByOrder.get(row.orderId) ?? [];
      list.push(title);
      titlesByOrder.set(row.orderId, list);
    }

    const history: TcoinHistoryEntry[] = orders.map((o) => {
      const titles = titlesByOrder.get(o.id) ?? [];
      const title = o.bundleTitle
        ?? (titles.length > 1 ? `${titles[0]} and ${titles.length - 1} more` : titles[0] ?? `Order #${o.id}`);
      return {
        orderId: o.id,
        createdAt: o.createdAt ?? new Date(),
        status: o.status,
        title,
        amountPaid: Number(o.totalAmount),
        tcoinsRedeemed: o.tcoinsRedeemed,
        tcoinsCashback: o.tcoinsCashback,
      };
    });

    return new Response(
      superjson.stringify({
        enabled: true,
        redeemPercent: config.redeemPercent,
        cashbackPercent: config.cashbackPercent,
        maxCashback: config.maxCashback,
        ...balance,
        history,
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to load Tcoins",
      }),
      { status: 400 }
    );
  }
}