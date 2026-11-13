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
import type { CampaignContentType } from "./teacherCampaignRules";

const TEACHER = 7;

const campaign = {
  id: 1,
  kind: "creator",
  title: "Creator Bonus",
  examId: null,
  totalSlots: null,
  maxMockTests: 3,
  maxCourses: 3,
  mockTestAmount: "100.00",
  courseAmount: "100.00",
  maxDeclinesPerItem: 2,
  minTests: 10,
  minQuestions: 500,
  minVideos: 10,
  minVideoMinutes: 200,
  minMinutesPerVideo: 10,
} as unknown as Campaign;

/* Answers each query checkClaimable sends for one qualifying item, with `used` claimed or credited slots per type. */
const fakeDb = (used: Record<CampaignContentType, number>) => {
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      const text = query.sql.toLowerCase();
      let rows: unknown[] = [];
      if (text.includes("mock_test_items")) {
        rows = [{ tests: "10", questions: "500" }];
      } else if (text.includes("course_lessons")) {
        rows = Array.from({ length: 10 }, (_, i) => ({
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
  return new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
};

const check = (used: Record<CampaignContentType, number>, type: CampaignContentType) =>
  checkClaimable(fakeDb(used), campaign, TEACHER, type, type === "mock_test" ? 10 : 20);

describe("Creator Bonus per-teacher limits", () => {
  it("reads 3 test series and 3 courses, 6 in all, from the campaign", () => {
    expect(campaignSlotLimit(campaign, "mock_test")).toBe(3);
    expect(campaignSlotLimit(campaign, "course")).toBe(3);
    expect(campaignSlotLimit(campaign, "mock_test") + campaignSlotLimit(campaign, "course")).toBe(6);
  });

  it("lets a teacher claim while under the limit in a category", async () => {
    expect((await check({ mock_test: 0, course: 0 }, "mock_test")).ok).toBeTrue();
    expect((await check({ mock_test: 2, course: 0 }, "mock_test")).ok).toBeTrue();
    expect((await check({ mock_test: 0, course: 2 }, "course")).ok).toBeTrue();
  });

  it("refuses the 4th test series and says the maximum is reached", async () => {
    const result = await check({ mock_test: 3, course: 0 }, "mock_test");
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("You have reached the maximum of 3 test series bonuses in the Creator Bonus.");
  });

  it("refuses the 4th course and says the maximum is reached", async () => {
    const result = await check({ mock_test: 1, course: 3 }, "course");
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("You have reached the maximum of 3 course bonuses in the Creator Bonus.");
  });

  it("keeps the other category open once one category is full", async () => {
    expect((await check({ mock_test: 3, course: 0 }, "course")).ok).toBeTrue();
    expect((await check({ mock_test: 1, course: 3 }, "mock_test")).ok).toBeTrue();
  });

  it("stops at 6 claims in all, with both categories full", async () => {
    expect((await check({ mock_test: 3, course: 3 }, "mock_test")).ok).toBeFalse();
    expect((await check({ mock_test: 3, course: 3 }, "course")).ok).toBeFalse();
  });

  it("blocks new claims for a teacher credited 5 under the old limit, without needing their claims changed", async () => {
    expect((await check({ mock_test: 5, course: 0 }, "mock_test")).ok).toBeFalse();
    expect((await check({ mock_test: 5, course: 0 }, "course")).ok).toBeTrue();
  });
});