import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./mark-attended_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { registrationId, attended } = schema.parse(superjson.parse(await request.text()));

    await db
      .updateTable("masterclassRegistrations")
      .set({ attended })
      .where("id", "=", registrationId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("[admin/masterclasses/mark-attended] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to update attendance." }),
      { status: 400 }
    );
  }
}
