import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { orderConfirmation, testEnrollment, courseEnrollment } from "./emailTemplates";
import { emailTemplatesExtra } from "./emailTemplatesExtra";
import { sql } from "kysely";
import { sendTemplateEmail } from "./sendTemplateEmail";
import { getBrandedEmailHtml, EmailTableRow } from "./emailBaseTemplate";

/**
 * Sends order confirmation and enrollment emails for a completed order.
 * This is fire-and-forget and should not block the main flow.
 *
 * A buyer with no email on file only loses the emails addressed to them. The
 * internal transactions notification, the teacher purchase alerts and the promo
 * code alert are not addressed to the student and always go out - mobile-OTP
 * signups routinely reach checkout before an email exists on their account, and
 * orders.emails_sent_at is claimed once, so nothing retries them later.
 */
export async function sendOrderConfirmationEmails(orderId: number, userId: number): Promise<void> {
  // Fetch user details
  const user = await db
    .selectFrom("users")
    .select(["email", "displayName"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const studentEmail = user?.email ?? null;
  const studentName = user?.displayName ?? `User #${userId}`;

  if (!studentEmail) {
    console.log(`[sendOrderConfirmationEmails] User ${userId} has no email on file for order ${orderId}, sending internal and teacher notifications only`);
  }

  // Fetch order details
  const order = await db
    .selectFrom("orders")
    .select(["totalAmount", "createdAt"])
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!order) {
    console.error(`[sendOrderConfirmationEmails] Order ${orderId} not found`);
    return;
  }

  // Fetch order items with details
  const orderItems = await db
    .selectFrom("orderItems")
    .leftJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
    .leftJoin("courses", "orderItems.courseId", "courses.id")
    .leftJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
    .select([
      "orderItems.mockTestId",
      "orderItems.courseId",
      "orderItems.digitalProductId",
      "orderItems.priceAtPurchase",
      "mockTests.title as testTitle",
      "mockTests.teacherId as testTeacherId",
      "courses.title as courseTitle",
      "courses.teacherId as courseTeacherId",
      "digitalProducts.title as productTitle",
      "digitalProducts.teacherId as digitalProductTeacherId",
    ])
    .where("orderItems.orderId", "=", orderId)
    .execute();

  // Build order details for confirmation email
  const items = orderItems.map((item) => {
    if (item.mockTestId) {
      return {
        title: item.testTitle || "Test Series",
        price: Number(item.priceAtPurchase),
        type: "test" as const,
      };
    } else if (item.courseId) {
      return {
        title: item.courseTitle || "Course",
        price: Number(item.priceAtPurchase),
        type: "course" as const,
      };
    } else if (item.digitalProductId) {
      return {
        title: item.productTitle || "Digital Product",
        price: Number(item.priceAtPurchase),
        type: "digital_product" as const,
      };
    }
    return {
      title: "Unknown Item",
      price: Number(item.priceAtPurchase),
      type: "digital_product" as const,
    };
  });

  const orderDetails = {
    orderId: orderId,
    totalAmount: Number(order.totalAmount),
    items: items,
    date: order.createdAt ?? new Date(),
  };

  // Send order confirmation email
  if (studentEmail) {
    const confirmationEmail = orderConfirmation(orderDetails);
    try {
      const result = await sendEmail({
        to: studentEmail,
        subject: confirmationEmail.subject,
        html: confirmationEmail.html,
        text: confirmationEmail.text,
      });
      if (result.success) {
        console.log(`[sendOrderConfirmationEmails] Order confirmation sent for order ${orderId}`);
      } else {
        console.error(`[sendOrderConfirmationEmails] Failed to send order confirmation for order ${orderId}:`, result.error);
      }
    } catch (err) {
      console.error(`[sendOrderConfirmationEmails] Exception sending order confirmation for order ${orderId}:`, err);
    }
  }

  // Send individual enrollment emails for tests and courses
  for (const item of orderItems) {
    if (item.mockTestId && item.testTitle && item.testTeacherId) {
      // Fetch teacher details for test
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email"])
        .where("id", "=", item.testTeacherId)
        .executeTakeFirst();

      if (teacher) {
        // Student enrollment email
        if (studentEmail) {
          const enrollmentEmail = testEnrollment(studentName, item.testTitle, teacher.displayName);
          try {
            const result = await sendEmail({
              to: studentEmail,
              subject: enrollmentEmail.subject,
              html: enrollmentEmail.html,
              text: enrollmentEmail.text,
            });
            if (result.success) {
              console.log(`[sendOrderConfirmationEmails] Test enrollment email sent for ${item.testTitle}`);
            } else {
              console.error(`[sendOrderConfirmationEmails] Failed to send test enrollment email:`, result.error);
            }
          } catch (err) {
            console.error(`[sendOrderConfirmationEmails] Exception sending test enrollment email:`, err);
          }
        }

        // Teacher purchase notification email
        if (teacher.email) {
          const teacherNotifEmail = emailTemplatesExtra.newPurchaseNotification(
            teacher.displayName,
            studentName,
            item.testTitle,
            "test",
            Number(item.priceAtPurchase)
          );
          try {
            const result = await sendEmail({
              to: teacher.email,
              subject: teacherNotifEmail.subject,
              html: teacherNotifEmail.html,
              text: teacherNotifEmail.text,
            });
            if (result.success) {
              console.log(`[sendOrderConfirmationEmails] Teacher purchase notification sent for test ${item.testTitle}`);
            } else {
              console.error(`[sendOrderConfirmationEmails] Failed to send teacher purchase notification:`, result.error);
            }
          } catch (err) {
            console.error(`[sendOrderConfirmationEmails] Exception sending teacher purchase notification:`, err);
          }
        }
      }
    } else if (item.courseId && item.courseTitle && item.courseTeacherId) {
      // Fetch teacher details for course
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email"])
        .where("id", "=", item.courseTeacherId)
        .executeTakeFirst();

      if (teacher) {
        // Student enrollment email
        if (studentEmail) {
          const enrollmentEmail = courseEnrollment(studentName, item.courseTitle, teacher.displayName);
          try {
            const result = await sendEmail({
              to: studentEmail,
              subject: enrollmentEmail.subject,
              html: enrollmentEmail.html,
              text: enrollmentEmail.text,
            });
            if (result.success) {
              console.log(`[sendOrderConfirmationEmails] Course enrollment email sent for ${item.courseTitle}`);
            } else {
              console.error(`[sendOrderConfirmationEmails] Failed to send course enrollment email:`, result.error);
            }
          } catch (err) {
            console.error(`[sendOrderConfirmationEmails] Exception sending course enrollment email:`, err);
          }
        }

        // Teacher purchase notification email
        if (teacher.email) {
          const teacherNotifEmail = emailTemplatesExtra.newPurchaseNotification(
            teacher.displayName,
            studentName,
            item.courseTitle,
            "course",
            Number(item.priceAtPurchase)
          );
          try {
            const result = await sendEmail({
              to: teacher.email,
              subject: teacherNotifEmail.subject,
              html: teacherNotifEmail.html,
              text: teacherNotifEmail.text,
            });
            if (result.success) {
              console.log(`[sendOrderConfirmationEmails] Teacher purchase notification sent for course ${item.courseTitle}`);
            } else {
              console.error(`[sendOrderConfirmationEmails] Failed to send teacher purchase notification:`, result.error);
            }
          } catch (err) {
            console.error(`[sendOrderConfirmationEmails] Exception sending teacher purchase notification:`, err);
          }
        }
      }
    } else if (item.digitalProductId && item.productTitle && item.digitalProductTeacherId) {
      // Fetch teacher details for digital product
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email"])
        .where("id", "=", item.digitalProductTeacherId)
        .executeTakeFirst();

      // Student digital product purchase email
      if (studentEmail) {
        const digitalProductEmail = emailTemplatesExtra.digitalProductPurchase(
          studentName,
          item.productTitle,
          teacher?.displayName ?? "Testkart"
        );
        try {
          const result = await sendEmail({
            to: studentEmail,
            subject: digitalProductEmail.subject,
            html: digitalProductEmail.html,
            text: digitalProductEmail.text,
          });
          if (result.success) {
            console.log(`[sendOrderConfirmationEmails] Digital product purchase email sent for ${item.productTitle}`);
          } else {
            console.error(`[sendOrderConfirmationEmails] Failed to send digital product purchase email:`, result.error);
          }
        } catch (err) {
          console.error(`[sendOrderConfirmationEmails] Exception sending digital product purchase email:`, err);
        }
      }

      // Teacher purchase notification email
      if (teacher?.email) {
        const teacherNotifEmail = emailTemplatesExtra.newPurchaseNotification(
          teacher.displayName,
          studentName,
          item.productTitle,
          "digital product",
          Number(item.priceAtPurchase)
        );
        try {
          const result = await sendEmail({
            to: teacher.email,
            subject: teacherNotifEmail.subject,
            html: teacherNotifEmail.html,
            text: teacherNotifEmail.text,
          });
          if (result.success) {
            console.log(`[sendOrderConfirmationEmails] Teacher purchase notification sent for digital product ${item.productTitle}`);
          } else {
            console.error(`[sendOrderConfirmationEmails] Failed to send teacher purchase notification:`, result.error);
          }
        } catch (err) {
          console.error(`[sendOrderConfirmationEmails] Exception sending teacher purchase notification:`, err);
        }
      }
    }
  }

  // Send promo code used notification to teacher
  let usedPromoCodeString: string | null = null;
  try {
    const orderWithPromo = await db.selectFrom("orders").select("promoCodeId").where("id", "=", orderId).executeTakeFirst();
    if (orderWithPromo?.promoCodeId) {
      const promoCode = await db.selectFrom("promoCodes")
        .innerJoin("users as teacher", "promoCodes.createdByTeacherId", "teacher.id")
        .select(["promoCodes.code", "teacher.email as teacherEmail", "teacher.displayName as teacherName"])
        .where("promoCodes.id", "=", orderWithPromo.promoCodeId)
        .executeTakeFirst();

      if (promoCode) {
        usedPromoCodeString = promoCode.code;

        if (promoCode.teacherEmail) {
          const discountResult = await db.selectFrom("orderItems")
            .select([sql<string>`COALESCE(SUM(discount_amount), 0)`.as("totalDiscount")])
            .where("orderId", "=", orderId)
            .executeTakeFirst();
          const discountAmount = Number(discountResult?.totalDiscount || 0);

                    await sendTemplateEmail("promo_code_used", promoCode.teacherEmail, {
            teacherName: promoCode.teacherName,
            studentName: studentName,
            promoCode: promoCode.code,
            discountAmount: String(discountAmount),
          }).catch(err => console.error("[sendOrderConfirmationEmails] Failed to send promo code used notification:", err));
        }
      }
    }
  } catch (err) {
    console.error("[sendOrderConfirmationEmails] Failed to process promo code notification:", err);
  }

  // Send transaction email to transactions@testkart.in for every order
  try {
    const itemRows: EmailTableRow[] = items.map(item => ({
      label: `${item.title} (${item.type.replace('_', ' ')})`,
      value: `₹${item.price}`,
    }));
    itemRows.push({ label: "Total Amount", value: `₹${Number(order.totalAmount)}`, emphasize: true });

    const transactionsHtml = getBrandedEmailHtml({
      title: "New Order Completed",
      icon: "🧾",
      accent: "info",
      heading: "New Order Completed",
      subheading: `Order #${orderId}`,
      bodyHtml: `
        <p style="margin:0 0 8px;"><strong>Student:</strong> ${studentName} (${studentEmail ?? "no email on file"})</p>
        <p style="margin:0 0 8px;"><strong>Order Date:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</p>
        <p style="margin:0;"><strong>Promo Code Used:</strong> ${usedPromoCodeString ? usedPromoCodeString : "None"}</p>
      `,
      table: itemRows,
      footerNote: "This is an automated transaction notification sent from Testkart.",
    });

        await sendEmail({
      to: "transactions@testkart.in",
      subject: `New Order Completed - #${orderId}`,
      html: transactionsHtml,
    }).catch(err => console.error("[sendOrderConfirmationEmails] Failed to send transactions notification email:", err));
  } catch (err) {
    console.error("[sendOrderConfirmationEmails] Failed to generate transactions notification email:", err);
  }
}