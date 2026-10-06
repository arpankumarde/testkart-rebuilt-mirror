import { sql, RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { containsPattern, orderNullsLast, pageWindow } from "../../../helpers/adminCatalogueListQuery";
import { schema, OutputType, CourseSortColumn } from "./page_GET.schema";
import superjson from "superjson";

const studentsEnrolled = sql<string>`(SELECT count(*) FROM course_enrollments ce WHERE ce.course_id = courses.id)`;
const lessonsCount = sql<string>`(SELECT count(*) FROM course_lessons l
  JOIN course_sections s ON s.id = l.section_id
  WHERE s.course_id = courses.id)`;

const SORT_EXPRESSIONS: Record<CourseSortColumn, RawBuilder<unknown>> = {
  title: sql`lower(${sql.ref("courses.title")})`,
  status: sql`${sql.ref("courses.status")}`,
  students: studentsEnrolled,
  price: sql`${sql.ref("courses.price")}`,
  createdAt: sql`${sql.ref("courses.createdAt")}`,
};

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));

    let filtered = db.selectFrom("courses").innerJoin("users", "users.id", "courses.teacherId");
    if (input.status) filtered = filtered.where("courses.status", "=", input.status);
    if (input.filter === "no-lessons") filtered = filtered.where(sql<boolean>`${lessonsCount} = 0`);
    if (input.id) filtered = filtered.where("courses.id", "=", input.id);
    if (input.search) {
      const pattern = containsPattern(input.search);
      filtered = filtered.where((eb) =>
        eb.or([eb("courses.title", "ilike", pattern), eb("users.displayName", "ilike", pattern)])
      );
    }

    const totalRow = await filtered
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .executeTakeFirst();
    const total = Number(totalRow?.total ?? 0);
    const paging = pageWindow(input.page, total);
    const sortOrder = input.sortBy ? input.sortOrder ?? "asc" : "desc";

    const rows = await filtered
      .select([
        "courses.id",
        "courses.title",
        "courses.slug",
        "courses.status",
        "courses.createdAt",
        "courses.price",
        "users.displayName as teacherName",
      ])
      .select([studentsEnrolled.as("studentsEnrolled"), lessonsCount.as("lessonsCount")])
      .orderBy(orderNullsLast(SORT_EXPRESSIONS[input.sortBy ?? "createdAt"], sortOrder))
      .orderBy("courses.id", "desc")
      .limit(paging.limit)
      .offset(paging.offset)
      .execute();

    const statusRows = await db
      .selectFrom("courses")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select(["courses.status"])
      .select((eb) => eb.fn.countAll<string>().as("cnt"))
      .groupBy("courses.status")
      .execute();
    const countFor = (status: string) =>
      Number(statusRows.find((row) => row.status === status)?.cnt ?? 0);

    const output: OutputType = {
      items: rows.map((row) => ({
        ...row,
        price: Number(row.price),
        studentsEnrolled: Number(row.studentsEnrolled ?? 0),
        lessonsCount: Number(row.lessonsCount ?? 0),
      })),
      total,
      page: paging.page,
      totalPages: paging.totalPages,
      statusCounts: {
        all: statusRows.reduce((sum, row) => sum + Number(row.cnt), 0),
        published: countFor("published"),
        draft: countFor("draft"),
        archived: countFor("archived"),
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin courses page:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}