import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, TrialHistoryView } from "./trial-history_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    // Every admin-granted custom trial ever created, active or not — lets
    // an admin see when a past trial ran and what fee it carried, not just
    // the ones currently in effect (see Active Custom Trials for that).
    const trials = await db
      .selectFrom("teacherSubscriptions as ts")
      .innerJoin("users as u", "u.id", "ts.teacherId")
      .where("ts.paymentMethod", "=", "admin_trial")
      .select([
        "ts.id as subscriptionId",
        "u.id as teacherId",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "ts.platformFeeOverride as platformFeePercentage",
        "ts.startDate",
        "ts.endDate",
        "ts.adminNote",
        sql<boolean>`ts.status = 'active' AND ts.end_date > NOW()`.as("isActive"),
      ])
      .orderBy("ts.startDate", "desc")
      .limit(200)
      .execute();

    const mappedTrials: TrialHistoryView[] = trials.map((t) => ({
      subscriptionId: t.subscriptionId,
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      teacherEmail: t.teacherEmail,
      platformFeePercentage:
        t.platformFeePercentage !== null ? Number(t.platformFeePercentage) : null,
      startDate: t.startDate,
      endDate: t.endDate,
      adminNote: t.adminNote,
      isActive: t.isActive,
    }));

    const output: OutputType = {
      trials: mappedTrials,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching trial history:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
