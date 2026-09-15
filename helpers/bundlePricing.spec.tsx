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
import { computeBundlePricing, loadBundleItemPrices, BundleRuleError } from "./bundlePricing";

const fakeDb = (answers: Record<string, { id: number; price: string }[]>) => {
  const statements: string[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push(query.sql);
      const table = Object.keys(answers).find((t) => query.sql.includes(`from "${t}"`));
      return { rows: (table ? answers[table] : []) as R[] };
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

describe("computeBundlePricing", () => {
  it("sums current item prices, including the strings Kysely returns", () => {
    expect(computeBundlePricing([400, "600.00"], 700)).toEqual({ originalPrice: 1000, discountPercentage: 30, priceError: null });
    expect(computeBundlePricing([0.1, 0.2], 0.1).originalPrice).toBe(0.3);
  });

  it("refuses a price at or above the combined price, and a negative price", () => {
    expect(computeBundlePricing([400, 600], 1000).priceError).toContain("less than");
    expect(computeBundlePricing([400, 600], -5).priceError).toBe("Price cannot be negative.");
    expect(computeBundlePricing([400, 600], 1000).discountPercentage).toBe(0);
  });

  it("agrees with the form when items were repriced after the bundle was saved", () => {
    const storedOriginalPrice = 500;
    const currentItemPrices = [400, 600];
    const price = 700;
    // Before: the form recomputed from current prices while the server reused
    // the stored value, so a valid save was refused.
    const oldServerRefused = price >= storedOriginalPrice;
    const formAllowed = computeBundlePricing(currentItemPrices, price).priceError === null;
    expect(oldServerRefused && formAllowed).toBe(true);
    // After: both sides call the same function on the same prices.
    const server = computeBundlePricing(currentItemPrices, price);
    expect(server.priceError).toBeNull();
    expect(server.originalPrice).toBe(1000);
    // And the other direction: a stale 1000 no longer props up a fake strikethrough.
    expect(computeBundlePricing([300, 300], 700).priceError).not.toBeNull();
  });
});

describe("loadBundleItemPrices", () => {
  it("reads current prices of unchanged items without re-checking ownership", async () => {
    const { db, statements } = fakeDb({ courses: [{ id: 1, price: "400.00" }], mock_tests: [{ id: 2, price: "600.00" }] });
    const prices = await loadBundleItemPrices(db, 7, { courseIds: [1], testIds: [2], digitalProductIds: [] }, false);
    expect(prices).toEqual([400, 600]);
    expect(statements.some((s) => s.includes("teacher_id"))).toBe(false);
  });

  it("checks ownership when the item set changes", async () => {
    const { db, statements } = fakeDb({ courses: [{ id: 1, price: "400.00" }] });
    let error: unknown;
    try {
      await loadBundleItemPrices(db, 7, { courseIds: [1, 3], testIds: [], digitalProductIds: [] }, true);
    } catch (e) {
      error = e;
    }
    expect(error instanceof BundleRuleError).toBe(true);
    expect(statements[0]).toContain("teacher_id");
  });
});
