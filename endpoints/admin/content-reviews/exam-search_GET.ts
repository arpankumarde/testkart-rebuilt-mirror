import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, type OutputType } from "./exam-search_GET.schema";

const LIMIT = 20;

/* Exam lookup for starting an Exam Bonus. Lives here so content reviewers need no access to the news section. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const parsed = schema.safeParse({ search: new URL(request.url).searchParams.get("search") ?? "" });
    if (!parsed.success) return new Response(superjson.stringify({ exams: [] } satisfies OutputType));

    const escaped = parsed.data.search.replace(/[%_\\]/g, (c) => `\\${c}`);
    const term = `%${escaped}%`;
    const exams = await db
      .selectFrom("exams as e")
      .leftJoin("examCategories as c", "c.id", "e.categoryId")
      .select(["e.id", "e.examName", "e.fullName", "c.categoryName as categoryName"])
      .where((eb) => eb.or([eb("e.examName", "ilike", term), eb("e.fullName", "ilike", term)]))
      .orderBy((eb) => eb.case().when("e.examName", "ilike", `${escaped}%`).then(0).else(1).end())
      .orderBy("e.examName")
      .limit(LIMIT)
      .execute();
    return new Response(superjson.stringify({ exams } satisfies OutputType));
  } catch (error) {
    console.error("Error searching exams for the Exam Bonus:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}