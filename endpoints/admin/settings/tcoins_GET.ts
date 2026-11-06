import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getTcoinsConfig, loadTcoinMovements, tcoinBalanceFrom } from "../../../helpers/tcoins";
import { OutputType } from "./tcoins_GET.schema";

const SOON_MS = 7 * 24 * 60 * 60 * 1000;

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const [config, movements] = await Promise.all([getTcoinsConfig(), loadTcoinMovements()]);

    const now = new Date();
    const soon = now.getTime() + SOON_MS;
    let outstandingCoins = 0;
    let studentsWithCoins = 0;
    let expiredCoins = 0;
    let expiringSoonCoins = 0;
    for (const entry of movements.values()) {
      const balance = tcoinBalanceFrom(entry, now);
      outstandingCoins += balance.balance;
      if (balance.balance > 0) studentsWithCoins++;
      expiredCoins += balance.totalExpired;
      for (const lot of balance.expiring) if (lot.expiresAt.getTime() <= soon) expiringSoonCoins += lot.coins;
    }

    return new Response(
      superjson.stringify({
        ...config,
        outstandingCoins,
        studentsWithCoins,
        expiredCoins,
        expiringSoonCoins,
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