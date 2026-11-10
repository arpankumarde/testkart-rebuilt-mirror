import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { settleLivePackageCheckout } from "../../../helpers/livePackages";
import { schema, OutputType } from "./verify_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { packageId } = schema.parse(superjson.parse(await request.text()));
    const pkg = await db.selectFrom("livePackages").select("studentId").where("id", "=", packageId).executeTakeFirst();
    if (!pkg || pkg.studentId !== user.id) {
      return new Response(superjson.stringify({ error: "Package not found." }), { status: 404 });
    }
    const output: OutputType = await settleLivePackageCheckout(packageId);
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Package verify failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not check the payment." }), { status: 400 });
  }
}
