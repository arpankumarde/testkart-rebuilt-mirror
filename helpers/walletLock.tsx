import { sql, Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Serialises balance checks and debits for one user's wallet. The lock is held
 * until the surrounding transaction ends, so a concurrent purchase, withdrawal
 * request or approval waits and then reads the balance this one left behind.
 * Read the balance with the same trx after taking it.
 */
export async function lockWallet(trx: Transaction<DB>, userId: number): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtext('wallet'), ${userId}::int)`.execute(trx);
}