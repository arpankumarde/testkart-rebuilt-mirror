import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { liveCourseSummaryQuery, toSummaries } from "../../../helpers/liveCourseData";
import { schema, type OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    let q = liveCourseSummaryQuery();
    if (input.status !== "all") q = q.where("liveCourses.status", "=", input.status);
    if (input.q) {
      const like = `%${input.q.replace(/[%_\\]/g, "\\$&")}%`;
      q = q.where((eb) => eb.or([eb("liveCourses.title", "ilike", like), eb("teacher.displayName", "ilike", like)]));
    }
    const rows = await q.orderBy("liveCourses.createdAt", "desc").limit(200).execute();
    const summaries = await toSummaries(rows);
    const money = summaries.length
      ? await db
          .selectFrom("liveCourseEnrollments")
          .select((eb) => [
            "liveCourseId",
            eb.fn.sum<string>("amountPaid").as("paid"),
            eb.fn.sum<string>("refundAmount").as("refunded"),
          ])
          .where("liveCourseId", "in", summaries.map((s) => s.id))
          .groupBy("liveCourseId")
          .execute()
      : [];
    const byId = new Map(money.map((m) => [m.liveCourseId, m]));
    const output: OutputType = {
      courses: summaries.map((s) => {
        const m = byId.get(s.id);
        const refunds = Number(m?.refunded ?? 0);
        return { ...s, revenue: Number(m?.paid ?? 0) - refunds, refunds };
      }),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live course list failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
