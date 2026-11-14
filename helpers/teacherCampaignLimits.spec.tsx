import {
  CamelCasePlugin,
  CompiledQuery,
  DatabaseConnection,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
} from "kysely";
import type { DB } from "./schema";
import { campaignSlotLimit, checkClaimable, type Campaign } from "./teacherCampaign";
import { contentListText, creatorBonusLeft, type CampaignContentType } from "./teacherCampaignRules";

const TEACHER = 7;

const campaign = {
  id: 1,
  kind: "creator",
  title: "Creator Bonus",
  examId: null,
  totalSlots: null,
  maxMockTests: 1,
  maxCourses: 1,
  mockTestAmount: "100.00",
  courseAmount: "100.00",
  maxDeclinesPerItem: 2,
  minTests: 10,
  minQuestions: 500,
  minVideos: 10,
  minVideoMinutes: 200,
  minMinutesPerVideo: 10,
} as unknown as Campaign;

type Used = Record<CampaignContentType, number>;

/*
 * Answers each query checkClaimable sends for one item, with `used` claimed or
 * credited slots per type. `small` makes the item miss the size rules.
 */
const fakeDb = (used: Used, small = false) => {
  const statements: string[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      const text = query.sql.toLowerCase();
      statements.push(text);
      let rows: unknown[] = [];
      if (text.includes("mock_test_items")) {
        rows = [{ tests: small ? "2" : "10", questions: small ? "40" : "500" }];
      } else if (text.includes("course_lessons")) {
        rows = Array.from({ length: small ? 2 : 10 }, (_, i) => ({
          course_id: 20,
          title: `Lesson ${i + 1}`,
          content_url: `https://cdn.testkart.in/video-${i}.mp4`,
          duration_minutes: 20,
          recorded_seconds: null,
        }));
      } else if (text.includes(`from "teacher_campaign_claims"`) && text.includes("count(*)")) {
        const type = query.parameters.includes("course") ? "course" : "mock_test";
        rows = [{ count: String(used[type]) }];
      } else if (text.includes(`from "mock_tests"`)) {
        rows = [{ teacher_id: TEACHER, title: "Series", is_published: false, deleted_at: null, is_live_test: false }];
      } else if (text.includes(`from "courses"`)) {
        rows = [{ teacher_id: TEACHER, title: "Course", status: "draft" }];
      }
      return { rows: rows as R[] };
    },
    async *streamQuery() {
      throw new Error("not used");
    },
  };
  const driver: Driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, statements };
};

const check = (used: Used, type: CampaignContentType, small = false) =>
  checkClaimable(fakeDb(used, small).db, campaign, TEACHER, type, type === "mock_test" ? 10 : 20);

describe("Creator Bonus per-teacher limits", () => {
  it("reads 1 test series and 1 course, 2 in all, from the campaign", () => {
    expect(campaignSlotLimit(campaign, "mock_test")).toBe(1);
    expect(campaignSlotLimit(campaign, "course")).toBe(1);
  });

  it("lets a teacher with nothing claimed claim either type", async () => {
    expect((await check({ mock_test: 0, course: 0 }, "mock_test")).ok).toBeTrue();
    expect((await check({ mock_test: 0, course: 0 }, "course")).ok).toBeTrue();
  });

  it("refuses a 2nd test series and a 2nd course with a limit message", async () => {
    const series = await check({ mock_test: 1, course: 0 }, "mock_test");
    const course = await check({ mock_test: 0, course: 1 }, "course");
    expect(series.ok).toBeFalse();
    expect(course.ok).toBeFalse();
    if (!series.ok) expect(series.reason).toBe("You have reached the limit of 1 test series bonus in the Creator Bonus.");
    if (!course.ok) expect(course.reason).toBe("You have reached the limit of 1 course bonus in the Creator Bonus.");
  });

  it("keeps the other type open once one type is used", async () => {
    expect((await check({ mock_test: 1, course: 0 }, "course")).ok).toBeTrue();
    expect((await check({ mock_test: 0, course: 1 }, "mock_test")).ok).toBeTrue();
  });

  it("refuses both types once both are used", async () => {
    expect((await check({ mock_test: 1, course: 1 }, "mock_test")).ok).toBeFalse();
    expect((await check({ mock_test: 1, course: 1 }, "course")).ok).toBeFalse();
  });

  it("checks the limit before the size rules, so a full teacher sees no progress toward a bonus", async () => {
    const { db, statements } = fakeDb({ mock_test: 1, course: 0 }, true);
    const result = await checkClaimable(db, campaign, TEACHER, "mock_test", 10);
    expect(result.ok).toBeFalse();
    expect(result.criteria).toBeNull();
    if (!result.ok) expect(result.reason).toContain("limit of 1 test series bonus");
    expect(statements.some((s) => s.includes("mock_test_items"))).toBeFalse();
  });

  it("still applies the size rules unchanged while a slot is open", async () => {
    const result = await check({ mock_test: 0, course: 0 }, "mock_test", true);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("Add 8 more tests and 460 more questions to claim the bonus.");
    const course = await check({ mock_test: 0, course: 0 }, "course", true);
    expect(course.ok).toBeFalse();
    if (!course.ok) expect(course.reason).toBe("Add 8 more videos and 160 more video minutes to claim the bonus.");
  });

  it("blocks new claims for a teacher credited 5 under an old limit, without changing their claims", async () => {
    expect((await check({ mock_test: 5, course: 0 }, "mock_test")).ok).toBeFalse();
    expect((await check({ mock_test: 5, course: 0 }, "course")).ok).toBeTrue();
  });
});

describe("creatorBonusLeft", () => {
  const slots = (mock: number, course: number) => ({
    mock_test: { used: mock, limit: 1 },
    course: { used: course, limit: 1 },
  });

  it("is open with both slots free and lists what is left", () => {
    expect(creatorBonusLeft(slots(0, 0))).toEqual({ left: { mock_test: 1, course: 1 }, total: 2, done: false });
    expect(contentListText(creatorBonusLeft(slots(0, 0)).left)).toBe("1 test series and 1 course");
  });

  it("lists only the remaining type once one is used", () => {
    expect(contentListText(creatorBonusLeft(slots(1, 0)).left)).toBe("1 course");
    expect(contentListText(creatorBonusLeft(slots(0, 1)).left)).toBe("1 test series");
  });

  it("is done once both are claimed, including teachers over an old cap", () => {
    expect(creatorBonusLeft(slots(1, 1)).done).toBeTrue();
    expect(creatorBonusLeft(slots(5, 1))).toEqual({ left: { mock_test: 0, course: 0 }, total: 0, done: true });
    expect(creatorBonusLeft(slots(5, 0)).done).toBeFalse();
  });
});