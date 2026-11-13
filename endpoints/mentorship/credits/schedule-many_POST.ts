import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schedulePackageCredits } from "../../../helpers/livePackages";
import { schema, OutputType } from "./schedule-many_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const result = await db.transaction().execute((trx) => schedulePackageCredits(trx, user.id, input.packageId, input.startTimes));
    const output: OutputType = result;
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Schedule package classes failed:", error);
    return fail(error instanceof Error ? error.message : "Could not book these classes.");
  }
}