import { expireDueContent } from "./contentExpiryServer";

/*
 * Scheduled job (static/__dev/scheduled-jobs.json): unlists every teacher item
 * whose expiry has passed. Expiry falls at 00:00 IST, so the 00:01 run does the
 * work; the 06:01, 12:01 and 18:01 runs catch up after a failed or skipped run.
 * Purchase paths check expiry themselves, so a late run never lets an expired
 * item be bought. Each run only touches rows not yet unlisted for expiry.
 */
export async function contentExpirySweep(): Promise<void> {
  const result = await expireDueContent();
  const summary = Object.entries(result)
    .filter(([, ids]) => ids.length > 0)
    .map(([type, ids]) => `${type}: ${ids.join(", ")}`);
  console.log(summary.length > 0 ? `Expired and unlisted - ${summary.join("; ")}` : "No items due to expire.");
}
