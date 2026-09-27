import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import { getRankedLiveTestAttempts } from "../../../helpers/liveTestRanking";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherPapersSql,
  scoredAttemptSql,
  minutesTakenSql,
  toNumberOrNull,
  toDateOrNull,
  round2,
  avatarOrNull,
} from "../../../helpers/teacherPerformance";
import {
  schema,
  OutputType,
  LeaderboardSeriesOption,
  LeaderboardLiveOption,
  LeaderboardBoard,
  AttemptRow,
  SeriesRow,
} from "./leaderboard_GET.schema";

const NAME_SQL = sql`coalesce(nullif(trim(u.display_name), ''), 'Student')`;

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({
      seriesId: url.searchParams.get("seriesId") ?? undefined,
      itemId: url.searchParams.get("itemId") ?? undefined,
      liveTestId: url.searchParams.get("liveTestId") ?? undefined,
    });

    // Removed papers stay out of leaderboards; a student's own history still shows them.
    const optionRows = await sql<Row>`
      WITH papers AS (${teacherPapersSql(
        teacherId,
        sql`mti.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM live_tests l WHERE l.mock_test_id = mt.id)`
      )}),
      fin AS (
        SELECT ta.test_id, ta.student_id, ta.completed_at
        FROM test_attempts ta JOIN papers p ON p.item_id = ta.test_id
        WHERE ${scoredAttemptSql("ta")}
      )
      SELECT 'paper'::text AS metric, p.series_id, p.series_title::text AS series_title, p.in_trash,
             p.item_id, p.paper_title::text AS paper_title, p.order_index,
             count(DISTINCT f.student_id) AS n, (max(f.completed_at) AT TIME ZONE 'UTC') AS last_at
      FROM papers p LEFT JOIN fin f ON f.test_id = p.item_id
      GROUP BY p.series_id, p.series_title, p.in_trash, p.item_id, p.paper_title, p.order_index
      UNION ALL
      SELECT 'series', p.series_id, NULL, NULL, NULL, NULL, NULL, count(DISTINCT f.student_id), NULL
      FROM fin f JOIN papers p ON p.item_id = f.test_id
      GROUP BY p.series_id
    `.execute(db);

    const seriesById = new Map<number, LeaderboardSeriesOption & { order: Map<number, number> }>();
    const participants = new Map<number, number>();
    for (const row of optionRows.rows) {
      const seriesId = num(get(row, "series_id"));
      if (get(row, "metric") === "series") {
        participants.set(seriesId, num(get(row, "n")));
        continue;
      }
      const entry =
        seriesById.get(seriesId) ??
        {
          id: seriesId,
          title: str(get(row, "series_title"), "Untitled").trim() || "Untitled",
          inTrash: get(row, "in_trash") === true,
          participants: 0,
          lastActivityAt: null,
          papers: [],
          order: new Map<number, number>(),
        };
      const itemId = num(get(row, "item_id"));
      entry.papers.push({
        id: itemId,
        title: str(get(row, "paper_title"), "Untitled paper").trim() || "Untitled paper",
        finished: num(get(row, "n")),
      });
      entry.order.set(itemId, num(get(row, "order_index")));
      const lastAt = toDateOrNull(get(row, "last_at"));
      if (lastAt && (!entry.lastActivityAt || lastAt > entry.lastActivityAt)) entry.lastActivityAt = lastAt;
      seriesById.set(seriesId, entry);
    }
    for (const entry of seriesById.values()) {
      entry.participants = participants.get(entry.id) ?? 0;
      entry.papers.sort((a, b) => (entry.order.get(a.id) ?? 0) - (entry.order.get(b.id) ?? 0) || a.id - b.id);
    }

    const series: LeaderboardSeriesOption[] = [...seriesById.values()]
      .filter((entry) => entry.participants > 0 || entry.id === input.seriesId)
      .sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
      .map(({ order, ...entry }) => entry);

    const liveRows = await db
      .selectFrom("liveTests")
      .select(["id", "title", "mockTestId", "startTime", "endTime", "enrolledCount"])
      .where("teacherId", "=", teacherId)
      .where((eb) => eb.or([eb("startTime", "is", null), eb("startTime", "<=", new Date())]))
      .orderBy("endTime", "desc")
      .execute();
    const liveTests: LeaderboardLiveOption[] = liveRows.map((row) => ({
      id: row.id,
      title: row.title,
      startTime: row.startTime ? new Date(row.startTime) : null,
      endTime: new Date(row.endTime),
      enrolled: row.enrolledCount ?? 0,
    }));

    let seriesId = input.seriesId;
    let liveTestId = input.liveTestId;
    if (!seriesId && !liveTestId) {
      if (series[0]) seriesId = series[0].id;
      else if (liveTests[0]) liveTestId = liveTests[0].id;
    }

    let board: LeaderboardBoard | null = null;

    if (liveTestId) {
      const live = liveRows.find((row) => row.id === liveTestId);
      if (!live) return performanceJson({ error: "That live test is not one of yours or has not started." }, 404);
      const now = Date.now();
      const status =
        live.startTime && now < new Date(live.startTime).getTime()
          ? "upcoming"
          : now <= new Date(live.endTime).getTime()
            ? "live"
            : "ended";
      const ranked = await getRankedLiveTestAttempts(db, {
        id: live.id,
        mockTestId: live.mockTestId,
        startTime: live.startTime,
        endTime: live.endTime,
      });
      const ids = ranked.map((entry) => entry.studentId);
      const photoRows =
        ids.length > 0 ? await db.selectFrom("users").select(["id", "avatarUrl"]).where("id", "in", ids).execute() : [];
      const photos = new Map(photoRows.map((u) => [u.id, avatarOrNull(u.avatarUrl)]));
      board = {
        kind: "live",
        liveTestId: live.id,
        title: live.title,
        status,
        rows: ranked
          .filter((entry) => Number.isFinite(entry.score))
          .map((entry, index) => ({
            rank: index + 1,
            studentId: entry.studentId,
            name: entry.studentName?.trim() || "Student",
            avatarUrl: photos.get(entry.studentId) ?? null,
            score: round2(entry.score) ?? 0,
            timeTakenMinutes: round2(entry.timeTakenMinutes),
            attempts: null,
            completedAt: entry.completedAt,
          })),
      };
    } else if (seriesId) {
      const selected = seriesById.get(seriesId);
      if (!selected) {
        // A series with no papers yet still opens, as an empty board.
        const owned = await db
          .selectFrom("mockTests")
          .select("title")
          .where("id", "=", seriesId)
          .where("teacherId", "=", teacherId)
          .executeTakeFirst();
        if (!owned) return performanceJson({ error: "That test series is not one of yours." }, 404);
        board = { kind: "series", seriesId, title: owned.title, paperCount: 0, rows: [] };
      } else if (input.itemId) {
        const paper = selected.papers.find((p) => p.id === input.itemId);
        if (!paper) return performanceJson({ error: "That paper is not in this test series." }, 404);
        const result = await sql<Row>`
          WITH done AS (
            SELECT ta.student_id, ta.score::float8 AS score,
                   ${minutesTakenSql("ta", "mti.duration_minutes")} AS minutes, ta.completed_at
            FROM test_attempts ta JOIN mock_test_items mti ON mti.id = ta.test_id
            WHERE ta.test_id = ${paper.id} AND ${scoredAttemptSql("ta")}
          ),
          best AS (
            SELECT DISTINCT ON (student_id) * FROM done
            ORDER BY student_id, score DESC, minutes ASC NULLS LAST, completed_at ASC
          ),
          counts AS (
            SELECT student_id, count(*) AS attempts FROM test_attempts WHERE test_id = ${paper.id} GROUP BY 1
          )
          SELECT b.student_id, ${NAME_SQL} AS name, u.avatar_url, b.score, b.minutes,
                 (b.completed_at AT TIME ZONE 'UTC') AS completed_at, c.attempts
          FROM best b
          JOIN users u ON u.id = b.student_id
          LEFT JOIN counts c ON c.student_id = b.student_id
          ORDER BY b.score DESC, b.minutes ASC NULLS LAST, b.completed_at ASC
        `.execute(db);
        const rows: AttemptRow[] = result.rows.map((row, index) => ({
          rank: index + 1,
          studentId: num(get(row, "student_id")),
          name: str(get(row, "name"), "Student"),
          avatarUrl: avatarOrNull(get(row, "avatar_url")),
          score: round2(toNumberOrNull(get(row, "score"))) ?? 0,
          timeTakenMinutes: round2(toNumberOrNull(get(row, "minutes"))),
          attempts: toNumberOrNull(get(row, "attempts")),
          completedAt: toDateOrNull(get(row, "completed_at")),
        }));
        board = { kind: "paper", seriesId, itemId: paper.id, title: paper.title, rows };
      } else {
        const result = await sql<Row>`
          WITH best AS (
            SELECT ta.student_id, ta.test_id, max(ta.score)::float8 AS score, max(ta.completed_at) AS last_at
            FROM test_attempts ta JOIN mock_test_items mti ON mti.id = ta.test_id
            WHERE mti.package_id = ${seriesId} AND mti.deleted_at IS NULL AND ${scoredAttemptSql("ta")}
            GROUP BY 1, 2
          )
          SELECT b.student_id, ${NAME_SQL} AS name, u.avatar_url, count(*) AS papers_done,
                 avg(b.score) AS average_score, sum(b.score) AS total_score, max(b.score) AS best_score,
                 (max(b.last_at) AT TIME ZONE 'UTC') AS last_at
          FROM best b JOIN users u ON u.id = b.student_id
          GROUP BY b.student_id, u.display_name, u.avatar_url
          ORDER BY average_score DESC, papers_done DESC
        `.execute(db);
        const rows: SeriesRow[] = result.rows.map((row) => ({
          studentId: num(get(row, "student_id")),
          name: str(get(row, "name"), "Student"),
          avatarUrl: avatarOrNull(get(row, "avatar_url")),
          papersDone: num(get(row, "papers_done")),
          averageScore: round2(toNumberOrNull(get(row, "average_score"))) ?? 0,
          totalScore: round2(toNumberOrNull(get(row, "total_score"))) ?? 0,
          bestScore: round2(toNumberOrNull(get(row, "best_score"))) ?? 0,
          lastAt: toDateOrNull(get(row, "last_at")),
        }));
        board = { kind: "series", seriesId, title: selected.title, paperCount: selected.papers.length, rows };
      }
    }

    const output: OutputType = { series, liveTests, board };
    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("leaderboard", error);
  }
}
