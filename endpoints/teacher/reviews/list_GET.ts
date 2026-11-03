import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import {
  schema,
  OutputType,
  ReviewKind,
  TeacherReview,
  TeacherReviewedItem,
} from "./list_GET.schema";

const PAGE_SIZE = 10;

const asDate = (value: unknown): Date | null => (value ? new Date(value as string | Date) : null);
const asKind = (value: unknown): ReviewKind => {
  const kind = str(value);
  return kind === "course" || kind === "digital_product" ? kind : "mock_test";
};

/**
 * Every review on the teacher's test series, courses and notes (bundles have
 * no reviews), newest first by default, ten to a page, with stats over the
 * whole scope instead of only the rows on screen.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const teacherId = effectiveTeacherId;

    const base = sql`
      FROM reviews r
      LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
      LEFT JOIN courses c ON c.id = r.course_id
      LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
      WHERE coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) = ${teacherId}
    `;
    const kindExpr = sql`CASE WHEN r.mock_test_id IS NOT NULL THEN 'mock_test' WHEN r.course_id IS NOT NULL THEN 'course' ELSE 'digital_product' END`;
    const itemIdExpr = sql`coalesce(r.mock_test_id, r.course_id, r.digital_product_id)`;

    const scope = sql.join(
      [
        input.kind ? sql`${kindExpr} = ${input.kind}` : sql`TRUE`,
        input.itemId ? sql`${itemIdExpr} = ${input.itemId}` : sql`TRUE`,
      ],
      sql` AND `
    );
    const filters = sql.join(
      [
        scope,
        input.rating ? sql`round(r.rating) = ${input.rating}` : sql`TRUE`,
        input.replied === "replied"
          ? sql`r.teacher_reply IS NOT NULL`
          : input.replied === "unreplied"
            ? sql`r.teacher_reply IS NULL`
            : sql`TRUE`,
      ],
      sql` AND `
    );
    const order =
      input.sort === "oldest"
        ? sql`r.created_at ASC NULLS FIRST, r.id ASC`
        : input.sort === "highest"
          ? sql`r.rating DESC, r.created_at DESC NULLS LAST, r.id DESC`
          : input.sort === "lowest"
            ? sql`r.rating ASC, r.created_at DESC NULLS LAST, r.id DESC`
            : sql`r.created_at DESC NULLS LAST, r.id DESC`;

    const [pageRows, countRows, summaryRows, itemRows] = await Promise.all([
      sql<Row>`
        SELECT r.id, r.rating, r.review_text, r.reviewer_name, r.created_at, r.teacher_reply, r.teacher_replied_at,
               ${kindExpr} AS kind, ${itemIdExpr} AS item_id,
               coalesce(mt.title, c.title, dp.title) AS item_title,
               (SELECT ti.title FROM mock_test_items ti WHERE ti.id = r.test_item_id) AS test_item_title,
               (SELECT u.avatar_url FROM users u WHERE u.id = r.user_id) AS avatar_url
        ${base}
          AND ${filters}
        ORDER BY ${order}
        LIMIT ${PAGE_SIZE} OFFSET ${(input.page - 1) * PAGE_SIZE}
      `.execute(db),
      sql<Row>`SELECT count(*) AS total ${base} AND ${filters}`.execute(db),
      sql<Row>`
        SELECT count(*) AS count, coalesce(avg(r.rating), 0) AS average,
               count(*) FILTER (WHERE round(r.rating) = 1) AS s1,
               count(*) FILTER (WHERE round(r.rating) = 2) AS s2,
               count(*) FILTER (WHERE round(r.rating) = 3) AS s3,
               count(*) FILTER (WHERE round(r.rating) = 4) AS s4,
               count(*) FILTER (WHERE round(r.rating) >= 5) AS s5,
               count(*) FILTER (WHERE nullif(trim(r.review_text), '') IS NOT NULL) AS written,
               count(*) FILTER (WHERE r.teacher_reply IS NULL AND nullif(trim(r.review_text), '') IS NOT NULL) AS unreplied,
               max(r.created_at) AS latest_at
        ${base}
          AND ${scope}
      `.execute(db),
      sql<Row>`
        SELECT ${kindExpr} AS kind, ${itemIdExpr} AS item_id, coalesce(mt.title, c.title, dp.title) AS item_title, count(*) AS count
        ${base}
        GROUP BY 1, 2, 3
        ORDER BY count(*) DESC, 3
      `.execute(db),
    ]);

    const reviews: TeacherReview[] = pageRows.rows.map((row) => ({
      id: num(get(row, "id")),
      rating: num(get(row, "rating")),
      reviewText: get(row, "review_text") ? str(get(row, "review_text")) : null,
      reviewerName: str(get(row, "reviewer_name"), "Student").trim() || "Student",
      reviewerAvatarUrl: get(row, "avatar_url") ? str(get(row, "avatar_url")) : null,
      createdAt: asDate(get(row, "created_at")),
      kind: asKind(get(row, "kind")),
      itemId: num(get(row, "item_id")),
      itemTitle: str(get(row, "item_title"), "Untitled"),
      testItemTitle: get(row, "test_item_title") ? str(get(row, "test_item_title")) : null,
      teacherReply: get(row, "teacher_reply") ? str(get(row, "teacher_reply")) : null,
      teacherRepliedAt: asDate(get(row, "teacher_replied_at")),
    }));

    const s = summaryRows.rows[0] ?? {};
    const items: TeacherReviewedItem[] = itemRows.rows.map((row) => ({
      kind: asKind(get(row, "kind")),
      id: num(get(row, "item_id")),
      title: str(get(row, "item_title"), "Untitled"),
      count: num(get(row, "count")),
    }));

    const output: OutputType = {
      reviews,
      total: num(get(countRows.rows[0] ?? {}, "total")),
      page: input.page,
      pageSize: PAGE_SIZE,
      summary: {
        count: num(get(s, "count")),
        average: Math.round(num(get(s, "average")) * 10) / 10,
        distribution: {
          1: num(get(s, "s1")),
          2: num(get(s, "s2")),
          3: num(get(s, "s3")),
          4: num(get(s, "s4")),
          5: num(get(s, "s5")),
        },
        written: num(get(s, "written")),
        unreplied: num(get(s, "unreplied")),
        latestAt: asDate(get(s, "latest_at")),
      },
      items,
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error listing teacher reviews:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Your reviews could not be loaded.";
    return new Response(superjson.stringify({ error: message }), { status: 500 });
  }
}