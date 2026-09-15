import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./assign-sections_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const { subjectId, assignments } = input;

    // Collect all question IDs being assigned
    const assignedQuestionIds = assignments.flatMap((a) => a.questionIds);

    // Collect all section IDs being assigned to
    const sectionIds = assignments
      .map((a) => a.sectionId)
      .filter((id): id is number => id !== null);

    return await db.transaction().execute(async (trx) => {
      // 1. Verify ownership of the subject
      const subjectAndOwner = await trx
        .selectFrom("testItemSubjects")
        .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
        .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
        .select(["mockTests.teacherId"])
        .where("testItemSubjects.id", "=", subjectId)
        .executeTakeFirst();

      if (!subjectAndOwner) {
        throw new Error("Subject not found.");
      }

      if (subjectAndOwner.teacherId !== effectiveTeacherId && user.role !== "admin") {
        throw new Error("You do not have permission to modify this subject.");
      }

      // 2. Verify all questions belong to this subject
      if (assignedQuestionIds.length > 0) {
        const questionsInDb = await trx
          .selectFrom("testQuestions")
          .select(["id", "subjectId"])
          .where("id", "in", assignedQuestionIds)
          .execute();

        if (questionsInDb.length !== assignedQuestionIds.length) {
          throw new Error("One or more questions not found.");
        }

        const invalidQuestions = questionsInDb.filter(
          (q) => q.subjectId !== subjectId
        );
        if (invalidQuestions.length > 0) {
          throw new Error("All questions must belong to the given subject.");
        }
      }

      // 3. Verify all provided sections belong to this subject
      if (sectionIds.length > 0) {
        const sectionsInDb = await trx
          .selectFrom("subjectSections")
          .select(["id", "subjectId"])
          .where("id", "in", sectionIds)
          .execute();

        if (sectionsInDb.length !== new Set(sectionIds).size) {
          throw new Error("One or more sections not found.");
        }

        const invalidSections = sectionsInDb.filter(
          (s) => s.subjectId !== subjectId
        );
        if (invalidSections.length > 0) {
          throw new Error("All sections must belong to the given subject.");
        }
      }

      // 4a. Update section IDs for the specified questions
      // We do this individually or batched by section. Since assignments array is manageable, we can do it per assignment group.
      for (const assignment of assignments) {
        if (assignment.questionIds.length > 0) {
          await trx
            .updateTable("testQuestions")
            .set({ sectionId: assignment.sectionId })
            .where("id", "in", assignment.questionIds)
            .execute();
        }
      }

      // 4b. Reorder ALL questions in the subject
      // To do this, we need all questions in the subject.
      const allQuestions = await trx
        .selectFrom("testQuestions")
        .select(["id", "sectionId", "orderIndex"])
        .where("subjectId", "=", subjectId)
        .execute();

      // We need to fetch all sections for the subject to know their orderIndex
      const allSections = await trx
        .selectFrom("subjectSections")
        .select(["id", "orderIndex"])
        .where("subjectId", "=", subjectId)
        .execute();

      const sectionOrderMap = new Map(allSections.map((s) => [s.id, s.orderIndex]));

      // Create a map to quickly find explicit assignments and their relative order
      const assignedOrderMap = new Map<number, { sectionId: number | null; index: number }>();
      for (const assignment of assignments) {
        assignment.questionIds.forEach((qId, index) => {
          assignedOrderMap.set(qId, { sectionId: assignment.sectionId, index });
        });
      }

      // Sort all questions:
      // Primary sort: section orderIndex (null sections go last)
      // Secondary sort: if they are in the assigned list, use that order.
      // If they are not in the assigned list, fallback to their existing orderIndex.
      const sortedQuestions = [...allQuestions].sort((a, b) => {
        const sectionA = a.sectionId;
        const sectionB = b.sectionId;

        // Group by section first
        if (sectionA !== sectionB) {
          if (sectionA === null) return 1; // Unsectioned goes last
          if (sectionB === null) return -1;
          
          const orderA = sectionOrderMap.get(sectionA) ?? 0;
          const orderB = sectionOrderMap.get(sectionB) ?? 0;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
        }

        // Within the same section (or both unsectioned), sort by assignment explicit order, then fallback
        const assignA = assignedOrderMap.get(a.id);
        const assignB = assignedOrderMap.get(b.id);

        if (assignA && assignB) {
          return assignA.index - assignB.index;
        }
        if (assignA && !assignB) return -1; // Assigned questions go before unassigned within the same group
        if (!assignA && assignB) return 1;

        // Fallback to existing orderIndex
        return a.orderIndex - b.orderIndex;
      });

      // 4c. Update orderIndex for all questions
      // We can update them individually or in batches
      const updatePromises = sortedQuestions.map((q, index) => {
        if (q.orderIndex !== index) {
          return trx
            .updateTable("testQuestions")
            .set({ orderIndex: index })
            .where("id", "=", q.id)
            .execute();
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);

      return new Response(
        superjson.stringify({
          success: true,
          message: "Questions assigned to sections successfully.",
        } satisfies OutputType)
      );
    });
  } catch (error) {
    console.error("Error assigning sections:", error);
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