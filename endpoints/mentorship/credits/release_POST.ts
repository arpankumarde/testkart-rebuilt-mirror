import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./release_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { creditId } = schema.parse(superjson.parse(await request.text()));
    const released = await db
      .updateTable("liveClassCredits")
      .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
      .where("id", "=", creditId)
      .where("studentId", "=", user.id)
      .where("status", "=", "unscheduled")
      .returning("amount")
      .executeTakeFirst();
    if (!released) {
      return new Response(superjson.stringify({ error: "This class cannot be moved to your balance." }), { status: 400 });
    }
    const output: OutputType = { released: Number(released.amount) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Release credit failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not move this class." }), { status: 400 });
  }
}
