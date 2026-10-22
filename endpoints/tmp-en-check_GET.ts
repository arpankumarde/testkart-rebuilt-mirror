import { db } from "../helpers/db";
import { examNewsServer } from "../helpers/examNewsServer";
import { validateExamNews } from "../helpers/examNewsValidation";
import type { InputType } from "./admin/exam-news/save_POST.schema";

const row = (key: string, eventName: string, startDate = "", endDate = "", examDate = "", resultDate = "", note = "") => ({
  key,
  eventName,
  startDate,
  endDate,
  examDate,
  resultDate,
  note,
});

export async function handle(request: Request) {
  if (new URL(request.url).searchParams.get("token") !== "c41e07ab92") return new Response("{}", { status: 404 });
  const out: Record<string, unknown> = {};
  let id = 0;
  const raw = async () =>
    db
      .selectFrom("examNewsKeyDates")
      .select(["eventName", "startLabel", "endLabel", "examLabel", "resultLabel", "note"])
      .select((eb) => eb.ref("startDate").as("rawStart"))
      .where("postId", "=", id)
      .orderBy("position")
      .execute();
  const loaded = async () => (await examNewsServer.loadDetail(id))!.keyDates.map(({ key: _k, ...rest }) => rest);
  const edited = async () =>
    (await db.selectFrom("examNewsPosts").select("lastEditedAt").where("id", "=", id).executeTakeFirstOrThrow()).lastEditedAt;
  try {
    const owner = await db.selectFrom("examNewsPosts").select("createdBy").where("id", "=", 14).executeTakeFirstOrThrow();
    const adminId = owner.createdBy as number;
    const input: InputType = {
      title: "ZZ key date check",
      slug: "zz-key-date-check-tmp",
      summary: "",
      newsType: "notification",
      examId: null,
      authorId: null,
      status: "draft",
      publishAt: "",
      body: "",
      heroImageUrl: "",
      heroImageFileId: "",
      heroImageAlt: "",
      heroImageCredit: "",
      keyDates: [
        row("a", "Application window", "23 October 2026", "To be announced", "Expected in December 2026", "  Awaited  "),
        row("b", "Result", "", "", "", "Not yet declared", "Keep watching"),
        row("c", "Odd", "Coming Soon", "12/11/26", "Oct 2026", "31 February 2026"),
        row("d", "", "", "", "", "", ""),
      ],
      officialSourceName: "",
      officialSourceUrl: "",
      sources: [],
      corrections: [],
      seoTitle: "",
      seoDescription: "",
      ogTitle: "",
      ogDescription: "",
      ogImageUrl: "",
      ogImageFileId: "",
      canonicalUrl: "",
    };
    out.validationIssues = validateExamNews(input).filter((i) => i.path.startsWith("keyDates"));
    out.noDateRowIssue = validateExamNews({ ...input, keyDates: [row("x", "Only event")] }).filter((i) => i.path.startsWith("keyDates"));
    out.endBeforeStartAllowed = validateExamNews({ ...input, keyDates: [row("x", "E", "2026-12-01", "2026-01-01")] }).filter((i) => i.path.startsWith("keyDates"));

    id = await examNewsServer.save(input, adminId);
    out.stored = await raw();
    out.loadedForEditor = await loaded();

    // A row written by the live code, which only knows the old date columns.
    await db
      .insertInto("examNewsKeyDates")
      .values({ postId: id, position: 9, eventName: "Old code row", startDate: "2026-11-01", resultDate: "2027-01-15" })
      .execute();
    out.oldCodeRowLoaded = (await loaded()).find((r) => r.eventName === "Old code row");

    await db.updateTable("examNewsPosts").set({ firstPublishedAt: new Date() }).where("id", "=", id).execute();
    const again = examNewsServer.detailToInput((await examNewsServer.loadDetail(id))!, "draft");
    await examNewsServer.save(again, adminId);
    out.lastEditedAfterNoChange = await edited();
    again.keyDates[0].examDate = "Postponed";
    await examNewsServer.save(again, adminId);
    out.lastEditedAfterTextChange = !!(await edited());
    out.afterEdit = (await loaded())[0];
  } catch (error) {
    out.error = String(error);
  } finally {
    if (id) await db.deleteFrom("examNewsPosts").where("id", "=", id).execute();
    out.leftoverPosts = (await db.selectFrom("examNewsPosts").select("id").where("slug", "like", "zz-key-date-check%").execute()).length;
  }
  return new Response(JSON.stringify(out, null, 1));
}
