import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { errorResponse, getManagedCourse } from "../../../helpers/liveCourseServer";
import { loadCourseRoster } from "../../../helpers/liveCourseRoster";
import { schema } from "./students_GET.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse({ liveCourseId: new URL(request.url).searchParams.get("liveCourseId") });
    await getManagedCourse(input.liveCourseId, user, effectiveTeacherId);
    return new Response(superjson.stringify(await loadCourseRoster(input.liveCourseId)));
  } catch (error) {
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
