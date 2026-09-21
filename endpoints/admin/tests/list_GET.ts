import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const tests = await db
      .selectFrom("mockTests")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .leftJoin("exams", "exams.id", "mockTests.examId")
      .select([
        "mockTests.id",
        "mockTests.title",
        "mockTests.slug",
        "mockTests.isPublished",
        "mockTests.createdAt",
        "mockTests.deletedAt",
        "mockTests.studentsEnrolled",
        "mockTests.totalTests",
        "mockTests.price",
        "mockTests.rating",
        "mockTests.reviewsCount",
        "mockTests.totalQuestions",
        "mockTests.isFree",
        "mockTests.description",
        "mockTests.thumbnailUrl",
        "mockTests.language",
        "mockTests.discountPrice",
        "mockTests.freeTestsCount",
        "users.displayName as teacherName",
        "users.id as teacherId",
        "exams.examSlug",
        "exams.examName",
      ])
      .select((eb) =>
        eb
          .selectFrom("testQuestions")
          .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
          .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          .where("testQuestions.isAiGenerated", "=", true)
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("aiQuestionsCount")
      )
      .select((eb) =>
        eb
          .selectFrom("testQuestions")
          .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
          .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          .where((eb2) =>
            eb2.or([
              eb2("testQuestions.isAiGenerated", "=", false),
              eb2("testQuestions.isAiGenerated", "is", null),
            ])
          )
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("manualQuestionsCount")
      )
      .select((eb) =>
        eb
          .selectFrom("orders")
          .innerJoin("orderItems", "orderItems.orderId", "orders.id")
          .whereRef("orderItems.mockTestId", "=", "mockTests.id")
          .where("orders.status", "=", "completed")
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("totalOrders")
      )
      // Live counts with the catalogue dashboard's conditions, so its empty-series
      // and tests-without-questions tiles can land on the same rows here.
      .select((eb) =>
        eb
          .selectFrom("mockTestItems")
          .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          .where("mockTestItems.deletedAt", "is", null)
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("liveItemCount")
      )
      .select((eb) =>
        eb
          .selectFrom("mockTestItems")
          .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          .where("mockTestItems.deletedAt", "is", null)
          .where((eb2) =>
            eb2.not(
              eb2.exists(
                eb2
                  .selectFrom("testQuestions")
                  .whereRef("testQuestions.testId", "=", "mockTestItems.id")
                  .select("testQuestions.id")
              )
            )
          )
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("emptyTestCount")
      )
      .orderBy("mockTests.createdAt", "desc")
      .execute();

    const output: OutputType = tests.map((test) => ({
      ...test,
      price: Number(test.price),
      discountPrice: test.discountPrice != null ? Number(test.discountPrice) : null,
      rating: test.rating != null ? Number(test.rating) : null,
      aiQuestionsCount: Number(test.aiQuestionsCount ?? 0),
      manualQuestionsCount: Number(test.manualQuestionsCount ?? 0),
      totalOrders: Number(test.totalOrders ?? 0),
      liveItemCount: Number(test.liveItemCount ?? 0),
      emptyTestCount: Number(test.emptyTestCount ?? 0),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin tests list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}