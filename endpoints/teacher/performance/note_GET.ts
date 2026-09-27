import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherNoteReadsSql,
  noteReadingStatus,
  notePercent,
  toDateOrNull,
  round2,
  avatarOrNull,
} from "../../../helpers/teacherPerformance";
import { schema, OutputType, NoteOption, NoteReaderRow } from "./note_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({ productId: url.searchParams.get("productId") ?? undefined });

    // Notes nobody has bought are left out of the picker unless asked for by id.
    const optionRows = await sql<Row>`
      SELECT dp.id, dp.title, dp.status::text AS status,
             (SELECT count(*) FROM digital_product_purchases dpp WHERE dpp.product_id = dp.id) AS buyers,
             coalesce(
               nullif((SELECT sum(coalesce(f.page_count, 0)) FROM digital_product_files f WHERE f.product_id = dp.id), 0),
               dp.page_count, 0
             ) AS pages
      FROM digital_products dp
      WHERE dp.teacher_id = ${teacherId}
        AND (dp.id = ${input.productId ?? 0}
             OR EXISTS (SELECT 1 FROM digital_product_purchases dpp WHERE dpp.product_id = dp.id))
      ORDER BY buyers DESC, dp.id DESC
    `.execute(db);

    const notes: NoteOption[] = optionRows.rows.map((row) => ({
      id: num(get(row, "id")),
      title: str(get(row, "title"), "Untitled").trim() || "Untitled",
      status: str(get(row, "status"), "draft"),
      buyers: num(get(row, "buyers")),
      pages: num(get(row, "pages")),
    }));

    const selected = input.productId ? notes.find((note) => note.id === input.productId) : notes[0];
    if (input.productId && !selected) return performanceJson({ error: "Those study notes are not yours." }, 404);
    if (!selected) {
      const empty: OutputType = { notes, note: null };
      return performanceJson(empty);
    }

    const result = await sql<Row>`
      WITH reads AS (${teacherNoteReadsSql(teacherId, sql`dp.id = ${selected.id}`)})
      SELECT r.*, coalesce(nullif(trim(u.display_name), ''), 'Student') AS name, u.avatar_url
      FROM reads r JOIN users u ON u.id = r.student_id
    `.execute(db);

    const rows: NoteReaderRow[] = result.rows
      .map((row) => {
        const pagesTotal = num(get(row, "pages_total"));
        const pagesRead = pagesTotal > 0 ? Math.min(num(get(row, "pages_read")), pagesTotal) : num(get(row, "pages_read"));
        return {
          studentId: num(get(row, "student_id")),
          name: str(get(row, "name"), "Student"),
          avatarUrl: avatarOrNull(get(row, "avatar_url")),
          boughtAt: toDateOrNull(get(row, "purchased_at")),
          pagesRead,
          pagesTotal,
          progress: notePercent(pagesRead, pagesTotal),
          status: noteReadingStatus(pagesRead, pagesTotal),
          lastOpenedAt: toDateOrNull(get(row, "last_read_at")),
        };
      })
      .sort(
        (a, b) =>
          b.pagesRead - a.pagesRead ||
          (b.lastOpenedAt?.getTime() ?? 0) - (a.lastOpenedAt?.getTime() ?? 0) ||
          (b.boughtAt?.getTime() ?? 0) - (a.boughtAt?.getTime() ?? 0)
      );

    const readers = rows.filter((r) => r.pagesRead > 0);
    const output: OutputType = {
      notes,
      note: {
        id: selected.id,
        title: selected.title,
        pages: selected.pages,
        totals: {
          buyers: rows.length,
          opened: rows.filter((r) => r.status !== "not_opened").length,
          finished: rows.filter((r) => r.status === "finished").length,
          averageProgress:
            readers.length === 0 ? null : round2(readers.reduce((sum, r) => sum + r.progress, 0) / readers.length),
        },
        rows,
      },
    };
    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("note", error);
  }
}