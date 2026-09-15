import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, ActiveTrialView } from "./active-trials_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, [
      "super_admin",
      "admin",
      "billing_manager",
    ]);

    const activeTrials = await db
      .selectFrom("teacherSubscriptions as ts")
      .innerJoin("users as u", "u.id", "ts.teacherId")
      .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId")
      .where("ts.paymentMethod", "=", "admin_trial")
      .where("ts.status", "=", "active")
      .where("ts.endDate", ">", sql`NOW()`)
      .select([
        "ts.id as subscriptionId",
        "u.id as teacherId",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "ts.platformFeeOverride as platformFeePercentage",
        "ts.startDate",
        "ts.endDate",
        sql<number>`CASE WHEN ts.end_date IS NOT NULL THEN EXTRACT(DAY FROM ts.end_date - NOW()) ELSE 0 END`.as(
          "daysRemaining"
        ),
        "ts.adminNote",
      ])
      .orderBy("ts.endDate", "asc")
      .execute();

    const mappedTrials: ActiveTrialView[] = activeTrials.map((t) => ({
      subscriptionId: t.subscriptionId,
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      teacherEmail: t.teacherEmail,
      platformFeePercentage:
        t.platformFeePercentage !== null
          ? Number(t.platformFeePercentage)
          : null,
      startDate: t.startDate,
      endDate: t.endDate,
      daysRemaining: Math.floor(Number(t.daysRemaining || 0)),
      adminNote: t.adminNote,
    }));

    const output: OutputType = {
      trials: mappedTrials,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching active trials:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}