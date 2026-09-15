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
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";

function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

function generateTxnId(enrollmentId: number): string {
  return `sponsor-${enrollmentId}-${Date.now()}`;
}

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
      .select(["id", "title", "price", "teacherId", "status"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: null,
      teacherId: row.teacherId,
      isPublished: row.status === "published",
      isFree: Number(row.price) === 0,
    };
  }

  if (contentType === "product") {
    const row = await trx
      .selectFrom("digitalProducts")
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
 * Deletes stale online_pending enrollment records for the same student+content.
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

  // Filter by the appropriate content ID field
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

function contentTypeLabel(contentType: ContentType): string {
  switch (contentType) {
    case "test": return "Test";
    case "course": return "Course";
    case "product": return "Product";
    case "bundle": return "Bundle";
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

    const json = superjson.parse<InputType>(await request.text());
    const input = schema.parse(json);

    const isEmail = isEmailIdentifier(input.identifier);

    // Resolve phone and email from identifier
    let resolvedPhone: string | undefined;
    let resolvedEmail: string | undefined;

    if (isEmail) {
      resolvedEmail = input.identifier.trim().toLowerCase();
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
    } else {
      try {
        resolvedPhone = normalizePhoneNumber(input.identifier);
      } catch {
        return new Response(
          superjson.stringify({ error: "Invalid phone number format. Please enter a valid 10-digit number or email address." }),
          { status: 400 }
        );
      }
    }

    const studentPhoneForRecord = resolvedPhone ?? `email:${resolvedEmail}`;

    // Phase 1 transaction: user creation + validation
    const prepResult = await db.transaction().execute(async (trx) => {
      // Look up existing user by identifier
      let studentUser = isEmail
        ? await trx
            .selectFrom("users")
            .select(["id", "displayName", "role", "mobileNumber", "email"])
            .where(db.fn("lower", ["users.email"]), "=", resolvedEmail!)
            .executeTakeFirst()
        : await trx
            .selectFrom("users")
            .select(["id", "displayName", "role", "mobileNumber", "email"])
            .where("mobileNumber", "=", resolvedPhone!)
            .executeTakeFirst();

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
      } else {
        if (studentUser.role !== "student") {
          throw new Error("User exists but is not a student account.");
        }
      }

      // Clean up stale online_pending records
      await cleanupStaleOnlinePendingEnrollments(
        trx,
        studentUser.id,
        input.contentType,
        input.contentId
      );

      // Resolve content
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

      // Check enrollment
      const alreadyEnrolled = await checkExistingEnrollmentInTrx(
        trx,
        input.contentType,
        input.contentId,
        studentUser.id
      );

      if (alreadyEnrolled) {
        throw new Error("Student is already enrolled in this content.");
      }

      // Calculate costs. Uses the same shared lookup as every other purchase
      // path (orders/create_POST, live-tests/purchase_POST) instead of its
      // own query — the old inline query here only read
      // subscriptionPlans.platformFeePercentage, silently ignoring a
      // teacher's platformFeeOverride (e.g. an admin-granted custom trial
      // fee), and didn't check that the subscription's endDate hadn't
      // already passed. That meant sponsored enrollments could charge the
      // teacher's default plan fee even during an active discounted trial.
      const platformFeePercentage = await getTeacherPlatformFee(effectiveTeacherId, trx);
      const testPrice = content.price;
      const discountPrice = content.discountPrice;
      const effectivePrice = discountPrice !== null ? discountPrice : testPrice;
      const rawCommission = (effectivePrice * platformFeePercentage) / 100;
      const rawCommissionWithDiscount = rawCommission * 0.95;
      const isFreeEnrollment = rawCommissionWithDiscount < 1;
      const commissionAmount = isFreeEnrollment ? 0 : rawCommissionWithDiscount;

      return {
        studentUser,
        content,
        platformFeePercentage,
        testPrice,
        commissionAmount,
        isFreeEnrollment,
        wasNewUser,
        tempPassword,
      };
    });

    // Branch based on payment method
    if (input.paymentMethod === "online") {
      const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
      const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

      if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
        console.error("PayU merchant key or salt is not configured.");
        throw new Error("Payment gateway is not configured.");
      }

      const result = await db.transaction().execute(async (trx) => {
        await cleanupStaleOnlinePendingEnrollments(
          trx,
          prepResult.studentUser.id,
          input.contentType,
          input.contentId
        );

        // Build sponsorship values based on contentType
        const sponsorshipValues = {
          teacherId: effectiveTeacherId,
          studentId: prepResult.studentUser.id,
          testPrice: prepResult.testPrice.toString(),
          platformFeePercentage: prepResult.platformFeePercentage.toString(),
          commissionAmount: prepResult.commissionAmount.toString(),
          paymentMethod: "online_pending" as const,
          studentPhone: studentPhoneForRecord,
          wasNewUser: prepResult.wasNewUser,
          enrolledAt: new Date(),
          notes: null,
          orderId: null,
          temporaryPasswordSent: false,
          contentType: input.contentType,
          mockTestId: input.contentType === "test" ? input.contentId : null,
          courseId: input.contentType === "course" ? input.contentId : null,
          digitalProductId: input.contentType === "product" ? input.contentId : null,
          bundleId: input.contentType === "bundle" ? input.contentId : null,
        };

        const enrollment = await trx
          .insertInto("teacherSponsoredEnrollments")
          .values(sponsorshipValues)
          .returning("id")
          .executeTakeFirstOrThrow();

        const txnid = generateTxnId(enrollment.id);
        const order = await trx
          .insertInto("orders")
          .values({
            userId: user.id,
            totalAmount: prepResult.commissionAmount.toFixed(2),
            discountAmount: "0",
            paymentMethod: "payu",
            paymentTransactionId: txnid,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await trx
          .updateTable("teacherSponsoredEnrollments")
          .set({ orderId: order.id })
          .where("id", "=", enrollment.id)
          .execute();

        return {
          enrollmentId: enrollment.id,
          orderId: order.id,
          txnid,
        };
      });

      const amount = prepResult.commissionAmount.toFixed(2);
      const label = contentTypeLabel(input.contentType);
      const productinfo = `Teacher Sponsorship - ${label} - ${prepResult.content.title}`.replace(/\|/g, " ");
      const firstname = (user.displayName || "Teacher").replace(/\|/g, " ");
      const email = user.email ?? "teacher@testkart.in";
      const phone = user.mobileNumber?.replace(/^\+91/, "") || "9999999999";

      const hashString = `${PAYU_MERCHANT_KEY}|${result.txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

      const payuUrl =
        PAYU_MODE !== "production"
          ? "https://test.payu.in/_payment"
          : "https://secure.payu.in/_payment";

      const baseUrl = "https://testkart.in";

      const output: OutputType = {
        requiresPayment: true,
        paymentData: {
          key: PAYU_MERCHANT_KEY,
          txnid: result.txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone,
          surl: `${baseUrl}/_api/payment/payu/sponsor-callback`,
          furl: `${baseUrl}/_api/payment/payu/sponsor-callback`,
          hash,
          payuUrl,
        },
        enrollmentId: result.enrollmentId,
        orderId: result.orderId,
        newUserCreated: prepResult.wasNewUser,
        temporaryPassword: prepResult.wasNewUser ? prepResult.tempPassword : undefined,
      };

      return new Response(superjson.stringify(output));
    } else {
      // Balance Payment Flow (also handles free enrollment)
      const balanceResult = await db.transaction().execute(async (trx) => {
        let availableBalance: number;

        if (prepResult.isFreeEnrollment) {
          availableBalance = 0;
        } else {
          const balanceBreakdown = await getTeacherAvailableBalance(effectiveTeacherId, trx);
          availableBalance = balanceBreakdown.availableBalance;

          if (availableBalance < prepResult.commissionAmount) {
            throw new Error(
              `Insufficient balance. Required: ₹${prepResult.commissionAmount.toFixed(2)}, Available: ₹${availableBalance.toFixed(2)}`
            );
          }
        }

        // Create order: for bundles, bundleId goes on orders; for others, items go in orderItems
        let newOrderId: number;

        if (input.contentType === "bundle") {
          const newOrder = await trx
            .insertInto("orders")
            .values({
              userId: prepResult.studentUser.id,
              totalAmount: prepResult.commissionAmount.toString(),
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
              userId: prepResult.studentUser.id,
              totalAmount: prepResult.commissionAmount.toString(),
              paymentMethod: "teacher_sponsored",
              status: "completed",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning("id")
            .executeTakeFirstOrThrow();
          newOrderId = newOrder.id;

          // Create order item with the appropriate ID field
          await trx
            .insertInto("orderItems")
            .values({
              orderId: newOrderId,
              mockTestId: input.contentType === "test" ? input.contentId : null,
              courseId: input.contentType === "course" ? input.contentId : null,
              digitalProductId: input.contentType === "product" ? input.contentId : null,
              quantity: 1,
              priceAtPurchase: prepResult.testPrice.toString(),
              discountAmount: "0",
              platformFeePercentage: prepResult.platformFeePercentage.toString(),
            })
            .execute();
        }

        // Create teacherSponsoredEnrollments record
        await trx
          .insertInto("teacherSponsoredEnrollments")
          .values({
            teacherId: effectiveTeacherId,
            studentId: prepResult.studentUser.id,
            testPrice: prepResult.testPrice.toString(),
            platformFeePercentage: prepResult.platformFeePercentage.toString(),
            commissionAmount: prepResult.commissionAmount.toString(),
            paymentMethod: "balance_deduction",
            studentPhone: studentPhoneForRecord,
            wasNewUser: prepResult.wasNewUser,
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

        // Create the appropriate enrollment record
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
              studentId: prepResult.studentUser.id,
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
              studentId: prepResult.studentUser.id,
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
              studentId: prepResult.studentUser.id,
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
              studentId: prepResult.studentUser.id,
              orderId: newOrderId,
              enrolledAt: new Date(),
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
        }

        return {
          newBalance: availableBalance - prepResult.commissionAmount,
          enrolledAt: new Date(),
        };
      });

      // Send email notifications
      const studentEmail = prepResult.studentUser.email;
      const teacherEmail = user.email;

      if (studentEmail) {
        try {
          const studentEmailTemplate = sponsoredEnrollment(
            prepResult.studentUser.displayName,
            prepResult.content.title,
            user.displayName || "Teacher"
          );
          const result = await sendEmail({
            to: studentEmail,
            subject: studentEmailTemplate.subject,
            html: studentEmailTemplate.html,
            text: studentEmailTemplate.text,
          });
          if (result.success) {
            console.log(`Sponsored enrollment email sent to student: ${studentEmail}`);
          } else {
            console.error(`Failed to send enrollment email to student: ${studentEmail}`, result.error);
          }
        } catch (error) {
          console.error(`Error sending enrollment email to student: ${studentEmail}`, error);
        }
      }

      if (teacherEmail) {
        try {
          const teacherEmailTemplate = newStudentEnrolled(
            user.displayName || "Teacher",
            prepResult.studentUser.displayName,
            prepResult.content.title
          );
          const result = await sendEmail({
            to: teacherEmail,
            subject: teacherEmailTemplate.subject,
            html: teacherEmailTemplate.html,
            text: teacherEmailTemplate.text,
          });
          if (result.success) {
            console.log(`New student enrollment email sent to teacher: ${teacherEmail}`);
          } else {
            console.error(`Failed to send enrollment email to teacher: ${teacherEmail}`, result.error);
          }
        } catch (error) {
          console.error(`Error sending enrollment email to teacher: ${teacherEmail}`, error);
        }
      }

      // Send credentials via SMS if requested for new users
      let credentialsSent = false;
      if (prepResult.wasNewUser && input.sendCredentials && prepResult.tempPassword && resolvedPhone) {
        try {
          const smsResult = await sendSMS(resolvedPhone, prepResult.tempPassword);
          if (smsResult) {
            credentialsSent = true;
            await db
              .updateTable("teacherSponsoredEnrollments")
              .set({ temporaryPasswordSent: true })
              .where("studentId", "=", prepResult.studentUser.id)
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
        message: prepResult.wasNewUser
          ? "Student account created and enrolled successfully."
          : "Student sponsored successfully.",
        enrollment: {
          studentName: prepResult.studentUser.displayName,
          contentTitle: prepResult.content.title,
          commissionAmount: prepResult.commissionAmount,
          enrolledAt: balanceResult.enrolledAt,
        },
        newBalance: balanceResult.newBalance,
        newUserCreated: prepResult.wasNewUser,
        temporaryPassword: prepResult.wasNewUser ? prepResult.tempPassword : undefined,
        credentialsSent: prepResult.wasNewUser ? credentialsSent : undefined,
      };

      return new Response(superjson.stringify(output));
    }
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