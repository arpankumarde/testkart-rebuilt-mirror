import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, InputType } from "./enroll_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sql, Transaction } from "kysely";
import { DB } from "../../../helpers/schema";
import { generatePasswordHash } from "../../../helpers/generatePasswordHash";
import { sendSMS } from "../../../helpers/sendSMS";
import { normalizePhoneNumber } from "../../../helpers/normalizePhoneNumber";
import { sendEmail } from "../../../helpers/sendEmail";
import { sponsoredEnrollment, newStudentEnrolled } from "../../../helpers/emailTemplates";
import { courseDiscountPrice } from "../../../helpers/coursePricing";
import { productDiscountPrice } from "../../../helpers/digitalProductPricing";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { parseSponsorIdentifier, resolveSponsorAccount } from "../../../helpers/sponsorStudentAccount";
import { getSponsorshipAccess, SPONSORSHIP_PLAN_REQUIRED_MESSAGE } from "../../../helpers/teacherPlanAccess";
import { SPONSORSHIP_FEE_WAIVED_METHOD } from "../../../helpers/sponsorshipFee";

type ContentType = InputType["contentType"];

type ContentInfo = {
  id: number;
  title: string;
  price: number;
  discountPrice: number | null;
  teacherId: number;
  isPublished: boolean;
  isFree: boolean;
};

