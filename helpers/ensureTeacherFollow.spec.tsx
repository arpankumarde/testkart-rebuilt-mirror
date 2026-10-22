import { CamelCasePlugin, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import type { DatabaseConnection } from "kysely";
import { DB } from "./schema";
import { followTeacher, followTeacherForTestItem, followTeachersForOrder } from "./ensureTeacherFollow";

type Row = Record<string, unknown>;
type Query = { sql: string; parameters: readonly unknown[] };

// Compiles the real queries and answers them from `respond`, with no database.
function fakeDb(respond: (sql: string) => Row[]) {
  const queries: Query[] = [];
  const connection: DatabaseConnection = {
    async executeQuery(query) {
      queries.push({ sql: query.sql, parameters: query.parameters });
      return { rows: respond(query.sql) as never[] };
    },
    async *streamQuery() {
      throw new Error("not used");
    },
  };
  const db = new Kysely<DB>({
    plugins: [new CamelCasePlugin()],
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, queries };
}

const answers = (options: { role?: string; unfollowed?: number[]; items?: Row[]; bundleTeacher?: number; testTeacher?: number }) =>
  (sql: string): Row[] => {
    if (sql.includes('from "order_items"')) return options.items ?? [];
    if (sql.includes('from "course_bundles"')) return options.bundleTeacher ? [{ teacher_id: options.bundleTeacher }] : [];
    if (sql.includes('from "mock_test_items"')) return options.testTeacher ? [{ teacher_id: options.testTeacher }] : [];
    if (sql.includes('from "users"')) return [{ role: options.role ?? "student" }];
    if (sql.includes('from "teacher_unfollows"')) return (options.unfollowed ?? []).map((teacher_id) => ({ teacher_id }));
    return [];
  };

const inserts = (queries: Query[]) => queries.filter((query) => query.sql.startsWith('insert into "teacher_follows"'));

describe("ensureTeacherFollow", () => {
  it("follows the teacher without ever creating a duplicate", async () => {
    const { db, queries } = fakeDb(answers({}));
    await followTeacher(db, 7, 20);

    expect(inserts(queries).length).toBe(1);
    expect(inserts(queries)[0].sql).toContain('on conflict ("teacher_id", "student_id") do nothing');
    expect(inserts(queries)[0].parameters).toEqual([20, 7]);
  });

  it("leaves a student who unfollowed the teacher alone", async () => {
    const { db, queries } = fakeDb(answers({ unfollowed: [20] }));
    await followTeacher(db, 7, 20);

    expect(inserts(queries).length).toBe(0);
  });

  it("never follows yourself", async () => {
    const { db, queries } = fakeDb(answers({}));
    await followTeacher(db, 20, 20);

    expect(queries.length).toBe(0);
  });

  it("only lets students follow", async () => {
    const { db, queries } = fakeDb(answers({ role: "teacher" }));
    await followTeacher(db, 7, 20);

    expect(inserts(queries).length).toBe(0);
  });

  it("follows every teacher behind an order once, including the bundle's", async () => {
    const { db, queries } = fakeDb(
      answers({
        items: [
          { course_teacher_id: 20, product_teacher_id: null, test_teacher_id: null },
          { course_teacher_id: null, product_teacher_id: 20, test_teacher_id: null },
          { course_teacher_id: null, product_teacher_id: null, test_teacher_id: 21 },
        ],
        bundleTeacher: 22,
      })
    );
    await followTeachersForOrder(db, 500, 9, 7);

    expect(inserts(queries)[0].parameters).toEqual([20, 7, 21, 7, 22, 7]);
  });

  it("skips only the unfollowed teacher in a mixed order", async () => {
    const { db, queries } = fakeDb(
      answers({
        items: [
          { course_teacher_id: 20, product_teacher_id: null, test_teacher_id: null },
          { course_teacher_id: 21, product_teacher_id: null, test_teacher_id: null },
        ],
        unfollowed: [20],
      })
    );
    await followTeachersForOrder(db, 500, null, 7);

    expect(inserts(queries)[0].parameters).toEqual([21, 7]);
  });

  it("does nothing for an order with no items", async () => {
    const { db, queries } = fakeDb(answers({}));
    await followTeachersForOrder(db, 500, null, 7);

    expect(inserts(queries).length).toBe(0);
  });

  it("follows the teacher behind an attempted test item", async () => {
    const { db, queries } = fakeDb(answers({ testTeacher: 20 }));
    await followTeacherForTestItem(db, 7, 900);

    expect(inserts(queries)[0].parameters).toEqual([20, 7]);
  });

  it("ignores a test item that no longer exists", async () => {
    const { db, queries } = fakeDb(answers({}));
    await followTeacherForTestItem(db, 7, 900);

    expect(inserts(queries).length).toBe(0);
  });
});
