import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./enroll-free_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";



export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role === "teacher") {
      return new Response(superjson.stringify({ error: "Teachers cannot enroll in courses. This is for students only." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["id", "status", "price"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course || course.status !== "published") {
      return new Response(superjson.stringify({ error: "Course not found or not available." }), { status: 404 });
    }

    if (Number(course.price) !== 0) {
      return new Response(superjson.stringify({ error: "This course is not free." }), { status: 400 });
    }

    const existingEnrollment = await db
      .selectFrom("courseEnrollments")
      .select("id")
      .where("courseId", "=", courseId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (existingEnrollment) {
      return new Response(superjson.stringify({ error: "You are already enrolled in this course." }), { status: 400 });
    }

    const enrollment = await db
      .insertInto("courseEnrollments")
      .values({
        courseId: courseId,
        studentId: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Send enrollment emails
    try {
      const student = await db
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", user.id)
        .executeTakeFirst();

      if (student?.email) {
        // Fetch course and teacher details
        const courseWithTeacher = await db
          .selectFrom("courses")
          .innerJoin("users as teacher", "courses.teacherId", "teacher.id")
          .select([
            "courses.title as courseTitle",
            "teacher.displayName as teacherName",
            "teacher.email as teacherEmail",
          ])
          .where("courses.id", "=", courseId)
          .executeTakeFirst();

        if (courseWithTeacher) {
          // Student free course enrollment email
          const studentEmail = emailTemplatesExtra.freeCourseEnrollment(
            student.displayName,
            courseWithTeacher.courseTitle,
            courseWithTeacher.teacherName
          );
          
          const studentResult = await sendEmail({
            to: student.email,
            subject: studentEmail.subject,
            html: studentEmail.html,
            text: studentEmail.text,
          });

          if (studentResult.success) {
            console.log(`[courses/enroll-free] Free course enrollment email sent for course ${courseId}`);
          } else {
            console.error(`[courses/enroll-free] Failed to send free course enrollment email:`, studentResult.error);
          }

          // Teacher new enrollment notification email
          if (courseWithTeacher.teacherEmail) {
            const teacherEmail = emailTemplatesExtra.newPurchaseNotification(
              courseWithTeacher.teacherName,
              student.displayName,
              courseWithTeacher.courseTitle,
              "course",
              0
            );
            
            const teacherResult = await sendEmail({
              to: courseWithTeacher.teacherEmail,
              subject: teacherEmail.subject,
              html: teacherEmail.html,
              text: teacherEmail.text,
            });

            if (teacherResult.success) {
              console.log(`[courses/enroll-free] Teacher notification email sent for course ${courseId}`);
            } else {
              console.error(`[courses/enroll-free] Failed to send teacher notification email:`, teacherResult.error);
            }
          }

          
        }
      }
    } catch (emailError) {
      console.error(`[courses/enroll-free] Exception sending enrollment emails for course ${courseId}:`, emailError);
    }

    return new Response(superjson.stringify({ success: true, enrollmentId: enrollment.id } satisfies OutputType), { status: 200 });
  } catch (error) {
    console.error("Failed to enroll in free course:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to enroll", details: errorMessage }), { status: 500 });
  }
}