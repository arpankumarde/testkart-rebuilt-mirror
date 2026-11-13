import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { errorResponse, getManagedCourse, refundClosesAt } from "../../../helpers/liveCourseServer";
import { loadCourseDetail } from "../../../helpers/liveCourseData";
import { schema, type OutputType } from "./get_GET.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse({ id: new URL(request.url).searchParams.get("id") });
    await getManagedCourse(input.id, user, effectiveTeacherId);
    const [course, closesAt] = await Promise.all([loadCourseDetail({ id: input.id }), refundClosesAt(input.id)]);
    if (!course) return new Response(superjson.stringify({ error: "Live course not found." }), { status: 404 });
    const output: OutputType = { course, refundClosesAt: closesAt };
    return new Response(superjson.stringify(output));
  } catch (error) {
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
