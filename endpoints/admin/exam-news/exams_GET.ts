import superjson from "superjson";
import { schema, OutputType } from "./exams_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { examNewsServer } from "../../../helpers/examNewsServer";

const LIMIT = 30;

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const input = schema.parse({ search: params.get("search") || undefined, id: id ? Number(id) : undefined });

    let query = db
      .selectFrom("exams as e")
      .leftJoin("examCategories as c", "c.id", "e.categoryId")
      .select(["e.id", "e.examName", "e.fullName", "e.examSlug", "c.categoryName as categoryName"]);

    if (input.id) {
      query = query.where("e.id", "=", input.id);
    } else if (input.search) {
      const term = `%${input.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const prefix = `${input.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      query = query
        .where((eb) => eb.or([eb("e.examName", "ilike", term), eb("e.fullName", "ilike", term), eb("e.examSlug", "ilike", term)]))
        .orderBy((eb) => eb.case().when("e.examName", "ilike", prefix).then(0).else(1).end());
    } else {
      // With nothing typed, offer the exams that already have stories, then the catalogue order.
      query = query.orderBy(
        (eb) =>
          eb
            .selectFrom("examNewsPosts as p")
            .select((inner) => inner.fn.countAll<number>().as("n"))
            .whereRef("p.examId", "=", "e.id"),
        "desc"
      );
    }

    const exams = await query.orderBy("e.orderIndex").orderBy("e.examName").limit(LIMIT).execute();
    return new Response(superjson.stringify({ exams } satisfies OutputType));
  } catch (error) {
    return examNewsServer.errorResponse(error, "Error searching exams");
  }
}