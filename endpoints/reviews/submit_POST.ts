import { db } from "../../helpers/db";
import { schema, OutputType } from "./submit_POST.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { emailTemplatesExtra } from "../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../helpers/sendEmail";
import superjson from 'superjson';
import { ZodError } from "zod";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== 'student') {
      return new Response(superjson.stringify({ error: "Only students can submit reviews." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);
    const { mockTestId, digitalProductId, courseId, rating, reviewText } = validatedInput;

    // Handle mock test reviews
    if (mockTestId !== undefined) {
      // 1. Check if the student has completed at least one test item for this mock test package.
      const completedAttempt = await db
        .selectFrom('testAttempts')
        .innerJoin('mockTestItems', 'testAttempts.testId', 'mockTestItems.id')
        .where('testAttempts.studentId', '=', user.id)
        .where('mockTestItems.packageId', '=', mockTestId)
        .where('testAttempts.completedAt', 'is not', null)
        .select('testAttempts.id')
        .limit(1)
        .executeTakeFirst();

      if (!completedAttempt) {
        return new Response(superjson.stringify({ error: "You must complete a test before reviewing." }), { status: 403 });
      }

      // 2. Check if the user has already reviewed this mock test.
      const existingReview = await db
        .selectFrom('reviews')
        .where('userId', '=', user.id)
        .where('mockTestId', '=', mockTestId)
        .select('id')
        .limit(1)
        .executeTakeFirst();

      const isUpdate = !!existingReview;

      // 3. Create or update the review and update stats in a single transaction
      await db.transaction().execute(async (trx) => {
        if (isUpdate) {
          // Update the existing review
          await trx
            .updateTable('reviews')
            .set({
              rating,
              reviewText: reviewText || null,
              updatedAt: new Date(),
            })
            .where('id', '=', existingReview.id)
            .execute();
        } else {
          // Insert the review
          await trx
            .insertInto('reviews')
            .values({
              userId: user.id,
              mockTestId,
              digitalProductId: null,
              rating,
              reviewText: reviewText || null,
              reviewerName: user.displayName,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .execute();
        }

        // Calculate stats - this will see the just-inserted review
        const stats = await trx
          .selectFrom('reviews')
          .where('mockTestId', '=', mockTestId)
          .select([
            trx.fn.avg<number>('rating').as('avgRating'),
            trx.fn.count<number>('id').as('totalReviews')
          ])
          .executeTakeFirstOrThrow();

        // Update mockTests with the calculated stats
        await trx
          .updateTable('mockTests')
          .set({
            rating: stats.avgRating,
            reviewsCount: Number(stats.totalReviews),
            updatedAt: new Date(),
          })
          .where('id', '=', mockTestId)
          .execute();
      });

      console.log(`Review submitted for mock test ${mockTestId} by user ${user.id}`);

      // Send email to teacher about new review
      if (!isUpdate) {
        try {
          const info = await db.selectFrom("mockTests")
            .innerJoin("users as teacher", "mockTests.teacherId", "teacher.id")
            .select(["mockTests.title", "teacher.email as teacherEmail", "teacher.displayName as teacherName"])
            .where("mockTests.id", "=", mockTestId)
            .executeTakeFirst();

          if (info?.teacherEmail) {
            const template = emailTemplatesExtra.newReviewReceived(
              info.teacherName,
              user.displayName,
              info.title,
              "test",
              rating,
              reviewText
            );
            await sendEmail({ to: info.teacherEmail, ...template });
          }
        } catch (err) {
          console.error("Failed to send newReviewReceived email for mock test:", err);
        }
      }

      const successMessage = isUpdate ? "Review updated successfully." : "Review submitted successfully.";
      return new Response(superjson.stringify({ success: true, message: successMessage } satisfies OutputType));
    }

    // Handle digital product reviews
    if (digitalProductId !== undefined) {
      // 1. Check if the student has purchased this digital product
      const purchase = await db
        .selectFrom('digitalProductPurchases')
        .where('studentId', '=', user.id)
        .where('productId', '=', digitalProductId)
        .select('id')
        .limit(1)
        .executeTakeFirst();

      if (!purchase) {
        return new Response(superjson.stringify({ error: "You must purchase this product before reviewing." }), { status: 403 });
      }

      // 2. Check if the user has already reviewed this digital product
      const existingReview = await db
        .selectFrom('reviews')
        .where('userId', '=', user.id)
        .where('digitalProductId', '=', digitalProductId)
        .select('id')
        .limit(1)
        .executeTakeFirst();

      const isUpdate = !!existingReview;

      // 3. Create or update the review and update stats in a single transaction
      await db.transaction().execute(async (trx) => {
        if (isUpdate) {
          // Update the existing review
          await trx
            .updateTable('reviews')
            .set({
              rating,
              reviewText: reviewText || null,
              updatedAt: new Date(),
            })
            .where('id', '=', existingReview.id)
            .execute();
        } else {
          // Insert the review
          await trx
            .insertInto('reviews')
            .values({
              userId: user.id,
              mockTestId: null, // null for digital product reviews
              digitalProductId,
              rating,
              reviewText: reviewText || null,
              reviewerName: user.displayName,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .execute();
        }

        // Calculate stats - this will see the just-inserted review
        const stats = await trx
          .selectFrom('reviews')
          .where('digitalProductId', '=', digitalProductId)
          .select([
            trx.fn.avg<number>('rating').as('avgRating'),
            trx.fn.count<number>('id').as('totalReviews')
          ])
          .executeTakeFirstOrThrow();

        // Update digitalProducts with the calculated stats
        await trx
          .updateTable('digitalProducts')
          .set({
            rating: stats.avgRating,
            reviewsCount: Number(stats.totalReviews),
            updatedAt: new Date(),
          })
          .where('id', '=', digitalProductId)
          .execute();
      });

      console.log(`Review submitted for digital product ${digitalProductId} by user ${user.id}`);

      // Send email to teacher about new review
      if (!isUpdate) {
        try {
          const info = await db.selectFrom("digitalProducts")
            .innerJoin("users as teacher", "digitalProducts.teacherId", "teacher.id")
            .select(["digitalProducts.title", "teacher.email as teacherEmail", "teacher.displayName as teacherName"])
            .where("digitalProducts.id", "=", digitalProductId)
            .executeTakeFirst();

          if (info?.teacherEmail) {
            const template = emailTemplatesExtra.newReviewReceived(
              info.teacherName,
              user.displayName,
              info.title,
              "product",
              rating,
              reviewText
            );
            await sendEmail({ to: info.teacherEmail, ...template });
          }
        } catch (err) {
          console.error("Failed to send newReviewReceived email for digital product:", err);
        }
      }

      const successMessage = isUpdate ? "Review updated successfully." : "Review submitted successfully.";
      return new Response(superjson.stringify({ success: true, message: successMessage } satisfies OutputType));
    }

    // This should never happen due to schema validation, but just in case
    // Handle course reviews
    if (courseId !== undefined) {
      // 1. Check if the student is enrolled in this course
      const enrollment = await db
        .selectFrom('courseEnrollments')
        .where('studentId', '=', user.id)
        .where('courseId', '=', courseId)
        .select('id')
        .limit(1)
        .executeTakeFirst();

      if (!enrollment) {
        return new Response(superjson.stringify({ error: "You must enroll in this course before reviewing." }), { status: 403 });
      }

      // 2. Check if the user has already reviewed this course
      const existingReview = await db
        .selectFrom('reviews')
        .where('userId', '=', user.id)
        .where('courseId', '=', courseId)
        .select('id')
        .limit(1)
        .executeTakeFirst();

      const isUpdate = !!existingReview;

      // 3. Create or update the review and update stats in a single transaction
      await db.transaction().execute(async (trx) => {
        if (isUpdate) {
          // Update the existing review
          await trx
            .updateTable('reviews')
            .set({
              rating,
              reviewText: reviewText || null,
              updatedAt: new Date(),
            })
            .where('id', '=', existingReview.id)
            .execute();
        } else {
          // Insert the review
          await trx
            .insertInto('reviews')
            .values({
              userId: user.id,
              mockTestId: null,
              digitalProductId: null,
              courseId,
              rating,
              reviewText: reviewText || null,
              reviewerName: user.displayName,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .execute();
        }

        // Calculate stats - this will see the just-inserted review
        const stats = await trx
          .selectFrom('reviews')
          .where('courseId', '=', courseId)
          .select([
            trx.fn.avg<number>('rating').as('avgRating'),
            trx.fn.count<number>('id').as('totalReviews')
          ])
          .executeTakeFirstOrThrow();

        // Update courses with the calculated stats
        await trx
          .updateTable('courses')
          .set({
            rating: stats.avgRating,
            reviewsCount: Number(stats.totalReviews),
            updatedAt: new Date(),
          })
          .where('id', '=', courseId)
          .execute();
      });

      console.log(`Review submitted for course ${courseId} by user ${user.id}`);

      // Send email to teacher about new review
      if (!isUpdate) {
        try {
          const info = await db.selectFrom("courses")
            .innerJoin("users as teacher", "courses.teacherId", "teacher.id")
            .select(["courses.title", "teacher.email as teacherEmail", "teacher.displayName as teacherName"])
            .where("courses.id", "=", courseId)
            .executeTakeFirst();

          if (info?.teacherEmail) {
            const template = emailTemplatesExtra.newReviewReceived(
              info.teacherName,
              user.displayName,
              info.title,
              "course",
              rating,
              reviewText
            );
            await sendEmail({ to: info.teacherEmail, ...template });
          }
        } catch (err) {
          console.error("Failed to send newReviewReceived email for course:", err);
        }
      }

      const successMessage = isUpdate ? "Review updated successfully." : "Review submitted successfully.";
      return new Response(superjson.stringify({ success: true, message: successMessage } satisfies OutputType));
    }

    // This should never happen due to schema validation, but just in case
    return new Response(superjson.stringify({ error: "Invalid request: no product specified." }), { status: 400 });

  } catch (error) {
    console.error("Error submitting review:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input provided.", details: error.errors }), { status: 400 });
    }
    if (error instanceof Error && error.name === 'NotAuthenticatedError') {
        return new Response(superjson.stringify({ error: "You must be logged in to submit a review." }), { status: 401 });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}