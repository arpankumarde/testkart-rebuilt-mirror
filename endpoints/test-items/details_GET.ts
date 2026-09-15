import { db } from "../../helpers/db";
import { schema, OutputType } from "./details_GET.schema";
import superjson from 'superjson';
import { ZodError } from "zod";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { hasStudentAccessToTestItem } from "../../helpers/hasStudentPurchasedTestItem";

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const testItemId = url.searchParams.get('testItemId');

  try {
    const validatedInput = schema.parse({ testItemId });

    // Fetch the main item details with package and teacher info
    const result = await db
      .selectFrom('mockTestItems')
      .innerJoin('mockTests', 'mockTests.id', 'mockTestItems.packageId')
      .innerJoin('users', 'users.id', 'mockTests.teacherId')
      .where('mockTestItems.id', '=', validatedInput.testItemId)
      .select([
        'mockTestItems.id as itemId',
        'mockTestItems.title as itemTitle',
        'mockTestItems.durationMinutes',
        'mockTestItems.isFree',
        'mockTestItems.calculatorEnabled',
        'mockTestItems.orderIndex',
        'mockTestItems.scheduledDate',
        'mockTestItems.createdAt as itemCreatedAt',
        'mockTestItems.subjectWiseTiming',
        'mockTestItems.questionWiseTiming',
        'mockTests.id as packageId',
        'mockTests.title as packageTitle',
        'mockTests.isPublished',
        'users.displayName as teacherName',
      ])
      .executeTakeFirst();

    if (!result) {
      return new Response(superjson.stringify({ error: "Test item not found." }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!result.isPublished) {
      // Allow access if the user is authenticated and has purchased/enrolled in the test
      let hasAccess = false;
      try {
        const { user } = await getServerUserSession(request);
        hasAccess = await hasStudentAccessToTestItem(user.id, validatedInput.testItemId);
        console.log(`Unpublished test item ${validatedInput.testItemId}: user ${user.id} hasAccess=${hasAccess}`);
      } catch (sessionError) {
        // User is not authenticated - no access to unpublished test
        console.log(`Unpublished test item ${validatedInput.testItemId}: unauthenticated request`);
      }

      if (!hasAccess) {
        return new Response(superjson.stringify({ error: "This test is not published." }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch subjects for this test item with question counts
    const subjectRows = await db
      .selectFrom('testItemSubjects')
      .where('testItemSubjects.testItemId', '=', validatedInput.testItemId)
      .select([
        'testItemSubjects.id',
        'testItemSubjects.subjectName',
        'testItemSubjects.durationMinutes',
      ])
      .select((eb) =>
        eb
          .selectFrom('testQuestions')
          .whereRef('testQuestions.subjectId', '=', 'testItemSubjects.id')
          .select(eb.fn.countAll<number>().as('count'))
          .as('questionCount')
      )
      .orderBy('testItemSubjects.orderIndex', 'asc')
      .execute();

    // Fetch marks info from testQuestions for this test item (via subjects)
    // We aggregate positiveMarks and negativeMarks from the first question as representative values,
    // and sum positiveMarks for totalMarks
    const marksRows = await db
      .selectFrom('testQuestions')
      .innerJoin('testItemSubjects', 'testItemSubjects.id', 'testQuestions.subjectId')
      .where('testItemSubjects.testItemId', '=', validatedInput.testItemId)
      .select([
        db.fn.sum<string>('testQuestions.positiveMarks').as('totalMarks'),
        db.fn.count<number>('testQuestions.id').as('totalQuestions'),
      ])
      .executeTakeFirst();

    // Get representative positive/negative marks from first question
    const firstQuestion = await db
      .selectFrom('testQuestions')
      .innerJoin('testItemSubjects', 'testItemSubjects.id', 'testQuestions.subjectId')
      .where('testItemSubjects.testItemId', '=', validatedInput.testItemId)
      .select([
        'testQuestions.positiveMarks',
        'testQuestions.negativeMarks',
      ])
      .orderBy('testQuestions.orderIndex', 'asc')
      .limit(1)
      .executeTakeFirst();

    const totalQuestions = Number(marksRows?.totalQuestions ?? 0);
    const totalMarks = Number(marksRows?.totalMarks ?? 0);
    const positiveMarks = Number(firstQuestion?.positiveMarks ?? 0);
    const negativeMarks = Number(firstQuestion?.negativeMarks ?? 0);

    console.log(
      `Test item ${result.itemId}: totalQuestions=${totalQuestions}, totalMarks=${totalMarks}, ` +
      `positiveMarks=${positiveMarks}, negativeMarks=${negativeMarks}, subjects=${subjectRows.length}`
    );

    const responseData: OutputType = {
      item: {
        id: result.itemId,
        title: result.itemTitle,
        durationMinutes: result.durationMinutes,
        totalQuestions,
        isFree: result.isFree,
        calculatorEnabled: result.calculatorEnabled,
        orderIndex: result.orderIndex,
        scheduledDate: result.scheduledDate,
        createdAt: result.itemCreatedAt,
        subjectWiseTiming: result.subjectWiseTiming,
        questionWiseTiming: result.questionWiseTiming,
        totalMarks,
        positiveMarks,
        negativeMarks,
        subjects: subjectRows.map((s) => ({
          id: s.id,
          subjectName: s.subjectName,
          durationMinutes: s.durationMinutes,
          questionCount: Number(s.questionCount ?? 0),
        })),
      },
      package: {
        id: result.packageId,
        title: result.packageTitle,
        teacherName: result.teacherName,
      },
    };

    return new Response(superjson.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input.", details: error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.error("Error fetching test item details:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}