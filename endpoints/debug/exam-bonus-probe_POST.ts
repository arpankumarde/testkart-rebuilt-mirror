import { CamelCasePlugin, Kysely, sql } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import { db } from "../../helpers/db";
import { saveContentExams } from "../../helpers/contentExams";
import { getTeacherAvailableBalance } from "../../helpers/getTeacherAvailableBalance";
import {
  checkClaimable,
  createClaim,
  creditClaim,
  declineClaim,
  examBonusOptions,
  examSlotsTaken,
  getActiveCampaign,
  getRunningExamCampaigns,
  reverseClaim,
  slotsUsed,
  withdrawClaimsForReviews,
} from "../../helpers/teacherCampaign";
import { editExamCampaign, endExamCampaign, startExamCampaign } from "../../helpers/teacherExamCampaignAdmin";

/* Temporary test harness for the Exam Bonus. Everything rolls back. Deleted once the checks have run. */
const TOKEN = "d273a1d28a49520d17046ef9654e82d406261ab6ad5fdfd4";
const CAT = 49;
const CLAT = 55;
const SCHEMA = "zz_exam_bonus_probe";
const CLONED = ["teacher_campaigns", "teacher_campaign_claims", "content_reviews", "mock_tests", "mock_test_items", "test_questions", "mock_test_exams"];

class Rollback extends Error {}

export async function handle(request: Request): Promise<Response> {
  if (request.headers.get("x-probe") !== TOKEN) return new Response("{}", { status: 404 });
  const { part } = (await request.json()) as { part: "flow" | "race" };
  const lines: string[] = [];
  let pass = 0;
  let fail = 0;
  const ok = (name: string, cond: unknown, extra?: unknown) => {
    if (cond) {
      pass++;
      lines.push(`ok   ${name}`);
    } else {
      fail++;
      lines.push(`FAIL ${name} ${extra === undefined ? "" : JSON.stringify(extra)}`);
    }
  };
  const refused = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  try {
    if (part === "flow") await flow(ok, refused);
    else await race(ok);
  } catch (error) {
    if (!(error instanceof Rollback)) {
      fail++;
      lines.push(`CRASH ${error instanceof Error ? error.stack : String(error)}`);
    }
  }
  return new Response(JSON.stringify({ lines, pass, fail }), { headers: { "Content-Type": "application/json" } });
}

