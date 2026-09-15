import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./questions_GET.schema";
import superjson from "superjson";
import { hasStudentAccessToTestItem } from "../../../helpers/hasStudentPurchasedTestItem";
import { getLiveTestForTestItem, liveTestWindowError } from "../../../helpers/liveTestAttemptWindow";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can access this." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const testItemId = url.searchParams.get("testItemId");

    const input = schema.parse({
      testItemId: testItemId ? parseInt(testItemId, 10) : undefined,
    });

    const hasAccess = await hasStudentAccessToTestItem(
      user.id,
      input.testItemId
    );
    if (!hasAccess) {
      return new Response(
        superjson.stringify({
          error: "You have not purchased this test or it is not available.",
        }),
        { status: 403 }
      );
    }

    // Fetch test item details including calculatorEnabled
    const liveTestPaper = await getLiveTestForTestItem(input.testItemId);
    const windowError = liveTestPaper ? liveTestWindowError(liveTestPaper, "continue") : null;
    if (windowError) {
      return new Response(superjson.stringify({ error: windowError }), { status: 403 });
    }

    const testItem = await db
      .selectFrom("mockTestItems")
      .select(["calculatorEnabled", "subjectWiseTiming", "questionWiseTiming"])
      .where("id", "=", input.testItemId)
      .executeTakeFirst();

    if (!testItem) {
      return new Response(
        superjson.stringify({ error: "Test item not found." }),
        { status: 404 }
      );
    }

    const questions = await db
      .selectFrom("testQuestions")
      .leftJoin(
        "testItemSubjects",
        "testQuestions.subjectId",
        "testItemSubjects.id"
      )
      .leftJoin(
        "subjectSections",
        "testQuestions.sectionId",
        "subjectSections.id"
      )
      .select([
        "testQuestions.id",
        "testQuestions.questionText",
        "testQuestions.questionType",
        "testQuestions.optionA",
        "testQuestions.optionB",
        "testQuestions.optionC",
        "testQuestions.optionD",
        "testQuestions.optionE",
        "testQuestions.paragraphText",
        "testQuestions.paragraphId",
        "testQuestions.matchData",
        "testQuestions.positiveMarks",
        "testQuestions.negativeMarks",
        "testQuestions.partialMarking",
        "testQuestions.durationSeconds",
        "testQuestions.subjectId",
        "testQuestions.sectionId",
        "testQuestions.aiGenerationMetadata",
        "testQuestions.isAiGenerated",
        "testItemSubjects.subjectName",
        "testItemSubjects.orderIndex as subjectOrderIndex",
        "testItemSubjects.maxAttemptsAllowed as subjectMaxAttemptsAllowed",
        "testItemSubjects.durationMinutes as subjectDurationMinutes",
        "subjectSections.sectionName",
        "subjectSections.orderIndex as sectionOrderIndex",
        "subjectSections.maxAttemptsAllowed as sectionMaxAttemptsAllowed",
      ])
      .where("testQuestions.testId", "=", input.testItemId)
      .orderBy("testItemSubjects.orderIndex", "asc")
            .orderBy("subjectSections.orderIndex", "asc")
      .orderBy("testQuestions.orderIndex", "asc")
      .orderBy("testQuestions.id", "asc")
      .execute();

    // Sanitize matchData to remove correctMatches for match_the_following questions
    const sanitizedQuestions = questions.map((q) => {
      if (q.questionType === "match_the_following" && q.matchData) {
        // Remove correctMatches from matchData
        const matchData = q.matchData as {
          leftItems?: unknown[];
          rightItems?: unknown[];
          correctMatches?: unknown;
        };
        return {
          ...q,
          matchData: {
            leftItems: matchData.leftItems,
            rightItems: matchData.rightItems,
          },
        };
      }
      return q;
    });

    const response: OutputType = {
      calculatorEnabled: testItem.calculatorEnabled,
      subjectWiseTiming: testItem.subjectWiseTiming,
      questionWiseTiming: testItem.questionWiseTiming,
      questions: sanitizedQuestions as OutputType['questions'],
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Error fetching questions for student:", error);
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