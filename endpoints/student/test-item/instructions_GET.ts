import { db } from "../../../helpers/db";
import { schema, OutputType } from "./instructions_GET.schema";
import superjson from 'superjson';
import { ZodError } from "zod";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { hasStudentAccessToTestItem } from "../../../helpers/hasStudentPurchasedTestItem";
import { getLiveTestForTestItem } from "../../../helpers/liveTestAttemptWindow";

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const testItemId = url.searchParams.get('testItemId');

  try {
    const validatedInput = schema.parse({ testItemId });

    // 1. Fetch item + package + teacher
    const itemResult = await db
      .selectFrom('mockTestItems')
      .innerJoin('mockTests', 'mockTests.id', 'mockTestItems.packageId')
      .innerJoin('users', 'users.id', 'mockTests.teacherId')
      .where('mockTestItems.id', '=', validatedInput.testItemId)
      .select([
        'mockTestItems.id',
        'mockTestItems.title',
        'mockTestItems.description',
        'mockTestItems.durationMinutes',
        'mockTestItems.isFree',
        'mockTestItems.calculatorEnabled',
        'mockTestItems.subjectWiseTiming',
        'mockTestItems.questionWiseTiming',
        'mockTestItems.scheduledDate',
        'mockTests.id as packageId',
        'mockTests.title as packageTitle',
        'mockTests.thumbnailUrl',
        'mockTests.isPublished',
        'users.displayName as teacherName'
      ])
      .executeTakeFirst();

    if (!itemResult) {
      return new Response(superjson.stringify({ error: "Test item not found." }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Check Auth & Access
    let studentId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      studentId = user.id;
    } catch (e) {
      // Unauthenticated request
    }

    let hasAccess = false;
    if (studentId) {
      hasAccess = await hasStudentAccessToTestItem(studentId, validatedInput.testItemId);
    } else if (itemResult.isFree) {
      // A live test paper needs a live test enrollment, whatever its isFree flag says
      hasAccess = !(await getLiveTestForTestItem(validatedInput.testItemId));
    }

    // If test is not published, forbid access unless they still hold actual enrollment/access.
    if (!itemResult.isPublished && !hasAccess) {
      return new Response(superjson.stringify({ error: "This test is not published." }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch Subjects with question counts
    const subjectsRows = await db
      .selectFrom('testItemSubjects')
      .where('testItemSubjects.testItemId', '=', validatedInput.testItemId)
      .select((eb) => [
        'id',
        'subjectName',
        'durationMinutes',
        'maxAttemptsAllowed',
        eb.selectFrom('testQuestions')
          .whereRef('testQuestions.subjectId', '=', 'testItemSubjects.id')
          .select(eb.fn.countAll<number>().as('count'))
          .as('questionCount')
      ])
      .orderBy('orderIndex', 'asc')
      .execute();

    // 4. Fetch Sections with question counts
    const subjectIds = subjectsRows.map(s => s.id);
    let sectionsRows: any[] = [];
    if (subjectIds.length > 0) {
      sectionsRows = await db
        .selectFrom('subjectSections')
        .where('subjectSections.subjectId', 'in', subjectIds)
        .select((eb) => [
          'id',
          'sectionName',
          'maxAttemptsAllowed',
          'subjectId',
          eb.selectFrom('testQuestions')
            .whereRef('testQuestions.sectionId', '=', 'subjectSections.id')
            .select(eb.fn.countAll<number>().as('count'))
            .as('questionCount')
        ])
        .orderBy('orderIndex', 'asc')
        .execute();
    }

    // 5. Fetch Marks Info and total questions
    const marksRows = await db
      .selectFrom('testQuestions')
      .where('testQuestions.testId', '=', validatedInput.testItemId)
      .select([
        db.fn.sum<string>('positiveMarks').as('totalMarks'),
        db.fn.countAll<number>().as('totalQuestions')
      ])
      .executeTakeFirst();

    const firstQuestion = await db
      .selectFrom('testQuestions')
      .where('testQuestions.testId', '=', validatedInput.testItemId)
      .select(['positiveMarks', 'negativeMarks'])
      .orderBy('orderIndex', 'asc')
      .limit(1)
      .executeTakeFirst();

    const totalQuestions = Number(marksRows?.totalQuestions ?? 0);
    const totalMarks = Number(marksRows?.totalMarks ?? 0);
    const positiveMarks = Number(firstQuestion?.positiveMarks ?? 0);
    const negativeMarks = Number(firstQuestion?.negativeMarks ?? 0);

    // 6. Check Previous Attempts
    const previousAttempt = {
      hasAttempted: false,
      attemptCount: 0,
      lastAttempt: null as OutputType['previousAttempt']['lastAttempt']
    };

    if (studentId) {
      const attempts = await db
        .selectFrom('testAttempts')
        .where('testId', '=', validatedInput.testItemId)
        .where('studentId', '=', studentId)
        .select(['id', 'score', 'totalQuestions', 'startedAt', 'completedAt'])
        .orderBy('startedAt', 'desc')
        .execute();

      if (attempts.length > 0) {
        previousAttempt.hasAttempted = true;
        previousAttempt.attemptCount = attempts.length;
        previousAttempt.lastAttempt = {
          score: attempts[0].score !== null ? Number(attempts[0].score) : null,
          totalQuestions: attempts[0].totalQuestions,
          startedAt: attempts[0].startedAt,
          completedAt: attempts[0].completedAt,
        };
      }
    }

    const output: OutputType = {
      testItem: {
        id: itemResult.id,
        title: itemResult.title,
        description: itemResult.description,
        durationMinutes: itemResult.durationMinutes,
        totalQuestions,
        totalMarks,
        positiveMarks,
        negativeMarks,
        isFree: itemResult.isFree,
        calculatorEnabled: itemResult.calculatorEnabled,
        subjectWiseTiming: itemResult.subjectWiseTiming,
        questionWiseTiming: itemResult.questionWiseTiming,
        scheduledDate: itemResult.scheduledDate,
      },
      package: {
        id: itemResult.packageId,
        title: itemResult.packageTitle,
        teacherName: itemResult.teacherName,
        thumbnailUrl: itemResult.thumbnailUrl,
      },
      subjects: subjectsRows.map(s => ({
        id: s.id,
        subjectName: s.subjectName,
        durationMinutes: s.durationMinutes,
        questionCount: Number(s.questionCount ?? 0),
        maxAttemptsAllowed: s.maxAttemptsAllowed,
        sections: sectionsRows
          .filter(sec => sec.subjectId === s.id)
          .map(sec => ({
            id: sec.id,
            sectionName: sec.sectionName,
            maxAttemptsAllowed: sec.maxAttemptsAllowed,
            questionCount: Number(sec.questionCount ?? 0),
          }))
      })),
      access: {
        hasAccess,
        isFree: itemResult.isFree,
      },
      previousAttempt,
    };

    return new Response(superjson.stringify(output), {
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

    console.error("Error fetching test item instructions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}