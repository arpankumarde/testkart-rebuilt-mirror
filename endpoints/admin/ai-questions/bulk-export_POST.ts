import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema } from "./bulk-export_POST.schema";
import superjson from "superjson";
import * as xlsx from "xlsx";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const json = superjson.parse(await request.text());
    const { ids, filters } = schema.parse(json);

    let query = db
      .selectFrom("testQuestions")
      .innerJoin("mockTestItems", "testQuestions.testId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .innerJoin("users", "mockTests.teacherId", "users.id")
      .innerJoin("exams", "mockTests.examId", "exams.id")
      .leftJoin("testItemSubjects", "testQuestions.subjectId", "testItemSubjects.id")
      .where("testQuestions.isAiGenerated", "=", true);

    if (ids && ids.length > 0) {
      query = query.where("testQuestions.id", "in", ids);
    } else if (filters) {
      if (filters.examId) query = query.where("mockTests.examId", "=", filters.examId);
      if (filters.teacherId) query = query.where("mockTests.teacherId", "=", filters.teacherId);
      if (filters.hasCustomPrompt === true) query = query.where(sql`"testQuestions"."ai_generation_metadata"->>'customPrompt'`, 'is not', null);
      if (filters.hasCustomPrompt === false) query = query.where(sql`"testQuestions"."ai_generation_metadata"->>'customPrompt'`, 'is', null);
      if (filters.dateFrom) query = query.where("testQuestions.createdAt", ">=", new Date(filters.dateFrom));
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setDate(toDate.getDate() + 1);
        query = query.where("testQuestions.createdAt", "<", toDate);
      }
      if (filters.markedForReview !== undefined) query = query.where("testQuestions.markedForReview", "=", filters.markedForReview);
      if (filters.searchQuery) query = query.where("testQuestions.questionText", "ilike", `%${filters.searchQuery}%`);
    }

    const questions = await query
      .select([
        "testQuestions.questionText",
        "testQuestions.optionA",
        "testQuestions.optionB",
        "testQuestions.optionC",
        "testQuestions.optionD",
        "testQuestions.optionE",
        "testQuestions.correctOption",
        "testQuestions.explanation",
        "testItemSubjects.subjectName",
        "mockTestItems.title as testItemTitle",
        "exams.examName",
        "users.displayName as teacherName",
        "testQuestions.createdAt",
        "testQuestions.markedForReview",
        "testQuestions.aiGenerationMetadata",
      ])
      .orderBy("testQuestions.createdAt", "desc")
      .execute();

    const dataToExport = questions.map(q => ({
      "Question": q.questionText,
      "Option A": q.optionA,
      "Option B": q.optionB,
      "Option C": q.optionC,
            "Option D": q.optionD,
      "Option E": q.optionE || "",
      "Correct Answer": q.correctOption,
      "Explanation": q.explanation,
      "Subject": q.subjectName,
      "Test Item": q.testItemTitle,
      "Exam": q.examName,
      "Teacher": q.teacherName,
      "Created At": q.createdAt,
      "Has Custom Prompt": (q.aiGenerationMetadata as any)?.customPrompt ? "Yes" : "No",
      "Marked For Review": q.markedForReview ? "Yes" : "No",
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "AI Questions");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ai-questions-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error("[admin/ai-questions/bulk-export_POST] Error exporting AI questions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}