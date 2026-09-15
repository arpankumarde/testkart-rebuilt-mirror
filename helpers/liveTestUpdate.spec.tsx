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
import { applyLiveTestUpdate, LiveTestUpdateError } from "./liveTestUpdate";
import { buildDuplicatedLiveTestValues } from "./liveTestDuplicate";
import { LIVE_TEST_PUBLISHED_LOCKED_FIELDS } from "./liveTestLocks";
import { schema as updateSchema } from "../endpoints/teacher/live-tests/update_POST.schema";

const DAY = 24 * 60 * 60 * 1000;
const TIERS_JSON = '[{"rankFrom":1,"rankTo":1,"amountPerRank":500},{"rankFrom":2,"rankTo":5,"amountPerRank":100}]';

type Row = Record<string, unknown>;
type Statement = { sql: string; parameters: readonly unknown[] };

const storedLiveTest = (overrides: Row = {}): Row => ({
  id: 75010,
  mock_test_id: 75020,
  teacher_id: 75001,
  title: "Mock A",
  description: "<p>Description</p>",
  price: "100.00",
  discount_price: null,
  is_free: false,
  start_time: new Date(Date.now() + 2 * DAY),
  end_time: new Date(Date.now() + 3 * DAY),
  registration_deadline: null,
  max_seats: 100,
  thumbnail_url: null,
  thumbnail_file_id: null,
  intro_video_url: null,
  intro_video_file_id: null,
  has_prizes: true,
  prize_tiers: TIERS_JSON,
  total_prize_pool: "900.00",
  first_prize: "500.00",
  second_prize: "100.00",
  third_prize: "100.00",
  prize_fund_source: "enrollment",
  prize_distribution_status: "pending",
  actual_total_distributed: "0",
  enrolled_count: 0,
  view_count: 0,
  is_active: false,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

/** A Kysely instance whose driver answers from the given rows and records every statement. */
const fakeDb = (
  liveTestRow: Row,
  itemRow: Row = { duration_minutes: 60, subject_wise_timing: false, question_wise_timing: false }
) => {
  const statements: Statement[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push({ sql: query.sql, parameters: query.parameters });
      if (query.sql.startsWith("select") && query.sql.includes('from "live_tests"')) return { rows: [liveTestRow] as R[] };
      if (query.sql.startsWith("select") && query.sql.includes('from "mock_test_items"')) return { rows: [itemRow] as R[] };
      if (query.sql.startsWith('update "live_tests"')) return { rows: [liveTestRow] as R[] };
      return { rows: [] as R[] };
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
  const writes = () => statements.filter((s) => !s.sql.startsWith("select"));
  return { db, statements, writes };
};

const makeDeps = (examCalls: (string | null)[] = []) => ({
  resolveExam: async (examName: string | null) => {
    examCalls.push(examName);
    return { examId: 7, examName };
  },
  countEnrollments: async () => 0,
});

const rejection = async (run: () => Promise<unknown>): Promise<LiveTestUpdateError | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof LiveTestUpdateError ? error : null;
  }
};

describe("applyLiveTestUpdate", () => {
  it("strips mockTestId and only ever writes the stored mock test", async () => {
    const parsed = updateSchema.parse({ id: 75010, mockTestId: 99999, title: "Mock B" });
    expect("mockTestId" in parsed).toBe(false);

    const { db, writes } = fakeDb(storedLiveTest());
    await applyLiveTestUpdate(db, 75001, { ...parsed, mockTestId: 99999 } as any, makeDeps());

    expect(writes().some((s) => s.sql.includes("mock_test_id"))).toBe(false);
    const mockTestWrite = writes().find((s) => s.sql.startsWith('update "mock_tests"'));
    expect(mockTestWrite?.parameters).toContain(75020);
    expect(mockTestWrite?.parameters).not.toContain(99999);
  });

  it("rejects a live test owned by another teacher", async () => {
    const { db, writes } = fakeDb(storedLiveTest({ teacher_id: 75002 }));
    const error = await rejection(() => applyLiveTestUpdate(db, 75001, { id: 75010, title: "Mock B" }, makeDeps()));
    expect(error?.status).toBe(403);
    expect(writes().length).toBe(0);
  });

  it("rejects every field the form locks on a published test, and writes nothing", async () => {
    const samples: Record<string, unknown> = {
      examName: "UPSC",
      durationMinutes: 30,
      calculatorEnabled: true,
      subjectWiseTiming: true,
      questionWiseTiming: true,
      price: 0,
      discountPrice: null,
      isFree: true,
      maxSeats: 500,
      registrationDeadline: null,
      startTime: null,
      endTime: new Date(Date.now() - DAY),
      hasPrizes: false,
      prizeTiers: [],
    };
    for (const field of LIVE_TEST_PUBLISHED_LOCKED_FIELDS) {
      const { db, writes } = fakeDb(storedLiveTest({ is_active: true }));
      const error = await rejection(() =>
        applyLiveTestUpdate(db, 75001, { id: 75010, [field]: samples[field] } as any, makeDeps())
      );
      expect(error?.status).withContext(field).toBe(400);
      expect(writes().length).withContext(field).toBe(0);
    }
  });

  it("still saves title, language and storefront copy on a published test", async () => {
    const { db, writes } = fakeDb(storedLiveTest({ is_active: true }));
    await applyLiveTestUpdate(
      db,
      75001,
      { id: 75010, title: "Mock B", language: "English", whatYouLearn: ["Speed"], thumbnailUrl: null },
      makeDeps()
    );
    const liveTestWrite = writes().find((s) => s.sql.startsWith('update "live_tests"'));
    const mockTestWrite = writes().find((s) => s.sql.startsWith('update "mock_tests"'));
    expect(liveTestWrite?.parameters).toContain("Mock B");
    expect(liveTestWrite?.sql).toContain('"thumbnail_file_id"');
    expect(mockTestWrite?.sql).toContain('"language"');
    expect(mockTestWrite?.parameters).toContain("English");
  });

  it("resolves the exam only when examName is sent", async () => {
    const calls: (string | null)[] = [];
    await applyLiveTestUpdate(fakeDb(storedLiveTest()).db, 75001, { id: 75010, title: "Mock B" }, makeDeps(calls));
    expect(calls).toEqual([]);
    await applyLiveTestUpdate(fakeDb(storedLiveTest()).db, 75001, { id: 75010, examName: "SSC CGL" }, makeDeps(calls));
    expect(calls).toEqual(["SSC CGL"]);
  });

  it("checks a partial schedule against the stored start time", async () => {
    const { db, writes } = fakeDb(storedLiveTest());
    const error = await rejection(() =>
      applyLiveTestUpdate(db, 75001, { id: 75010, endTime: new Date(Date.now() + DAY) }, makeDeps())
    );
    expect(error?.message).toBe("Start time must be before the end time.");
    expect(writes().length).toBe(0);
  });

  it("clears the tiers and pool when prizes are switched off on a draft", async () => {
    const { db, writes } = fakeDb(storedLiveTest());
    await applyLiveTestUpdate(
      db,
      75001,
      { id: 75010, hasPrizes: false, prizeTiers: [{ rankFrom: 1, rankTo: 1, amountPerRank: 500 }] },
      makeDeps()
    );
    const write = writes().find((s) => s.sql.startsWith('update "live_tests"'));
    expect(write?.sql).toMatch(/"prize_tiers" = \$\d+::text::jsonb/);
    expect(write?.parameters).toContain("[]");
    expect(write?.parameters).toContain("0");
    expect(write?.parameters).toContain("not_applicable");
  });

  it("stores tiers as a jsonb array in rank order, with the full pool", async () => {
    const { db, writes } = fakeDb(storedLiveTest());
    await applyLiveTestUpdate(
      db,
      75001,
      {
        id: 75010,
        hasPrizes: true,
        prizeTiers: [
          { rankFrom: 2, rankTo: 5, amountPerRank: 100 },
          { rankFrom: 1, rankTo: 1, amountPerRank: 500 },
        ],
      },
      makeDeps()
    );
    const write = writes().find((s) => s.sql.startsWith('update "live_tests"'));
    expect(write?.parameters).toContain(TIERS_JSON);
    expect(write?.parameters).toContain("900");
  });

  it("zeroes the duration and turns question-wise timing off when subject-wise timing is enabled", async () => {
    const { db, writes } = fakeDb(storedLiveTest(), { duration_minutes: 45, subject_wise_timing: false, question_wise_timing: true });
    await applyLiveTestUpdate(db, 75001, { id: 75010, subjectWiseTiming: true }, makeDeps());
    const write = writes().find((s) => s.sql.startsWith('update "mock_test_items"'));
    expect(write?.sql).toContain('"duration_minutes"');
    expect(write?.sql).toContain('"question_wise_timing"');
    expect(write?.parameters.slice(0, 3)).toEqual([0, true, false]);
  });

  it("rejects turning per-section timing off while the stored duration is 0", async () => {
    const { db, writes } = fakeDb(storedLiveTest(), { duration_minutes: 0, subject_wise_timing: true, question_wise_timing: false });
    const error = await rejection(() => applyLiveTestUpdate(db, 75001, { id: 75010, subjectWiseTiming: false }, makeDeps()));
    expect(error?.message).toBe("Duration must be at least 1 minute.");
    expect(writes().length).toBe(0);
  });
});

describe("buildDuplicatedLiveTestValues", () => {
  it("copies the tier list, free and discount pricing and the intro video", () => {
    const { db } = fakeDb(storedLiveTest());
    const source: any = {
      id: 75010,
      mockTestId: 75020,
      teacherId: 75001,
      title: "Mock A",
      description: null,
      price: "0.00",
      discountPrice: "0.00",
      isFree: true,
      startTime: null,
      endTime: new Date(Date.now() - DAY),
      registrationDeadline: null,
      maxSeats: 50,
      thumbnailUrl: null,
      thumbnailFileId: null,
      introVideoUrl: "https://video.example.invalid/intro",
      introVideoFileId: "video-1",
      hasPrizes: true,
      prizeTiers: TIERS_JSON,
      totalPrizePool: "900.00",
      firstPrize: "500.00",
      secondPrize: "100.00",
      thirdPrize: "100.00",
      prizeFundSource: "teacher_wallet",
    };
    const values = buildDuplicatedLiveTestValues(source, 75099, { endTime: new Date(Date.now() + DAY) });
    const compiled = db.insertInto("liveTests").values(values).compile();

    expect(compiled.sql).toContain('"prize_tiers"');
    expect(compiled.sql).toContain("::text::jsonb");
    expect(compiled.parameters).toContain(TIERS_JSON);
    expect(values.isFree).toBe(true);
    expect(values.discountPrice).toBe("0.00");
    expect(values.introVideoUrl).toBe("https://video.example.invalid/intro");
    expect(values.introVideoFileId).toBe("video-1");
    expect(values.isActive).toBe(false);
    expect(values.mockTestId).toBe(75099);
  });
});