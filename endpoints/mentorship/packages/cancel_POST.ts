import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { stopLivePackage } from "../../../helpers/livePackages";
import { sendPackageCancelledEmails } from "../../../helpers/livePackageEmails";
import { schema, OutputType } from "./cancel_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { packageId } = schema.parse(superjson.parse(await request.text()));
    const pkg = await db.selectFrom("livePackages").select("studentId").where("id", "=", packageId).executeTakeFirst();
    const isAdmin = user.role === "admin";
    if (!pkg || (!isAdmin && pkg.studentId !== user.id)) {
      return new Response(superjson.stringify({ error: "Package not found." }), { status: 404 });
    }
    const result = await stopLivePackage(packageId, {
      by: isAdmin ? "admin" : "student",
      reason: isAdmin ? "Cancelled by Testkart" : "Package cancelled",
      finalStatus: "cancelled",
    });
    await sendPackageCancelledEmails(packageId, result.released);
    const output: OutputType = { released: result.released };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Package cancel failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not cancel the package." }), { status: 400 });
  }
}
