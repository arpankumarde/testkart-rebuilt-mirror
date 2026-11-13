import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { cancelRenewalCharges, cancelUpcomingRenewals, LIVE_PACKAGE_STATUSES, type RaisedCharge } from "../../../helpers/livePackages";
import { schema, OutputType } from "./update_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const pkg = await db
      .selectFrom("livePackages")
      .select(["studentId", "status", "classesPerWeek"])
      .where("id", "=", input.packageId)
      .executeTakeFirst();
    if (!pkg || pkg.studentId !== user.id) return fail("Package not found.", 404);
    if (!(LIVE_PACKAGE_STATUSES as readonly string[]).includes(pkg.status)) return fail("This package has stopped.");

    if (input.autoRenew === true) {
      const mandate = await db
        .selectFrom("liveMandates")
        .select("id")
        .where("packageId", "=", input.packageId)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!mandate) return fail("Autopay was turned off for this package. Start a new package to renew.");
    }

    // Turning autopay off also calls off a renewal already set up for the next cycle, and its debit at Cashfree.
    const charges = await db.transaction().execute(async (trx): Promise<RaisedCharge[]> => {
      await trx.selectFrom("livePackages").select("id").where("id", "=", input.packageId).forUpdate().executeTakeFirst();
      await trx
        .updateTable("livePackages")
        .set({
          ...(input.autoRenew !== undefined ? { autoRenew: input.autoRenew } : {}),
          ...(input.nextClassesPerWeek !== undefined
            ? { nextClassesPerWeek: input.nextClassesPerWeek === pkg.classesPerWeek ? null : input.nextClassesPerWeek }
            : {}),
          updatedAt: new Date(),
        })
        .where("id", "=", input.packageId)
        .execute();
      return input.autoRenew === false ? cancelUpcomingRenewals(trx, input.packageId, "Autopay was turned off.") : [];
    });
    await cancelRenewalCharges(input.packageId, charges);

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Package update failed:", error);
    return fail(error instanceof Error ? error.message : "Could not update the package.");
  }
}
