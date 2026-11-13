import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { loadCourseDetail } from "../../../helpers/liveCourseData";
import { loadCourseRoster } from "../../../helpers/liveCourseRoster";
import { refundClosesAt } from "../../../helpers/liveCourseServer";
import { schema, type OutputType } from "./get_GET.schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ id: new URL(request.url).searchParams.get("id") });
    const [course, roster, closesAt] = await Promise.all([
      loadCourseDetail({ id: input.id }),
      loadCourseRoster(input.id),
      refundClosesAt(input.id),
    ]);
    if (!course) return new Response(superjson.stringify({ error: "Live course not found." }), { status: 404 });
    const output: OutputType = { course, roster, refundClosesAt: closesAt };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live course get failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
