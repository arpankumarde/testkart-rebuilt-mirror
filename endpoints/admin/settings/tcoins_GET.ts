import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getTcoinsConfig } from "../../../helpers/tcoins";
import { OutputType } from "./tcoins_GET.schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const [config, totals] = await Promise.all([
      getTcoinsConfig(),
      sql<{ outstandingCoins: string | null; studentsWithCoins: string | null }>`
        SELECT coalesce(sum(balance), 0) AS outstanding_coins, count(*) FILTER (WHERE balance > 0) AS students_with_coins
        FROM (
          SELECT greatest(0, sum(earned) - sum(spent)) AS balance
          FROM (
            SELECT user_id,
              sum(CASE WHEN status = 'completed' THEN tcoins_cashback ELSE 0 END) AS earned,
              sum(CASE WHEN status IN ('pending', 'completed') THEN tcoins_redeemed ELSE 0 END) AS spent
            FROM orders
            WHERE tcoins_redeemed > 0 OR tcoins_cashback > 0
            GROUP BY user_id
            UNION ALL
            SELECT user_id, sum(coins) AS earned, 0 AS spent
            FROM tcoin_grants
            GROUP BY user_id
          ) movements
          GROUP BY user_id
        ) per_student
      `.execute(db),
    ]);

    const row = totals.rows[0];
    return new Response(
      superjson.stringify({
        ...config,
        outstandingCoins: Number(row?.outstandingCoins ?? 0),
        studentsWithCoins: Number(row?.studentsWithCoins ?? 0),
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch Tcoins settings",
      }),
      { status: 400 }
    );
  }
}