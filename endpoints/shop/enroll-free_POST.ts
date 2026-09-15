import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./enroll-free_POST.schema";
import superjson from "superjson";
import { Transaction, sql } from "kysely";
import { DB } from "../../helpers/schema";
import { sendEmail } from "../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";



async function enrollInFreeProduct(
  trx: Transaction<DB>,
  userId: number,
  digitalProductId: number
): Promise<number> {
  // 1. Check if the product exists, is published, and is free.
  const product = await trx
    .selectFrom("digitalProducts")
    .select(["id", "status", "price"])
    .where("id", "=", digitalProductId)
    .executeTakeFirst();

  if (!product || product.status !== "published") {
    throw new Error("NOT_FOUND");
  }

  if (parseFloat(product.price) !== 0) {
    throw new Error("NOT_FREE");
  }

  // 2. Check if the user has already purchased this product.
  const existingPurchase = await trx
    .selectFrom("digitalProductPurchases")
    .where("productId", "=", digitalProductId)
    .where("studentId", "=", userId)
    .select("id")
    .executeTakeFirst();

  if (existingPurchase) {
    throw new Error("ALREADY_PURCHASED");
  }

  // 3. Create a new order.
  const newOrder = await trx
    .insertInto("orders")
    .values({
      userId: userId,
      totalAmount: "0",
      status: "completed",
      paymentMethod: "free",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // 4. Create the order item.
  await trx
    .insertInto("orderItems")
    .values({
      orderId: newOrder.id,
      digitalProductId: digitalProductId,
      priceAtPurchase: "0",
    })
    .execute();

  // 5. Create the digital product purchase record.
  await trx
    .insertInto("digitalProductPurchases")
    .values({
      studentId: userId,
      productId: digitalProductId,
      orderId: newOrder.id,
      purchasedAt: new Date(),
    })
    .execute();

  // 6. Increment totalPurchases on the digital product
  await trx
    .updateTable("digitalProducts")
    .set({
      totalPurchases: sql<number>`COALESCE(total_purchases, 0) + 1`,
    })
    .where("id", "=", digitalProductId)
    .execute();

  return newOrder.id;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    // Prevent teachers from enrolling in products
    if (user.role === "teacher") {
      console.warn(`Teacher (ID: ${user.id}) attempted to enroll in free digital product`);
      return new Response(
        superjson.stringify({ error: "Teachers cannot enroll in products. Please use a student account." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { digitalProductId } = schema.parse(json);

    const orderId = await db
      .transaction()
      .execute((trx) => enrollInFreeProduct(trx, user.id, digitalProductId));

    // Send enrollment emails
    try {
      const student = await db
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", user.id)
        .executeTakeFirst();

      if (student?.email) {
        // Fetch product and teacher details
        const productWithTeacher = await db
          .selectFrom("digitalProducts")
          .innerJoin("users as teacher", "digitalProducts.teacherId", "teacher.id")
          .select([
            "digitalProducts.title as productTitle",
            "teacher.displayName as teacherName",
            "teacher.email as teacherEmail",
          ])
          .where("digitalProducts.id", "=", digitalProductId)
          .executeTakeFirst();

        if (productWithTeacher) {
          // Student free enrollment email
          const studentEmail = emailTemplatesExtra.digitalProductPurchase(
            student.displayName,
            productWithTeacher.productTitle,
            productWithTeacher.teacherName
          );
          
          const studentResult = await sendEmail({
            to: student.email,
            subject: studentEmail.subject,
            html: studentEmail.html,
            text: studentEmail.text,
          });

          if (studentResult.success) {
            console.log(`[shop/enroll-free] Free product enrollment email sent to student for product ${digitalProductId}`);
          } else {
            console.error(`[shop/enroll-free] Failed to send free product enrollment email:`, studentResult.error);
          }

          // Teacher new purchase notification email
          if (productWithTeacher.teacherEmail) {
            const teacherEmail = emailTemplatesExtra.newPurchaseNotification(
              productWithTeacher.teacherName,
              student.displayName,
              productWithTeacher.productTitle,
              "digital product",
              0
            );
            
            const teacherResult = await sendEmail({
              to: productWithTeacher.teacherEmail,
              subject: teacherEmail.subject,
              html: teacherEmail.html,
              text: teacherEmail.text,
            });

            if (teacherResult.success) {
              console.log(`[shop/enroll-free] Teacher notification email sent for product ${digitalProductId}`);
            } else {
              console.error(`[shop/enroll-free] Failed to send teacher notification email:`, teacherResult.error);
            }
          }

          
        }
      }
    } catch (emailError) {
      console.error(`[shop/enroll-free] Exception sending enrollment emails for product ${digitalProductId}:`, emailError);
    }

    return new Response(
      superjson.stringify({
        orderId: orderId,
        message: "Successfully downloaded the product.",
      } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to enroll in free digital product:", error);
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_FOUND":
          return new Response(
            superjson.stringify({
              error: "Digital product not found or is not published.",
            }),
            { status: 404 }
          );
        case "NOT_FREE":
          return new Response(
            superjson.stringify({ error: "This digital product is not free." }),
            { status: 400 }
          );
        case "ALREADY_PURCHASED":
          return new Response(
            superjson.stringify({ error: "You have already downloaded this product." }),
            { status: 400 }
          );
      }
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to download the free product.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}