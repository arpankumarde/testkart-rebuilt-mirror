import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../helpers/_publicConfigs";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../helpers/sendEmail";
import { getTeacherPlatformFee } from "../../helpers/getTeacherPlatformFee";

export async function handle(request: Request): Promise<Response> {
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("PayU credentials are not configured.");
    return new Response(
      superjson.stringify({ error: "Payment gateway is not configured." }),
      { status: 500 }
    );
  }

  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { bundleId } = schema.parse(json);

    const bundle = await db
      .selectFrom("courseBundles")
      .select(["id", "title", "price", "isPublished", "teacherId"])
      .where("id", "=", bundleId)
      .executeTakeFirst();

    if (!bundle || !bundle.isPublished) {
      return new Response(
        superjson.stringify({
          error: "Bundle not found or not available for purchase.",
        }),
        { status: 404 }
      );
    }

    const existingEnrollment = await db
      .selectFrom("bundleEnrollments")
      .select("id")
      .where("studentId", "=", user.id)
      .where("bundleId", "=", bundle.id)
      .executeTakeFirst();

    if (existingEnrollment) {
      return new Response(
        superjson.stringify({ error: "You are already enrolled in this bundle." }),
        { status: 409 }
      );
    }

    const amount = Number(bundle.price);
    if (amount <= 0) {
      // Handle free bundle enrollment directly without payment
      await db.transaction().execute(async (trx) => {
        const platformFeePercentage = await getTeacherPlatformFee(bundle.teacherId, trx);
        const order = await trx
          .insertInto("orders")
          .values({
            userId: user.id,
            bundleId: bundle.id,
            totalAmount: "0",
            status: "completed",
            paymentMethod: "free",
            platformFeePercentage: platformFeePercentage.toFixed(2),
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("bundleEnrollments")
          .values({
            bundleId: bundle.id,
            studentId: user.id,
            orderId: order.id,
          })
          .execute();
      });

      // Email notifications
      try {
        // Look up student email
        const student = await db
          .selectFrom("users")
          .select(["email", "displayName"])
          .where("id", "=", user.id)
          .executeTakeFirst();

        // Look up teacher info
        const bundleWithTeacher = await db
          .selectFrom("courseBundles")
          .innerJoin("users as teacher", "courseBundles.teacherId", "teacher.id")
          .select([
            "courseBundles.teacherId",
            "teacher.displayName as teacherName",
            "teacher.email as teacherEmail",
          ])
          .where("courseBundles.id", "=", bundle.id)
          .executeTakeFirst();

        if (!bundleWithTeacher) {
          console.log(`Bundle ${bundle.id} teacher info not found for email notification.`);
        } else {
          // Look up bundle items (courses and tests)
          const bundleItems = await db
            .selectFrom("courseBundleItems")
            .leftJoin("courses", (join) =>
              join
                .onRef("courseBundleItems.courseId", "=", "courses.id")
                .on("courseBundleItems.itemType", "=", "course")
            )
            .leftJoin("mockTests", (join) =>
              join
                .onRef("courseBundleItems.mockTestId", "=", "mockTests.id")
                .on("courseBundleItems.itemType", "=", "test")
            )
            .select([
              "courseBundleItems.itemType",
              "courses.title as courseTitle",
              "mockTests.title as testTitle",
            ])
            .where("courseBundleItems.bundleId", "=", bundle.id)
            .execute();

          const includedItemNames = bundleItems.map((item) =>
            item.itemType === "course"
              ? (item.courseTitle ?? "Unknown Course")
              : (item.testTitle ?? "Unknown Test")
          );

          const studentName = student?.displayName ?? user.displayName;
          const teacherName = bundleWithTeacher.teacherName;

          // Send enrollment email to student and purchase notification to teacher concurrently
          await Promise.all([
            student?.email ? sendEmail({
              to: student.email,
              subject: emailTemplatesExtra.bundleEnrollmentStudent(
                studentName,
                bundle.title,
                teacherName,
                includedItemNames
              ).subject,
              html: emailTemplatesExtra.bundleEnrollmentStudent(
                studentName,
                bundle.title,
                teacherName,
                includedItemNames
              ).html,
              text: emailTemplatesExtra.bundleEnrollmentStudent(
                studentName,
                bundle.title,
                teacherName,
                includedItemNames
              ).text,
            }).catch((err) =>
              console.error("Failed to send bundle enrollment email to student:", err)
            ) : Promise.resolve(),
            
            bundleWithTeacher.teacherEmail ? sendEmail({
              to: bundleWithTeacher.teacherEmail,
              subject: emailTemplatesExtra.newPurchaseNotification(
                teacherName,
                studentName,
                bundle.title,
                "bundle",
                0
              ).subject,
              html: emailTemplatesExtra.newPurchaseNotification(
                teacherName,
                studentName,
                bundle.title,
                "bundle",
                0
              ).html,
              text: emailTemplatesExtra.newPurchaseNotification(
                teacherName,
                studentName,
                bundle.title,
                "bundle",
                0
              ).text,
            }).catch((err) =>
              console.error("Failed to send new purchase notification email to teacher:", err)
            ) : Promise.resolve(),
          ]);
        }
      } catch (emailError) {
        console.error("Error preparing bundle enrollment emails:", emailError);
      }

      return new Response(superjson.stringify({ success: true, isFree: true }));
    }

    // For paid bundles, proceed with PayU
    const platformFeePercentage = await getTeacherPlatformFee(bundle.teacherId);
    const order = await db
      .insertInto("orders")
      .values({
        userId: user.id,
        bundleId: bundle.id,
        totalAmount: amount.toString(),
        status: "pending",
        paymentMethod: "payu",
        platformFeePercentage: platformFeePercentage.toFixed(2),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const txnid = `testkart-bundle-${order.id}-${Date.now()}`;
    await db
      .updateTable("orders")
      .set({ paymentTransactionId: txnid })
      .where("id", "=", order.id)
      .execute();

    const productInfo = bundle.title.substring(0, 100).replace(/\|/g, " ");
    const firstname = (user.displayName || "Student").replace(/\|/g, " ");
    const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;

    const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount.toFixed(
      2
    )}|${productInfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
    const hash = createHash("sha512").update(hashString).digest("hex");

    const payuUrl =
      PAYU_MODE !== "production"
        ? "https://test.payu.in/_payment"
        : "https://secure.payu.in/_payment";

        const callbackUrl = `https://testkart.in/_api/payment/payu/callback`;

    const responsePayload: OutputType = {
      success: true,
      isFree: false,
      paymentData: {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount: amount.toFixed(2),
        productinfo: productInfo,
        firstname,
        email,
        phone: user.mobileNumber || "9999999999",
        surl: callbackUrl,
        furl: callbackUrl,
        hash,
        payuUrl,
      },
    };

    return new Response(superjson.stringify(responsePayload));
  } catch (error) {
    console.error("Failed to initiate bundle purchase:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to initiate payment",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}