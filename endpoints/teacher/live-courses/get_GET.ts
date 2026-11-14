import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { errorResponse, getManagedCourse, refundClosesAt } from "../../../helpers/liveCourseServer";
import { loadCourseDetail } from "../../../helpers/liveCourseData";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { liveCourseEarnings, liveCourseMinClasses } from "../../../helpers/liveCourseRules";
import { refundPerStudentIfOneMoreCancelled } from "../../../helpers/liveCourseShortfall";
import { schema, type OutputType } from "./get_GET.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse({ id: new URL(request.url).searchParams.get("id") });
    const managed = await getManagedCourse(input.id, user, effectiveTeacherId);
    const [course, closesAt, fee] = await Promise.all([
      loadCourseDetail({ id: input.id }),
      refundClosesAt(input.id),
      getTeacherPlatformFee(managed.teacherId),
    ]);
    if (!course) return new Response(superjson.stringify({ error: "Live course not found." }), { status: 404 });

    const price = Number(managed.price);
    const planned = course.classes.filter((c) => c.status !== "cancelled").length;
    const minClasses = managed.minClasses ?? liveCourseMinClasses(planned);
    const pay = liveCourseEarnings(price, minClasses, fee);
    const cancelRefundPerStudent =
      managed.status === "published" && managed.minClasses && managed.enrolledCount > 0
        ? await refundPerStudentIfOneMoreCancelled(managed.id, managed.minClasses, price)
        : 0;

    const output: OutputType = {
      course,
      refundClosesAt: closesAt,
      earnings: {
        platformFeePercentage: fee,
        perClassPerStudent: price > 0 && planned > 0 ? pay.perClassPerStudent : 0,
        perStudent: price > 0 ? pay.perStudent : 0,
        fixed: managed.minClasses != null,
        cancelRefundPerStudent,
      },
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}