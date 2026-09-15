import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const questionAndOwner = await db
      .selectFrom("testQuestions")
      .innerJoin(
        "mockTestItems",
        "testQuestions.testId",
        "mockTestItems.id"
      )
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select("mockTests.teacherId")
      .where("testQuestions.id", "=", input.questionId)
      .executeTakeFirst();

    if (!questionAndOwner) {
      return new Response(
        superjson.stringify({ error: "Question not found" }),
        { status: 404 }
      );
    }

    if (questionAndOwner.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this question" }),
        { status: 403 }
      );
    }

    const existingQuestion = await db
      .selectFrom("testQuestions")
      .select(["subjectId", "testId"])
      .where("id", "=", input.questionId)
      .executeTakeFirstOrThrow();

    const { questionId, subjectId: requestedSubjectId, ...updateData } = input;

    // Handle type-specific updates
    const updatePayload: any = { ...updateData };

    // A question may only move to another subject of its own test item, and a
    // section must belong to the subject the question ends up in.
    let targetSubjectId = existingQuestion.subjectId;
    if (requestedSubjectId !== undefined && requestedSubjectId !== existingQuestion.subjectId) {
      const subject = await db
        .selectFrom("testItemSubjects")
        .select("id")
        .where("id", "=", requestedSubjectId)
        .where("testItemId", "=", existingQuestion.testId)
        .executeTakeFirst();
      if (!subject) {
        return new Response(
          superjson.stringify({ error: "Subject not found in this test" }),
          { status: 404 }
        );
      }
      targetSubjectId = requestedSubjectId;
      updatePayload.subjectId = requestedSubjectId;
      if (updateData.sectionId === undefined) {
        updatePayload.sectionId = null;
      }
    }

    if (updateData.sectionId != null) {
      const section =
        targetSubjectId == null
          ? undefined
          : await db
              .selectFrom("subjectSections")
              .select("id")
              .where("id", "=", updateData.sectionId)
              .where("subjectId", "=", targetSubjectId)
              .executeTakeFirst();
      if (!section) {
        return new Response(
          superjson.stringify({ error: "Section not found for this subject" }),
          { status: 404 }
        );
      }
    }

    // If changing to numerical type, clear options and set numerical fields
    if (updateData.questionType === "numerical") {
      updatePayload.optionA = null;
      updatePayload.optionB = null;
      updatePayload.optionC = null;
      updatePayload.optionD = null;
      updatePayload.optionE = null;
      updatePayload.correctOption = null;
      updatePayload.correctOptions = null;
      updatePayload.matchData = null;
      updatePayload.paragraphText = null;
    }
    // If changing to multiple_correct_mcq, clear single correctOption
    else if (updateData.questionType === "multiple_correct_mcq") {
      updatePayload.correctOption = null;
      updatePayload.numericalAnswer = null;
      updatePayload.numericalTolerance = null;
      updatePayload.matchData = null;
      updatePayload.paragraphText = null;
    }
    // If changing to single_correct_mcq, clear multiple/numerical/match fields
    else if (updateData.questionType === "single_correct_mcq") {
      updatePayload.correctOptions = null;
      updatePayload.partialMarking = null;
      updatePayload.numericalAnswer = null;
      updatePayload.numericalTolerance = null;
      updatePayload.matchData = null;
      updatePayload.paragraphText = null;
    }
    // If changing to match_the_following, clear options and numerical fields
    else if (updateData.questionType === "match_the_following") {
      updatePayload.optionA = null;
      updatePayload.optionB = null;
      updatePayload.optionC = null;
      updatePayload.optionD = null;
      updatePayload.optionE = null;
      updatePayload.correctOption = null;
      updatePayload.correctOptions = null;
      updatePayload.numericalAnswer = null;
      updatePayload.numericalTolerance = null;
      updatePayload.paragraphText = null;
    }
    // If changing to comprehension, clear numerical and match fields
    else if (updateData.questionType === "comprehension") {
      updatePayload.correctOptions = null;
      updatePayload.partialMarking = null;
      updatePayload.numericalAnswer = null;
      updatePayload.numericalTolerance = null;
      updatePayload.matchData = null;
    }
    // If changing to assertion_reason, clear multiple/numerical/match fields
    else if (updateData.questionType === "assertion_reason") {
      updatePayload.correctOptions = null;
      updatePayload.partialMarking = null;
      updatePayload.numericalAnswer = null;
      updatePayload.numericalTolerance = null;
      updatePayload.matchData = null;
      updatePayload.paragraphText = null;
    }

    const updatedQuestion = await db
      .updateTable("testQuestions")
      .set(updatePayload)
      .where("id", "=", questionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Sync updated question data to question bank
    try {
      await db.updateTable("questionBank")
        .set({
          questionText: updatedQuestion.questionText,
          questionType: updatedQuestion.questionType,
          optionA: updatedQuestion.optionA,
          optionB: updatedQuestion.optionB,
          optionC: updatedQuestion.optionC,
          optionD: updatedQuestion.optionD,
          optionE: updatedQuestion.optionE,
          correctOption: updatedQuestion.correctOption,
          correctOptions: updatedQuestion.correctOptions as any,
          numericalAnswer: updatedQuestion.numericalAnswer,
          numericalTolerance: updatedQuestion.numericalTolerance,
          positiveMarks: updatedQuestion.positiveMarks,
          negativeMarks: updatedQuestion.negativeMarks,
          partialMarking: updatedQuestion.partialMarking,
          matchData: updatedQuestion.matchData as any,
          paragraphText: updatedQuestion.paragraphText,
          explanation: updatedQuestion.explanation,
          durationSeconds: updatedQuestion.durationSeconds,
          updatedAt: sql`now()`,
        })
        .where("sourceTestQuestionId", "=", input.questionId)
        .execute();
    } catch (err) {
      console.error(
        "[update_POST] Failed to sync question update to question bank:",
        err instanceof Error ? err.message : String(err)
      );
    }

    return new Response(superjson.stringify(updatedQuestion satisfies OutputType));
  } catch (error) {
    console.error("Error updating question:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: error.issues.map((issue) => issue.message).join(" ") }),
        { status: 400 }
      );
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