async function resolveContent(
  trx: Transaction<DB>,
  contentType: ContentType,
  contentId: number
): Promise<ContentInfo | null> {
  if (contentType === "test") {
    const row = await trx
      .selectFrom("mockTests")
      .select(["id", "title", "price", "discountPrice", "teacherId", "isPublished", "isFree"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    const price = Number(row.price);
    return {
      id: row.id,
      title: row.title,
      price,
      discountPrice:
        row.discountPrice !== null &&
        Number(row.discountPrice) > 0 &&
        Number(row.discountPrice) < price
          ? Number(row.discountPrice)
          : null,
      teacherId: row.teacherId,
      isPublished: row.isPublished,
      isFree: row.isFree,
    };
  }

  if (contentType === "course") {
    const row = await trx
      .selectFrom("courses")
      .select(["id", "title", "price", "discountPrice", "teacherId", "status"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: courseDiscountPrice(row.price, row.discountPrice),
      teacherId: row.teacherId,
      isPublished: row.status === "published",
      isFree: Number(row.price) === 0,
    };
  }

  if (contentType === "product") {
    const row = await trx
      .selectFrom("digitalProducts")
      .select(["id", "title", "price", "discountPrice", "teacherId", "isPublished"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: productDiscountPrice(row.price, row.discountPrice),
      teacherId: row.teacherId,
      isPublished: row.isPublished ?? false,
      isFree: Number(row.price) === 0,
    };
  }

  if (contentType === "bundle") {
    const row = await trx
      .selectFrom("courseBundles")
      .select(["id", "title", "price", "teacherId", "isPublished"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: null,
      teacherId: row.teacherId,
      isPublished: row.isPublished,
      isFree: Number(row.price) === 0,
    };
  }

  return null;
}

async function checkExistingEnrollmentInTrx(
  trx: Transaction<DB>,
  contentType: ContentType,
  contentId: number,
  studentId: number
): Promise<boolean> {
  if (contentType === "test") {
    const existing = await trx
      .selectFrom("mockTestEnrollments")
      .where("studentId", "=", studentId)
      .where("mockTestId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  if (contentType === "course") {
    const existing = await trx
      .selectFrom("courseEnrollments")
      .where("studentId", "=", studentId)
      .where("courseId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  if (contentType === "product") {
    const existing = await trx
      .selectFrom("digitalProductPurchases")
      .where("studentId", "=", studentId)
      .where("productId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  if (contentType === "bundle") {
    const existing = await trx
      .selectFrom("bundleEnrollments")
      .where("studentId", "=", studentId)
      .where("bundleId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  return false;
}

/**
 * Deletes unpaid online_pending sponsorships (and their orders) for the same student+content,
 * left over from before the platform fee was waived.
 */
async function cleanupStaleOnlinePendingEnrollments(
  trx: Transaction<DB>,
  studentId: number,
  contentType: ContentType,
  contentId: number
): Promise<void> {
  let query = trx
    .selectFrom("teacherSponsoredEnrollments as tse")
    .leftJoin("orders", "tse.orderId", "orders.id")
    .where("tse.studentId", "=", studentId)
    .where("tse.paymentMethod", "=", "online_pending")
    .where((eb) =>
      eb.or([
        eb("orders.status", "is", null),
        eb("orders.status", "!=", "completed"),
      ])
    );

  if (contentType === "test") {
    query = query.where("tse.mockTestId", "=", contentId);
  } else if (contentType === "course") {
    query = query.where("tse.courseId", "=", contentId);
  } else if (contentType === "product") {
    query = query.where("tse.digitalProductId", "=", contentId);
  } else if (contentType === "bundle") {
    query = query.where("tse.bundleId", "=", contentId);
  }

  const staleRecords = await query
    .select(["tse.id", "tse.orderId"])
    .execute();

  if (staleRecords.length === 0) return;

  const enrollmentIds = staleRecords.map((r) => r.id);
  const orderIds = staleRecords
    .map((r) => r.orderId)
    .filter((id): id is number => id !== null);

  console.log(
    `Cleaning up ${staleRecords.length} stale online_pending enrollment(s) for studentId=${studentId}, contentType=${contentType}, contentId=${contentId}`
  );

  await trx
    .deleteFrom("teacherSponsoredEnrollments")
    .where("id", "in", enrollmentIds)
    .execute();

  if (orderIds.length > 0) {
    await trx
      .deleteFrom("orders")
      .where("id", "in", orderIds)
      .where("status", "!=", "completed")
      .execute();
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    if (user.role !== "admin" && !(await getSponsorshipAccess(effectiveTeacherId)).allowed) {
      return new Response(
        superjson.stringify({ error: SPONSORSHIP_PLAN_REQUIRED_MESSAGE }),
        { status: 403 }
      );
    }

    const json = superjson.parse<InputType>(await request.text());
    const input = schema.parse(json);

    const parsedIdentifier = parseSponsorIdentifier(input.identifier);
    if (!parsedIdentifier.ok) {
      return new Response(superjson.stringify({ error: parsedIdentifier.message }), { status: 400 });
    }
    const isEmail = parsedIdentifier.isEmail;
    let resolvedPhone: string | undefined = parsedIdentifier.phone;
    const resolvedEmail: string | undefined = parsedIdentifier.email;

    if (isEmail) {
      if (input.studentPhone && input.studentPhone.trim() !== "") {
        try {
          resolvedPhone = normalizePhoneNumber(input.studentPhone.trim());
        } catch {
          return new Response(
            superjson.stringify({ error: "Invalid phone number format provided." }),
            { status: 400 }
          );
        }
      }
    }

    // The platform fee is waived for sponsored enrollments, so nothing is charged and the
    // student is enrolled in the same transaction that validates and creates the account.
    const result = await db.transaction().execute(async (trx) => {
      // Re-resolve the account here rather than trusting the dialog's earlier check.
      const account = await resolveSponsorAccount(trx, input.identifier, input.studentUserId);
      if (account.kind === "invalid" || account.kind === "not_student" || account.kind === "multiple_students") {
        throw new Error(account.message);
      }
      if (account.kind === "not_found" && input.studentUserId !== undefined) {
        throw new Error("The selected student account could not be found. Check the account again.");
      }

      let studentUser: { id: number; displayName: string; mobileNumber: string | null; email: string | null } | undefined =
        account.kind === "student" ? account.student : undefined;

      let wasNewUser = false;
      let tempPassword: string | undefined;

      if (!studentUser) {
        if (!input.studentName || input.studentName.trim() === "") {
          throw new Error("Student name is required when enrolling a new user.");
        }

        tempPassword = "TK" + Math.random().toString(36).substring(2, 10).toUpperCase();
        const passwordHash = await generatePasswordHash(tempPassword);

        const userEmail = isEmail
          ? resolvedEmail!
          : input.studentEmail && input.studentEmail.trim() !== ""
          ? input.studentEmail.trim()
          : null;
        const userPhone = resolvedPhone ?? null;

        const newUser = await trx
          .insertInto("users")
          .values({
            mobileNumber: userPhone,
            displayName: input.studentName.trim(),
            email: userEmail,
            role: "student",
            mobileVerified: userPhone !== null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning(["id", "displayName", "role", "mobileNumber", "email"])
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("userPasswords")
          .values({
            userId: newUser.id,
            passwordHash,
            createdAt: new Date(),
          })
          .execute();

        studentUser = newUser;
        wasNewUser = true;
        console.log(`Created new student user: ${newUser.displayName} (identifier: ${input.identifier})`);
      }

      await cleanupStaleOnlinePendingEnrollments(
        trx,
        studentUser.id,
        input.contentType,
        input.contentId
      );

      const content = await resolveContent(trx, input.contentType, input.contentId);

      if (!content) {
        throw new Error("Content not found.");
      }

      if (content.teacherId !== effectiveTeacherId && user.role !== "admin") {
        throw new Error("You do not own this content.");
      }

      if (!content.isPublished) {
        throw new Error("This content is not published.");
      }

      if (content.isFree || content.price === 0) {
        throw new Error("Cannot sponsor free content.");
      }

      const alreadyEnrolled = await checkExistingEnrollmentInTrx(
        trx,
        input.contentType,
        input.contentId,
        studentUser.id
      );

      if (alreadyEnrolled) {
        throw new Error("Student is already enrolled in this content.");
      }

      // Contact snapshot shown in the teacher's sponsored list: the account's phone, else its email.
      const studentPhoneForRecord =
        studentUser.mobileNumber ??
        resolvedPhone ??
        studentUser.email ??
        resolvedEmail ??
        "";

      // Zero-amount completed order: for bundles, bundleId goes on orders; for others, items go in orderItems.
      let newOrderId: number;

      if (input.contentType === "bundle") {
        const newOrder = await trx
          .insertInto("orders")
          .values({
            userId: studentUser.id,
            ...getOrderClientInfo(request),
            totalAmount: "0",
            paymentMethod: "teacher_sponsored",
            status: "completed",
            bundleId: input.contentId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        newOrderId = newOrder.id;
      } else {
        const newOrder = await trx
          .insertInto("orders")
          .values({
            userId: studentUser.id,
            ...getOrderClientInfo(request),
            totalAmount: "0",
            paymentMethod: "teacher_sponsored",
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        newOrderId = newOrder.id;

        await trx
          .insertInto("orderItems")
          .values({
            orderId: newOrderId,
            mockTestId: input.contentType === "test" ? input.contentId : null,
            courseId: input.contentType === "course" ? input.contentId : null,
            digitalProductId: input.contentType === "product" ? input.contentId : null,
            quantity: 1,
            priceAtPurchase: content.price.toString(),
            discountAmount: "0",
            platformFeePercentage: "0",
          })
          .execute();
      }

      await trx
        .insertInto("teacherSponsoredEnrollments")
        .values({
          teacherId: effectiveTeacherId,
          studentId: studentUser.id,
          testPrice: content.price.toString(),
          platformFeePercentage: "0",
          commissionAmount: "0",
          paymentMethod: SPONSORSHIP_FEE_WAIVED_METHOD,
          studentPhone: studentPhoneForRecord,
          wasNewUser,
          enrolledAt: new Date(),
          notes: null,
          orderId: newOrderId,
          temporaryPasswordSent: false,
          contentType: input.contentType,
          mockTestId: input.contentType === "test" ? input.contentId : null,
          courseId: input.contentType === "course" ? input.contentId : null,
          digitalProductId: input.contentType === "product" ? input.contentId : null,
          bundleId: input.contentType === "bundle" ? input.contentId : null,
        })
        .execute();

      if (input.contentType === "test") {
        await trx
          .updateTable("mockTests")
          .set({ studentsEnrolled: sql`students_enrolled + 1` })
          .where("id", "=", input.contentId)
          .execute();

        await trx
          .insertInto("mockTestEnrollments")
          .values({
            mockTestId: input.contentId,
            studentId: studentUser.id,
            orderId: newOrderId,
            enrolledAt: new Date(),
            createdAt: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      } else if (input.contentType === "course") {
        await trx
          .insertInto("courseEnrollments")
          .values({
            courseId: input.contentId,
            studentId: studentUser.id,
            enrolledAt: new Date(),
            lastAccessedAt: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      } else if (input.contentType === "product") {
        await trx
          .insertInto("digitalProductPurchases")
          .values({
            productId: input.contentId,
            studentId: studentUser.id,
            orderId: newOrderId,
            purchasedAt: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

        await trx
          .updateTable("digitalProducts")
          .set({ totalPurchases: sql`total_purchases + 1` })
          .where("id", "=", input.contentId)
          .execute();
      } else if (input.contentType === "bundle") {
        await trx
          .insertInto("bundleEnrollments")
          .values({
            bundleId: input.contentId,
            studentId: studentUser.id,
            orderId: newOrderId,
            enrolledAt: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }

      return {
        studentUser,
        content,
        wasNewUser,
        tempPassword,
        enrolledAt: new Date(),
      };
    });

    const studentEmail = result.studentUser.email;
    const teacherEmail = user.email;

    if (studentEmail) {
      try {
        const studentEmailTemplate = sponsoredEnrollment(
          result.studentUser.displayName,
          result.content.title,
          user.displayName || "Teacher"
        );
        const sent = await sendEmail({
          to: studentEmail,
          subject: studentEmailTemplate.subject,
          html: studentEmailTemplate.html,
          text: studentEmailTemplate.text,
        });
        if (sent.success) {
          console.log(`Sponsored enrollment email sent to student: ${studentEmail}`);
        } else {
          console.error(`Failed to send enrollment email to student: ${studentEmail}`, sent.error);
        }
      } catch (error) {
        console.error(`Error sending enrollment email to student: ${studentEmail}`, error);
      }
    }

    if (teacherEmail) {
      try {
        const teacherEmailTemplate = newStudentEnrolled(
          user.displayName || "Teacher",
          result.studentUser.displayName,
          result.content.title
        );
        const sent = await sendEmail({
          to: teacherEmail,
          subject: teacherEmailTemplate.subject,
          html: teacherEmailTemplate.html,
          text: teacherEmailTemplate.text,
        });
        if (sent.success) {
          console.log(`New student enrollment email sent to teacher: ${teacherEmail}`);
        } else {
          console.error(`Failed to send enrollment email to teacher: ${teacherEmail}`, sent.error);
        }
      } catch (error) {
        console.error(`Error sending enrollment email to teacher: ${teacherEmail}`, error);
      }
    }

    let credentialsSent = false;
    if (result.wasNewUser && input.sendCredentials && result.tempPassword && resolvedPhone) {
      try {
        const smsResult = await sendSMS(resolvedPhone, result.tempPassword);
        if (smsResult) {
          credentialsSent = true;
          await db
            .updateTable("teacherSponsoredEnrollments")
            .set({ temporaryPasswordSent: true })
            .where("studentId", "=", result.studentUser.id)
            .where("contentType", "=", input.contentType)
            .$if(input.contentType === "test", (qb) => qb.where("mockTestId", "=", input.contentId))
            .$if(input.contentType === "course", (qb) => qb.where("courseId", "=", input.contentId))
            .$if(input.contentType === "product", (qb) => qb.where("digitalProductId", "=", input.contentId))
            .$if(input.contentType === "bundle", (qb) => qb.where("bundleId", "=", input.contentId))
            .execute();
          console.log(`Credentials sent via SMS to ${resolvedPhone}`);
        } else {
          console.error(`Failed to send SMS to ${resolvedPhone}`);
        }
      } catch (error) {
        console.error("Error sending SMS:", error);
      }
    }

    const output: OutputType = {
      requiresPayment: false,
      success: true,
      message: result.wasNewUser
        ? "Student account created and enrolled successfully."
        : "Student sponsored successfully.",
      enrollment: {
        studentName: result.studentUser.displayName,
        contentTitle: result.content.title,
        commissionAmount: 0,
        enrolledAt: result.enrolledAt,
      },
      newUserCreated: result.wasNewUser,
      temporaryPassword: result.wasNewUser ? result.tempPassword : undefined,
      credentialsSent: result.wasNewUser ? credentialsSent : undefined,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error enrolling sponsored student:", error);
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
