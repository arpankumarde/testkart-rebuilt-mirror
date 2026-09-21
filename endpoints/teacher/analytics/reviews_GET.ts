import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str, date, isoDay, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import {
  schema,
  OutputType,
  AnalyticsLatestReview,
  AnalyticsRatingMonth,
  AnalyticsReviewKind,
} from "./reviews_GET.schema";

const LATEST = 5;

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const window = analyticsWindow(range);

    // Every figure comes from the review rows; the stored rating and
    // review-count columns on the content tables are never recalculated.
    const reviewRows = await sql<Row>`
      SELECT r.id, r.rating, left(r.review_text, 280) AS text, r.reviewer_name, r.created_at,
             (CASE WHEN r.mock_test_id IS NOT NULL THEN 'mock_test'
                   WHEN r.course_id IS NOT NULL THEN 'course'
                   ELSE 'digital_product' END)::text AS kind,
             coalesce(mt.title, c.title, dp.title)::text AS title
      FROM reviews r
      LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
      LEFT JOIN courses c ON c.id = r.course_id
      LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
      WHERE r.created_at >= ${window.previousStart}
        AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
      ORDER BY r.created_at DESC
    `.execute(db);

    const sides = { current: { sum: 0, count: 0 }, previous: { sum: 0, count: 0 } };
    const distribution = [0, 0, 0, 0, 0];
    const months = new Map<string, { sum: number; count: number }>();
    const latest: AnalyticsLatestReview[] = [];

    for (const row of reviewRows.rows) {
      const createdAt = date(get(row, "created_at"));
      const day = isoDay(createdAt.getTime());
      const rating = num(get(row, "rating"));
      if (day < window.currentStartDay) {
        sides.previous.sum += rating;
        sides.previous.count += 1;
        continue;
      }
      sides.current.sum += rating;
      sides.current.count += 1;
      const star = Math.min(5, Math.max(1, Math.round(rating)));
      distribution[star - 1] += 1;
      const month = day.slice(0, 7);
      const bucket = months.get(month) ?? { sum: 0, count: 0 };
      bucket.sum += rating;
      bucket.count += 1;
      months.set(month, bucket);
      if (latest.length < LATEST) {
        const text = get(row, "text");
        latest.push({
          id: num(get(row, "id")),
          rating,
          text: text ? str(text).trim() || null : null,
          reviewerName: str(get(row, "reviewer_name"), "Student").trim() || "Student",
          createdAt,
          kind: str(get(row, "kind")) as AnalyticsReviewKind,
          title: str(get(row, "title"), "Untitled").trim() || "Untitled",
        });
      }
    }

    const average = (side: { sum: number; count: number }) => (side.count === 0 ? 0 : side.sum / side.count);
    const trend: AnalyticsRatingMonth[] = [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, bucket]) => ({ month, average: bucket.sum / bucket.count, count: bucket.count }));

    const output: OutputType = {
      range,
      generatedAt: new Date(),
      average: { current: average(sides.current), previous: average(sides.previous) },
      count: { current: sides.current.count, previous: sides.previous.count },
      distribution,
      trend,
      latest,
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("reviews", error);
  }
}