async function flow(ok: (name: string, cond: unknown, extra?: unknown) => void, refused: (fn: () => Promise<unknown>) => Promise<string>) {
  const countAll = () =>
    sql<{ c: string; l: string; m: string; r: string }>`SELECT (SELECT COUNT(*) FROM teacher_campaigns) c,
      (SELECT COUNT(*) FROM teacher_campaign_claims) l, (SELECT COUNT(*) FROM mock_tests) m, (SELECT COUNT(*) FROM content_reviews) r`.execute(db);
  const before = JSON.stringify((await countAll()).rows);
  try {
    await db.transaction().execute(async (trx) => {
      const t = trx as never;
      const fresh = (
        await sql<{ id: number }>`SELECT u.id FROM users u WHERE u.role = 'teacher' AND NOT EXISTS (
          SELECT 1 FROM teacher_campaign_claims c WHERE c.teacher_id = u.id) ORDER BY u.id DESC LIMIT 8`.execute(trx)
      ).rows.map((r) => r.id);
      const FULL = (
        await sql<{ teacherId: number }>`SELECT teacher_id FROM teacher_campaign_claims WHERE campaign_id = 1 AND content_type = 'mock_test'
          AND status IN ('claimed','credited') GROUP BY 1 HAVING COUNT(*) >= 5 LIMIT 1`.execute(trx)
      ).rows[0].teacherId;
      const admin = (await sql<{ id: number }>`SELECT id FROM admins ORDER BY id LIMIT 1`.execute(trx)).rows[0].id;
      const [A, B, C, D, E] = fresh;
      let seq = 0;

      const series = async (teacher: number, exams: number[], o: { tests?: number; visibility?: string } = {}) => {
        const tests = o.tests ?? 10;
        seq += 1;
        const id = (
          await sql<{ id: number }>`INSERT INTO mock_tests (title, slug, teacher_id)
            VALUES (${"Exam Bonus probe " + seq}, ${"exam-bonus-probe-" + Date.now() + "-" + seq}, ${teacher}) RETURNING id`.execute(trx)
        ).rows[0].id;
        await sql`INSERT INTO mock_test_items (title, package_id) SELECT 'p' || g, ${id} FROM generate_series(1, ${tests}::int) g`.execute(trx);
        await sql`INSERT INTO test_questions (question_text, test_id) SELECT 'q', i.id FROM mock_test_items i, generate_series(1, 50) g WHERE i.package_id = ${id}`.execute(trx);
        if (o.visibility) await sql`UPDATE mock_tests SET visibility = ${o.visibility}::content_visibility WHERE id = ${id}`.execute(trx);
        const names = (await sql<{ id: number; examName: string }>`SELECT id, exam_name FROM exams WHERE id IN (${sql.join(exams)})`.execute(trx)).rows;
        await saveContentExams(trx, "mock_test", id, names.map((n) => ({ examId: n.id, examName: n.examName })));
        return id;
      };
      const submit = async (teacher: number, id: number, examCampaignId?: number) => {
        const reviewId = (
          await sql<{ id: number }>`INSERT INTO content_reviews (content_type, content_id, teacher_id, status)
            VALUES ('mock_test', ${id}, ${teacher}, 'pending') RETURNING id`.execute(trx)
        ).rows[0].id;
        await sql`SAVEPOINT claim`.execute(trx);
        try {
          const claim = await createClaim(trx, { teacherId: teacher, type: "mock_test", contentId: id, reviewId, examCampaignId });
          await sql`RELEASE SAVEPOINT claim`.execute(trx);
          return { ok: true as const, reviewId, claim, error: "" };
        } catch (error) {
          await sql`ROLLBACK TO SAVEPOINT claim`.execute(trx);
          await sql`DELETE FROM content_reviews WHERE id = ${reviewId}`.execute(trx);
          return { ok: false as const, reviewId, claim: null, error: error instanceof Error ? error.message : String(error) };
        }
      };
      const claimOf = async (id: number) =>
        (await sql<any>`SELECT * FROM teacher_campaign_claims WHERE content_type = 'mock_test' AND content_id = ${id} ORDER BY id DESC LIMIT 1`.execute(trx)).rows[0];
      const approve = async (id: number, reviewId: number) => {
        await sql`UPDATE content_reviews SET status = 'approved' WHERE id = ${reviewId}`.execute(trx);
        await sql`UPDATE mock_tests SET is_published = TRUE, was_ever_published = TRUE WHERE id = ${id}`.execute(trx);
      };
      const taken = async (id: number) => (await examSlotsTaken(trx, [id])).get(id) ?? 0;
      const defaults = { totalSlots: 10, amount: 100, perTeacher: 3, days: 7, minTests: 10, minQuestions: 500 };

      const exam = await startExamCampaign(trx, { examId: CAT, examNewsPostId: 8, ...defaults });
      ok("start: title, slots, limit, amount", exam.title === "CAT Exam Bonus" && exam.totalSlots === 10 && exam.maxMockTests === 3 && Number(exam.mockTestAmount) === 100, exam);
      ok("second campaign for the exam refused", /already running/.test(await refused(() => startExamCampaign(trx, { examId: CAT, ...defaults }))));
      const creator = await getActiveCampaign(trx);
      ok("getActiveCampaign still returns the Creator Bonus", creator?.id === 1 && creator?.kind === "creator", creator);
      ok("one exam campaign running", (await getRunningExamCampaigns(trx)).length === 1);

      const s1 = await series(A, [CAT]);
      const opts = await examBonusOptions(trx, A, s1);
      ok("option: claimable, 10 left", opts.length === 1 && opts[0].canClaim && opts[0].slotsLeft === 10, opts);
      ok("Creator Bonus still claimable", (await checkClaimable(trx, creator!, A, "mock_test", s1)).ok);
      const s2 = await series(A, [CAT]);
      const cp = await submit(A, s2);
      ok("Creator claim lands on campaign 1", cp.ok && (await claimOf(s2)).campaignId === 1, cp);
      ok("exam slots untouched by a Creator claim", (await taken(exam.id)) === 0);
      const chk = await checkClaimable(trx, exam, A, "mock_test", s2);
      ok("series with a Creator claim cannot claim Exam Bonus", !chk.ok && /already claimed/.test((chk as { reason: string }).reason), chk);

      const p1 = await submit(A, s1, exam.id);
      ok("exam claim works", p1.ok && (await claimOf(s1)).campaignId === exam.id && Number((await claimOf(s1)).amount) === 100, p1);
      ok("creator slots of A unchanged by exam claim", (await slotsUsed(trx, 1, A, "mock_test")) === 1);
      const s3 = await series(B, [CAT]);
      ok("other teachers see 9 left", (await examBonusOptions(trx, B, s3))[0].slotsLeft === 9);

      const s4 = await series(FULL, [CAT]);
      const fullCheck = await checkClaimable(trx, creator!, FULL, "mock_test", s4);
      ok("Creator Bonus says all 5 used", !fullCheck.ok && /used all 5/.test((fullCheck as { reason: string }).reason), fullCheck);
      ok("Exam Bonus open for that teacher", (await examBonusOptions(trx, FULL, s4))[0].canClaim);
      const usedBefore = await slotsUsed(trx, 1, FULL, "mock_test");
      const p4 = await submit(FULL, s4, exam.id);
      ok("5-slot teacher claims it", p4.ok, p4);
      ok("their Creator slots unchanged", (await slotsUsed(trx, 1, FULL, "mock_test")) === usedBefore);

      const s5 = await series(B, [CLAT]);
      ok("untagged series has no option", (await examBonusOptions(trx, B, s5)).length === 0);
      ok("untagged series refused", /Tag this test series/.test((await submit(B, s5, exam.id)).error));
      const s6 = await series(B, [CAT]);
      await sql`UPDATE mock_tests SET was_ever_published = TRUE WHERE id = ${s6}`.execute(trx);
      ok("series that was public refused", /been public/.test((await submit(B, s6, exam.id)).error));
      const s7 = await series(B, [CAT]);
      await sql`INSERT INTO content_reviews (content_type, content_id, teacher_id, status) VALUES ('mock_test', ${s7}, ${B}, 'approved')`.execute(trx);
      ok("series with an approved review refused", /been public/.test((await submit(B, s7, exam.id)).error));
      const s8 = await series(B, [CAT], { tests: 9 });
      ok("short series refused", /Add 1 more test/.test((await submit(B, s8, exam.id)).error));
      const courseId = (await sql<{ id: number }>`SELECT id FROM courses LIMIT 1`.execute(trx)).rows[0].id;
      ok("course refused", !(await checkClaimable(trx, exam, A, "course", courseId)).ok);
      ok("unknown campaign refused", /has ended/.test((await submit(B, s3, 999999)).error));
      ok("Creator campaign refused as an exam id", /has ended/.test((await submit(B, s3, 1)).error));

      ok("A claims a second", (await submit(A, await series(A, [CAT]), exam.id)).ok);
      ok("A claims a third", (await submit(A, await series(A, [CAT]), exam.id)).ok);
      ok("A's fourth refused", /used all 3/.test((await submit(A, await series(A, [CAT]), exam.id)).error));
      const later = new Date(Date.now() + 86400000);
      ok("edit below taken refused", /already taken/.test(await refused(() => editExamCampaign(trx, { id: exam.id, totalSlots: 2, amount: 100, perTeacher: 3, endsAt: later }))));
      ok("edit below busiest teacher refused", /holds 3/.test(await refused(() => editExamCampaign(trx, { id: exam.id, totalSlots: 10, amount: 100, perTeacher: 2, endsAt: later }))));
      ok("past end date refused", /future/.test(await refused(() => editExamCampaign(trx, { id: exam.id, totalSlots: 10, amount: 100, perTeacher: 3, endsAt: new Date(Date.now() - 1000) }))));
      ok("B takes 3", (await submit(B, s3, exam.id)).ok && (await submit(B, await series(B, [CAT]), exam.id)).ok && (await submit(B, await series(B, [CAT]), exam.id)).ok);
      ok("C takes 2", (await submit(C, await series(C, [CAT]), exam.id)).ok && (await submit(C, await series(C, [CAT]), exam.id)).ok);
      ok("campaign full at 10", (await taken(exam.id)) === 10, await taken(exam.id));
      const d1 = await series(D, [CAT]);
      ok("11th refused", /All 10 slots/.test((await submit(D, d1, exam.id)).error));
      const fullOpt = (await examBonusOptions(trx, D, d1))[0];
      ok("option shows 0 left and why", fullOpt.slotsLeft === 0 && !fullOpt.canClaim && /All 10/.test(fullOpt.reason ?? ""), fullOpt);

      await withdrawClaimsForReviews(trx, [p1.reviewId], "The content was not approved.");
      ok("rejected review withdraws the claim", (await claimOf(s1)).status === "withdrawn");
      ok("slot back after rejection", (await taken(exam.id)) === 9);
      const dSub = await submit(D, d1, exam.id);
      ok("D takes the freed slot", dSub.ok, dSub);

      const dClaim = await claimOf(d1);
      ok("credit before approval refused", /Approve the/.test(await refused(() => creditClaim(trx, dClaim.id, admin))));
      await approve(d1, dSub.reviewId);
      await creditClaim(trx, dClaim.id, admin);
      ok("credit works", (await claimOf(d1)).status === "credited");
      const bal1 = await getTeacherAvailableBalance(D, trx);
      ok("balance includes it", Number(bal1.totalCampaignBonuses) === 100, bal1);
      await reverseClaim(trx, dClaim.id, admin, "copied");
      ok("reverse works", (await claimOf(d1)).status === "reversed");
      ok("balance drops", Number((await getTeacherAvailableBalance(D, trx)).totalCampaignBonuses) === 0);
      ok("reversed keeps its slot", (await taken(exam.id)) === 10);
      ok("reversed series cannot claim again", /already had its bonus/.test(((await checkClaimable(trx, exam, D, "mock_test", d1)) as { reason: string }).reason));

      await approve(s4, p4.reviewId);
      await declineClaim(trx, (await claimOf(s4)).id, admin, "thin");
      ok("declined gives the slot back", (await taken(exam.id)) === 9);

      const e1 = await series(E, [CAT]);
      const eSub = await submit(E, e1, exam.id);
      ok("E claims", eSub.ok, eSub);
      await approve(e1, eSub.reviewId);
      const eClaim = await claimOf(e1);
      await saveContentExams(trx, "mock_test", e1, []);
      ok("credit refused after the tag is removed", /no longer tagged/.test(await refused(() => creditClaim(trx, eClaim.id, admin))));
      await saveContentExams(trx, "mock_test", e1, [{ examId: CAT, examName: "CAT" }]);

      await endExamCampaign(trx, exam.id);
      ok("ended: not running", (await getRunningExamCampaigns(trx)).length === 0);
      const lateId = await series(C, [CAT]);
      ok("no claims after the end", /has ended/.test((await submit(C, lateId, exam.id)).error));
      ok("no options after the end", (await examBonusOptions(trx, C, lateId)).length === 0);
      await creditClaim(trx, eClaim.id, admin);
      ok("waiting claim still credits after the end", (await claimOf(e1)).status === "credited");
      ok("ending twice refused", /has ended/.test(await refused(() => endExamCampaign(trx, exam.id))));
      ok("editing after the end refused", /has ended/.test(await refused(() => editExamCampaign(trx, { id: exam.id, totalSlots: 10, amount: 100, perTeacher: 3, endsAt: later }))));
      const next = await startExamCampaign(trx, { examId: CAT, ...defaults, totalSlots: 5, amount: 50 });
      ok("a new campaign can start for the exam", next.totalSlots === 5 && Number(next.mockTestAmount) === 50);
      ok("claims keep their own amount", Number((await claimOf(e1)).amount) === 100);
      ok("Creator Bonus still the active one", (await getActiveCampaign(trx))?.id === 1);

      const suggested = await sql<{ examId: number }>`SELECT DISTINCT p.exam_id FROM exam_news_posts p
        WHERE p.status = 'published' AND p.exam_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM teacher_campaigns c WHERE c.kind = 'exam' AND c.exam_id = p.exam_id AND c.is_active AND c.ends_at > now())`.execute(trx);
      ok("running exam is not suggested", !suggested.rows.some((r) => r.examId === CAT));
      void t;
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  ok("rows unchanged after rollback", JSON.stringify((await countAll()).rows) === before, (await countAll()).rows);
}

async function race(ok: (name: string, cond: unknown, extra?: unknown) => void) {
  const s = SCHEMA;
  const raw = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false, connection: { search_path: `${s},public` } as never });
  const probe = new Kysely<any>({ plugins: [new CamelCasePlugin()], dialect: new PostgresJSDialect({ postgres: raw as never }) });
  try {
    await sql.raw(`DROP SCHEMA IF EXISTS ${s} CASCADE`).execute(db);
    await sql.raw(`CREATE SCHEMA ${s}`).execute(db);
    for (const table of CLONED) {
      await sql.raw(`CREATE TABLE ${s}.${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES)`).execute(db);
    }
    const teachers = (
      await sql<{ id: number }>`SELECT id FROM users WHERE role = 'teacher' ORDER BY id DESC LIMIT 3`.execute(db)
    ).rows.map((r) => r.id);
    const [A, B, C] = teachers;
    // An exam row in the real table would replace the Creator Bonus on the live site, so stop unless the clones are in use.
    for (let i = 0; i < 2; i++) {
      for (const table of ["teacher_campaigns", "teacher_campaign_claims"]) {
        const home = await sql<{ nspname: string }>`SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = ${table}::regclass`.execute(probe);
        if (home.rows[0]?.nspname !== s) throw new Error(`Refusing to run: ${table} resolves to ${home.rows[0]?.nspname}`);
      }
    }
    const exam = await probe.transaction().execute((trx: never) =>
      startExamCampaign(trx, { examId: CAT, totalSlots: 10, amount: 100, perTeacher: 100, days: 1, minTests: 1, minQuestions: 1 })
    );
    const makeSeries = async (teacher: number, n: number) => {
      const id = (
        await sql<{ id: number }>`INSERT INTO mock_tests (title, slug, teacher_id) VALUES (${"race " + n}, ${"race-" + Date.now() + "-" + n}, ${teacher}) RETURNING id`.execute(probe)
      ).rows[0].id;
      const item = (await sql<{ id: number }>`INSERT INTO mock_test_items (title, package_id) VALUES ('p', ${id}) RETURNING id`.execute(probe)).rows[0].id;
      await sql`INSERT INTO test_questions (question_text, test_id) VALUES ('q', ${item})`.execute(probe);
      await sql`INSERT INTO mock_test_exams (mock_test_id, exam_id, exam_name, position) VALUES (${id}, ${CAT}, 'CAT', 0)`.execute(probe);
      return id;
    };
    const claim = (teacher: number, id: number) =>
      probe.transaction().execute(async (trx: never) => {
        const reviewId = (
          await sql<{ id: number }>`INSERT INTO content_reviews (content_type, content_id, teacher_id, status) VALUES ('mock_test', ${id}, ${teacher}, 'pending') RETURNING id`.execute(trx)
        ).rows[0].id;
        return createClaim(trx, { teacherId: teacher, type: "mock_test", contentId: id, reviewId, examCampaignId: exam.id });
      });
    for (let i = 0; i < 9; i++) await claim(A, await makeSeries(A, i));
    for (let round = 0; round < 8; round++) {
      const [x, y] = [await makeSeries(B, 100 + round), await makeSeries(C, 200 + round)];
      const results = await Promise.allSettled([claim(B, x), claim(C, y)]);
      const wins = results.filter((r) => r.status === "fulfilled").length;
      const left = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      const count = (await sql<{ n: string }>`SELECT COUNT(*) n FROM teacher_campaign_claims WHERE campaign_id = ${exam.id}`.execute(probe)).rows[0].n;
      ok(`race ${round + 1}: one winner, 10 slots taken`, wins === 1 && Number(count) === 10 && /All 10 slots/.test(String(left?.reason?.message)), { wins, count, why: left?.reason?.message });
      await sql`DELETE FROM teacher_campaign_claims WHERE campaign_id = ${exam.id} AND teacher_id IN (${B}, ${C})`.execute(probe);
    }
  } finally {
    await probe.destroy();
    await sql.raw(`DROP SCHEMA IF EXISTS ${s} CASCADE`).execute(db);
  }
  const left = await sql<{ n: string }>`SELECT COUNT(*) n FROM information_schema.schemata WHERE schema_name = ${s}`.execute(db);
  ok("scratch schema removed", Number(left.rows[0].n) === 0);
}
