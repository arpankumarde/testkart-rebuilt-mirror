import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const enrollments = await db
      .selectFrom("teacherSponsoredEnrollments")
      // Left join: a sponsored student who closed their account leaves student_id null.
      .leftJoin("users", "teacherSponsoredEnrollments.studentId", "users.id")
      .leftJoin("mockTests", "teacherSponsoredEnrollments.mockTestId", "mockTests.id")
      .leftJoin("courses", "teacherSponsoredEnrollments.courseId", "courses.id")
      .leftJoin("digitalProducts", "teacherSponsoredEnrollments.digitalProductId", "digitalProducts.id")
      .leftJoin("courseBundles", "teacherSponsoredEnrollments.bundleId", "courseBundles.id")
      .leftJoin("orders", "teacherSponsoredEnrollments.orderId", "orders.id")
      .where("teacherSponsoredEnrollments.teacherId", "=", effectiveTeacherId)
      // Exclude online_pending enrollments where the order is failed or cancelled
      .where((eb) =>
        eb.or([
          eb("teacherSponsoredEnrollments.paymentMethod", "!=", "online_pending"),
          eb.and([
            eb("teacherSponsoredEnrollments.paymentMethod", "=", "online_pending"),
            eb("orders.status", "not in", ["failed", "cancelled"]),
          ]),
        ])
      )
      .select([
        "teacherSponsoredEnrollments.id",
        sql<string>`COALESCE(users.display_name, 'Deleted account')`.as("studentName"),
        "teacherSponsoredEnrollments.studentPhone",
        "teacherSponsoredEnrollments.contentType",
        sql<string>`COALESCE(mock_tests.title, courses.title, digital_products.title, course_bundles.title, 'Unknown')`.as("contentTitle"),
        "teacherSponsoredEnrollments.testPrice",
        "teacherSponsoredEnrollments.commissionAmount",
        "teacherSponsoredEnrollments.paymentMethod",
        "teacherSponsoredEnrollments.wasNewUser",
        "teacherSponsoredEnrollments.enrolledAt",
        "teacherSponsoredEnrollments.notes",
        "orders.status as orderStatus",
      ])
      .orderBy("teacherSponsoredEnrollments.enrolledAt", "desc")
      .execute();

    const output: OutputType = {
      sponsoredEnrollments: enrollments.map((e) => ({
        id: e.id,
        studentName: e.studentName,
        studentPhone: e.studentPhone,
        contentType: e.contentType,
        contentTitle: e.contentTitle,
        itemPrice: Number(e.testPrice),
        commissionAmount: Number(e.commissionAmount),
        paymentMethod: e.paymentMethod,
        wasNewUser: e.wasNewUser ?? false,
        enrolledAt: e.enrolledAt,
        notes: e.notes,
        orderStatus: e.orderStatus ?? null,
      })),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching sponsored enrollments:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}