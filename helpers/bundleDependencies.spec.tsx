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
import superjson from "superjson";
import type { DB } from "./schema";
import {
  BUNDLE_CONFIRMATION_CODE,
  bundleConfirmationResponse,
  findPublishedBundlesContaining,
  unpublishBundles,
  unpublishBundlesContaining,
} from "./bundleDependencies";

type Statement = { sql: string; parameters: readonly unknown[] };

const fakeDb = (selectRows: { id: number; title: string }[]) => {
  const statements: Statement[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push({ sql: query.sql, parameters: query.parameters });
      const isSelect = query.sql.trimStart().startsWith("select");
      return { rows: (isSelect ? selectRows : []) as R[] };
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

describe("findPublishedBundlesContaining", () => {
  it("returns nothing and asks nothing when there are no items", async () => {
    const { db, statements } = fakeDb([{ id: 1, title: "Unused" }]);
    expect(await findPublishedBundlesContaining(db, "course", [])).toEqual([]);
    expect(statements.length).toBe(0);
  });

  it("looks only at published bundles, by item type and the matching item column", async () => {
    const cases = [
      { kind: "course", column: "course_id" },
      { kind: "test", column: "mock_test_id" },
      { kind: "digital_product", column: "digital_product_id" },
    ] as const;

    for (const { kind, column } of cases) {
      const { db, statements } = fakeDb([{ id: 7, title: "Bundle" }]);
      const bundles = await findPublishedBundlesContaining(db, kind, [3, 3, 4]);
      expect(bundles).toEqual([{ id: 7, title: "Bundle" }]);
      expect(statements.length).toBe(1);
      const { sql, parameters } = statements[0];
      expect(sql).toContain('"course_bundles"."is_published" = $');
      expect(sql).toContain(`"course_bundle_items"."${column}" in (`);
      expect(sql).toContain('"course_bundle_items"."item_type" = $');
      expect(parameters).toContain(true);
      expect(parameters).toContain(kind);
      expect(parameters.filter((p) => p === 3).length).toBe(1);
      expect(parameters).toContain(4);
    }
  });

  it("narrows to one teacher's bundles only when asked", async () => {
    const open = fakeDb([]);
    await findPublishedBundlesContaining(open.db, "course", [1]);
    expect(open.statements[0].sql).not.toContain("teacher_id");

    const narrowed = fakeDb([]);
    await findPublishedBundlesContaining(narrowed.db, "course", [1], { teacherId: 42 });
    expect(narrowed.statements[0].sql).toContain('"course_bundles"."teacher_id" = $');
    expect(narrowed.statements[0].parameters).toContain(42);
  });
});

describe("unpublishBundles", () => {
  it("writes nothing for an empty list", async () => {
    const { db, statements } = fakeDb([]);
    await db.transaction().execute((trx) => unpublishBundles(trx, []));
    expect(statements.length).toBe(0);
  });

  it("drafts every listed bundle in one statement and skips ones already unpublished", async () => {
    const { db, statements } = fakeDb([]);
    const now = new Date("2026-10-12T00:00:00Z");
    await db.transaction().execute((trx) =>
      unpublishBundles(
        trx,
        [
          { id: 5, title: "A" },
          { id: 9, title: "B" },
        ],
        now
      )
    );
    expect(statements.length).toBe(1);
    const { sql, parameters } = statements[0];
    expect(sql).toContain('update "course_bundles" set');
    expect(sql).toContain('"is_published" = $');
    expect(sql).toContain('"published_at" = $');
    expect(sql).toContain('"id" in (');
    expect(sql).toContain('and "is_published" = $');
    expect(parameters).toContain(false);
    expect(parameters).toContain(null);
    expect(parameters).toContain(5);
    expect(parameters).toContain(9);
    expect(parameters).toContain(now);
  });
});

describe("unpublishBundlesContaining", () => {
  it("finds the published bundles and takes them all down, returning them", async () => {
    const found = [
      { id: 11, title: "First" },
      { id: 12, title: "Second" },
    ];
    const { db, statements } = fakeDb(found);
    const result = await db.transaction().execute((trx) => unpublishBundlesContaining(trx, "test", [2]));
    expect(result).toEqual(found);
    expect(statements.length).toBe(2);
    expect(statements[0].sql.startsWith("select")).toBe(true);
    expect(statements[1].sql.startsWith('update "course_bundles"')).toBe(true);
    expect(statements[1].parameters).toContain(11);
    expect(statements[1].parameters).toContain(12);
  });

  it("does not write when no published bundle holds the item", async () => {
    const { db, statements } = fakeDb([]);
    const result = await db.transaction().execute((trx) => unpublishBundlesContaining(trx, "course", [2]));
    expect(result).toEqual([]);
    expect(statements.length).toBe(1);
    expect(statements[0].sql.startsWith("select")).toBe(true);
  });
});

describe("bundleConfirmationResponse", () => {
  it("is a 409 that carries the bundles and the confirmation code", async () => {
    const bundles = [{ id: 1, title: "Only one" }];
    const response = bundleConfirmationResponse(bundles);
    expect(response.status).toBe(409);
    const body = superjson.parse<{ error: string; code: string; bundles: typeof bundles }>(await response.text());
    expect(body.code).toBe(BUNDLE_CONFIRMATION_CODE);
    expect(body.bundles).toEqual(bundles);
    expect(body.error).toContain("a published bundle");
  });

  it("counts several bundles in its message", async () => {
    const response = bundleConfirmationResponse([
      { id: 1, title: "A" },
      { id: 2, title: "B" },
    ]);
    const body = superjson.parse<{ error: string }>(await response.text());
    expect(body.error).toContain("2 published bundles");
  });
});
