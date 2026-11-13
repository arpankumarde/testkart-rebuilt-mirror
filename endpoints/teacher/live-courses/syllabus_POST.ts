import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import { LiveCourseError, errorResponse, getManagedCourse } from "../../../helpers/liveCourseServer";
import { loadCourseModules } from "../../../helpers/liveCourseData";
import { schema, type OutputType } from "./syllabus_POST.schema";

/** Replaces the whole syllabus. Rows sent with an id are kept, so classes stay linked to their topic. */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const course = await getManagedCourse(input.liveCourseId, user, effectiveTeacherId);
    if (course.status === "cancelled" || course.status === "completed") {
      throw new LiveCourseError(`A ${course.status} live course cannot be edited.`);
    }

    await db.transaction().execute(async (trx) => {
      const existingModules = await trx
        .selectFrom("liveCourseModules")
        .select("id")
        .where("liveCourseId", "=", course.id)
        .execute();
      const moduleIds = new Set(existingModules.map((m) => m.id));
      const existingTopics = moduleIds.size
        ? await trx.selectFrom("liveCourseTopics").select(["id", "moduleId"]).where("moduleId", "in", [...moduleIds]).execute()
        : [];
      const topicIds = new Set(existingTopics.map((t) => t.id));

      for (const m of input.modules) {
        if (m.id && !moduleIds.has(m.id)) throw new LiveCourseError("A module does not belong to this course.");
        for (const t of m.topics) if (t.id && !topicIds.has(t.id)) throw new LiveCourseError("A topic does not belong to this course.");
      }

      const keptModules = new Set(input.modules.flatMap((m) => (m.id ? [m.id] : [])));
      const keptTopics = new Set(input.modules.flatMap((m) => m.topics.flatMap((t) => (t.id ? [t.id] : []))));
      const dropModules = [...moduleIds].filter((id) => !keptModules.has(id));
      const dropTopics = [...topicIds].filter((id) => !keptTopics.has(id));
      if (dropTopics.length) await trx.deleteFrom("liveCourseTopics").where("id", "in", dropTopics).execute();
      if (dropModules.length) await trx.deleteFrom("liveCourseModules").where("id", "in", dropModules).execute();

      for (const [mi, m] of input.modules.entries()) {
        let moduleId = m.id;
        if (moduleId) {
          await trx.updateTable("liveCourseModules").set({ title: m.title, position: mi }).where("id", "=", moduleId).execute();
        } else {
          moduleId = (
            await trx
              .insertInto("liveCourseModules")
              .values({ liveCourseId: course.id, title: m.title, position: mi })
              .returning("id")
              .executeTakeFirstOrThrow()
          ).id;
        }
        for (const [ti, t] of m.topics.entries()) {
          if (t.id) {
            await trx.updateTable("liveCourseTopics").set({ title: t.title, position: ti, moduleId }).where("id", "=", t.id).execute();
          } else {
            await trx.insertInto("liveCourseTopics").values({ moduleId, title: t.title, position: ti }).execute();
          }
        }
      }
      await trx.updateTable("liveCourses").set({ updatedAt: new Date() }).where("id", "=", course.id).execute();
    });

    const output: OutputType = { modules: await loadCourseModules(course.id) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live course syllabus:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
