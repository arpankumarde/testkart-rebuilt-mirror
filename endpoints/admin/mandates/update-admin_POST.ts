import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update-admin_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const sub = await db
      .selectFrom("teacherSubscriptions")
      .select("id")
      .where("id", "=", input.subscriptionId)
      .executeTakeFirst();
    if (!sub) {
      throw new Error("Subscription not found.");
    }

    const values: { adminNote?: string | null; platformFeeOverride?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.adminNote !== undefined) {
      values.adminNote = input.adminNote;
    }
    if (input.platformFeeOverride !== undefined) {
      values.platformFeeOverride = input.platformFeeOverride !== null ? String(input.platformFeeOverride) : null;
    }

    await db.updateTable("teacherSubscriptions").set(values).where("id", "=", input.subscriptionId).execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("[admin/mandates/update-admin] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to update subscription." }),
      { status: 400 }
    );
  }
}
