import { db } from "./db";
import type { CustomExamNameCount } from "./duplicateExamNames";

// Shared by the custom-names list endpoint and the duplicate-detection
// endpoint so both see the exact same underlying counts — a free-text exam
// name is just any distinct `examName` on a mockTest/digitalProduct row
// that was never linked to a curated `exams` row (examId is null).
export async function getCustomExamNameCounts(): Promise<CustomExamNameCount[]> {
  const mockTestsCounts = await db
    .selectFrom("mockTests")
    .select(["examName as name", db.fn.count<number | string>("id").as("count")])
    .where("examId", "is", null)
    .where("examName", "is not", null)
    .where("examName", "!=", "")
    .groupBy("examName")
    .execute();

  const digitalProductCounts = await db
    .selectFrom("digitalProducts")
    .select(["examName as name", db.fn.count<number | string>("id").as("count")])
    .where("examId", "is", null)
    .where("examName", "is not", null)
    .where("examName", "!=", "")
    .groupBy("examName")
    .execute();

  const map = new Map<string, { mockTestCount: number; productCount: number; liveTestCount: number }>();

  for (const row of mockTestsCounts) {
    if (row.name) {
      map.set(row.name, { mockTestCount: Number(row.count), productCount: 0, liveTestCount: 0 });
    }
  }

  for (const row of digitalProductCounts) {
    if (row.name) {
      const existing = map.get(row.name) || { mockTestCount: 0, productCount: 0, liveTestCount: 0 };
      existing.productCount = Number(row.count);
      map.set(row.name, existing);
    }
  }

  return Array.from(map.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort(
      (a, b) =>
        b.mockTestCount + b.productCount + b.liveTestCount - (a.mockTestCount + a.productCount + a.liveTestCount)
    );
}
