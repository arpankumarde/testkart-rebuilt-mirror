import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./enroll_POST.schema";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../helpers/sendEmail";


import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    // Prevent teachers from enrolling in live tests
    if (user.role === "teacher") {
      console.warn(`Teacher (ID: ${user.id}) attempted to enroll in live test`);
      return new Response(
        superjson.stringify({ error: "Teachers cannot enroll in live tests. Please use a student account." }),
        { status: 403 }
      );
    }
    
    // Only students can enroll
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can enroll in live tests." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { liveTestId, paymentOrderId } = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      const liveTest = await trx
        .selectFrom("liveTests")
        .selectAll()
        .where("id", "=", liveTestId)
        .forUpdate() // Lock the row for the transaction
        .executeTakeFirst();

      if (!liveTest) {
        throw new Error("Live test not found.");
      }

      const isFreeTest = parseFloat(liveTest.price) === 0;
      const isPaidEnrollment = !!paymentOrderId;

      // Validate payment requirements
      if (isFreeTest && isPaidEnrollment) {
        throw new Error("This is a free test and does not require payment.");
      }
      if (!isFreeTest && !isPaidEnrollment) {
        throw new Error("This is a paid test. Please complete payment first.");
      }

      // For paid tests, validate the order
      if (isPaidEnrollment) {
        const order = await trx
          .selectFrom("orders")
          .selectAll()
          .where("id", "=", paymentOrderId)
          .executeTakeFirst();

        if (!order) {
          throw new Error("Payment order not found.");
        }
        if (order.userId !== user.id) {
          throw new Error("This payment order does not belong to you.");
        }
        if (order.status !== "completed") {
          throw new Error("Payment has not been completed yet.");
        }
        if (!order.paymentTransactionId) {
          throw new Error("Invalid payment order.");
        }

        // Validate transaction ID format: live-test-{liveTestId}-...
        const expectedPrefix = `live-test-${liveTestId}-`;
        if (!order.paymentTransactionId.startsWith(expectedPrefix)) {
          throw new Error("This payment order is not for this live test.");
        }

        // Check if this order has already been used for enrollment
        const existingEnrollmentWithOrder = await trx
          .selectFrom("liveTestEnrollments")
          .select("id")
          .where("paymentOrderId", "=", paymentOrderId)
          .executeTakeFirst();

        if (existingEnrollmentWithOrder) {
          throw new Error("This payment has already been used for enrollment.");
        }
      }

            // Check if the live test has already ended
      if (liveTest.endTime && new Date(liveTest.endTime) < new Date()) {
        throw new Error("This live test has already ended.");
      }
      // If a registration deadline is set, enforce it
      if (liveTest.registrationDeadline && new Date() > liveTest.registrationDeadline) {
        throw new Error("Registration for this live test has closed.");
      }
      // If no registration deadline is set, allow enrollment until test ends (already checked above)
      if (liveTest.enrolledCount >= liveTest.maxSeats) {
        throw new Error("This live test is full.");
      }

      const existingEnrollment = await trx
        .selectFrom("liveTestEnrollments")
        .select("id")
        .where("studentId", "=", user.id)
        .where("liveTestId", "=", liveTestId)
        .executeTakeFirst();

      if (existingEnrollment) {
        throw new Error("You are already enrolled in this live test.");
      }

      await trx
        .insertInto("liveTestEnrollments")
        .values({
          studentId: user.id,
          liveTestId: liveTestId,
          paymentOrderId: paymentOrderId || null,
        })
        .execute();

      await trx
        .updateTable("liveTests")
        .set({ enrolledCount: liveTest.enrolledCount + 1 })
        .where("id", "=", liveTestId)
        .execute();
      
      return { message: "Successfully enrolled in the live test." };
    });

    // Send email notifications
    try {
      const [student, liveTestInfo] = await Promise.all([
        // Look up student info and live test info for emails
        db.selectFrom("users").select(["email", "displayName"]).where("id", "=", user.id).executeTakeFirst(),
        db.selectFrom("liveTests")
          .innerJoin("users as teacher", "liveTests.teacherId", "teacher.id")
          .select([
            "liveTests.title",
            "liveTests.startTime",
            "liveTests.price",
            "teacher.id as teacherId",
            "teacher.email as teacherEmail",
            "teacher.displayName as teacherName",
          ])
          .where("liveTests.id", "=", liveTestId)
          .executeTakeFirst(),
      ]);

      if (student && liveTestInfo) {
        const scheduledDate = liveTestInfo.startTime ? new Date(liveTestInfo.startTime) : new Date();

        if (student.email) {
          const studentTemplate = emailTemplatesExtra.liveTestEnrolled(
            student.displayName,
            liveTestInfo.title,
            scheduledDate
          );
          await sendEmail({ to: student.email, ...studentTemplate });
        }

        if (liveTestInfo.teacherEmail) {
          const price = parseFloat(liveTestInfo.price);
          const teacherTemplate = emailTemplatesExtra.newPurchaseNotification(
            liveTestInfo.teacherName,
            student.displayName,
            liveTestInfo.title,
            "live_test",
            price
          );
          await sendEmail({ to: liveTestInfo.teacherEmail, ...teacherTemplate });
        }

        
      }
    } catch (err) {
      console.error("Failed to look up data for live test enrollment emails:", err);
    }

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Failed to enroll in live test:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400 }
    );
  }
}