import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./enroll-free_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../helpers/schema";
import { sendEmail } from "../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";



async function enrollInFreeTest(
  trx: Transaction<DB>,
  userId: number,
  mockTestId: number
): Promise<number> {
  // 1. Check if the test exists, is published, and is free.
  const test = await trx
    .selectFrom("mockTests")
    .select(["id", "isPublished", "price"])
    .where("id", "=", mockTestId)
    .where("deletedAt", "is", null)
    .executeTakeFirst();

  if (!test || !test.isPublished) {
    throw new Error("NOT_FOUND");
  }

  // A live test's shadow mockTests row must never be enrollable through the
  // normal test flow — it bypasses the live test's schedule/registration
  // rules entirely. Students enroll in live tests via liveTestEnrollments.
  const linkedLiveTest = await trx
    .selectFrom("liveTests")
    .select("id")
    .where("mockTestId", "=", mockTestId)
    .executeTakeFirst();

  if (linkedLiveTest) {
    throw new Error("NOT_FOUND");
  }

  if (parseFloat(test.price) !== 0) {
    throw new Error("NOT_FREE");
  }

  // 2. Check if the user is already enrolled using mockTestEnrollments.
  const existingEnrollment = await trx
    .selectFrom("mockTestEnrollments")
    .where("mockTestEnrollments.studentId", "=", userId)
    .where("mockTestEnrollments.mockTestId", "=", mockTestId)
    .select("mockTestEnrollments.id")
    .executeTakeFirst();

  if (existingEnrollment) {
    throw new Error("ALREADY_ENROLLED");
  }

  // 3. Create a new order.
  const newOrder = await trx
    .insertInto("orders")
    .values({
      userId: userId,
      totalAmount: "0",
      status: "completed",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // 4. Create the order item.
  await trx
    .insertInto("orderItems")
    .values({
      orderId: newOrder.id,
      mockTestId: mockTestId,
      priceAtPurchase: "0",
    })
    .execute();

  // 5. Insert into mockTestEnrollments.
  await trx
    .insertInto("mockTestEnrollments")
    .values({
      mockTestId: mockTestId,
      studentId: userId,
      orderId: newOrder.id,
      enrolledAt: new Date(),
      createdAt: new Date(),
    })
    .execute();

  // 6. Increment studentsEnrolled counter on the mockTests table.
  await trx
    .updateTable("mockTests")
    .set((eb) => ({
      studentsEnrolled: eb("studentsEnrolled", "+", 1),
    }))
    .where("id", "=", mockTestId)
    .execute();

  return newOrder.id;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Prevent teachers from enrolling in tests
    if (user.role === "teacher") {
      console.warn(`Teacher (ID: ${user.id}) attempted to enroll in free test`);
      return new Response(
        superjson.stringify({ error: "Teachers cannot enroll in tests. Please use a student account." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { mockTestId } = schema.parse(json);

    const orderId = await db
      .transaction()
      .execute((trx) => enrollInFreeTest(trx, user.id, mockTestId));

    // Send enrollment emails
    try {
      const student = await db
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", user.id)
        .executeTakeFirst();

      if (student?.email) {
        // Fetch test and teacher details
        const testWithTeacher = await db
          .selectFrom("mockTests")
          .innerJoin("users as teacher", "mockTests.teacherId", "teacher.id")
          .select([
            "mockTests.title as testTitle",
            "teacher.displayName as teacherName",
            "teacher.email as teacherEmail",
          ])
          .where("mockTests.id", "=", mockTestId)
          .executeTakeFirst();

        if (testWithTeacher) {
          // Student free enrollment email
          const studentEmail = emailTemplatesExtra.freeTestEnrollment(
            student.displayName,
            testWithTeacher.testTitle,
            testWithTeacher.teacherName
          );
          
          const studentResult = await sendEmail({
            to: student.email,
            subject: studentEmail.subject,
            html: studentEmail.html,
            text: studentEmail.text,
          });

          if (studentResult.success) {
            console.log(`[tests/enroll-free] Free test enrollment email sent for test ${mockTestId}`);
          } else {
            console.error(`[tests/enroll-free] Failed to send free test enrollment email:`, studentResult.error);
          }

          // Teacher new purchase notification email
          if (testWithTeacher.teacherEmail) {
            const teacherEmail = emailTemplatesExtra.newPurchaseNotification(
              testWithTeacher.teacherName,
              student.displayName,
              testWithTeacher.testTitle,
              "test",
              0
            );
            
            const teacherResult = await sendEmail({
              to: testWithTeacher.teacherEmail,
              subject: teacherEmail.subject,
              html: teacherEmail.html,
              text: teacherEmail.text,
            });

            if (teacherResult.success) {
              console.log(`[tests/enroll-free] Teacher notification email sent for test ${mockTestId}`);
            } else {
              console.error(`[tests/enroll-free] Failed to send teacher notification email:`, teacherResult.error);
            }
          }

          
        }
      }
    } catch (emailError) {
      console.error(`[tests/enroll-free] Exception sending enrollment emails for test ${mockTestId}:`, emailError);
    }

    return new Response(
      superjson.stringify({
        orderId: orderId,
        message: "Successfully enrolled in the free test.",
      } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to enroll in free test:", error);
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_FOUND":
          return new Response(
            superjson.stringify({
              error: "Mock test not found or is not available.",
            }),
            { status: 404 }
          );
        case "NOT_FREE":
          return new Response(
            superjson.stringify({ error: "This mock test is not free." }),
            { status: 400 }
          );
        case "ALREADY_ENROLLED":
          return new Response(
            superjson.stringify({ error: "You are already enrolled in this mock test." }),
            { status: 400 }
          );
      }
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to enroll in the free test.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}