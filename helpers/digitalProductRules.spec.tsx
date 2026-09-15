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
import {
  getProductPublishIssues,
  formatPublishIssues,
  planProductFileSync,
  syncProductFiles,
  ProductRuleError,
  PLACEHOLDER_PDF_URL,
} from "./digitalProductRules";

type Row = { id: number; product_id: number; title: string; file_url: string; file_id: string | null; file_size_bytes: string | null; page_count: number | null; order_index: number };

const fakeDb = (rows: Row[], options: { failInsert?: boolean } = {}) => {
  const statements: { sql: string; parameters: readonly unknown[] }[] = [];
  const tx = { begun: 0, committed: 0, rolledBack: 0 };
  let nextId = 900;
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push({ sql: query.sql, parameters: query.parameters });
      const sql = query.sql;
      if (sql.startsWith("select")) return { rows: rows.map((r) => ({ ...r })) as R[] };
      if (sql.startsWith("insert")) {
        if (options.failInsert) throw new Error("insert failed");
        rows.push({ id: nextId++, product_id: 1, title: "new", file_url: String(query.parameters[2]), file_id: null, file_size_bytes: null, page_count: null, order_index: 0 });
      }
      return { rows: [] as R[], numAffectedRows: BigInt(1) };
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
    async beginTransaction() {
      tx.begun++;
    },
    async commitTransaction() {
      tx.committed++;
    },
    async rollbackTransaction() {
      tx.rolledBack++;
    },
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
  return { db, statements, tx };
};

const row = (id: number, url: string, title = "Chapter"): Row => ({
  id, product_id: 1, title, file_url: url, file_id: null, file_size_bytes: "10", page_count: 2, order_index: 0,
});

describe("getProductPublishIssues", () => {
  // The check this replaces: Kysely hands numeric columns back as strings.
  const oldCheck = (p: { pdfUrl: string; price: string; title: string; description: string }) =>
    !p.pdfUrl || !p.price || !p.title || !p.description;

  it("refuses a product whose only file is the placeholder, which the old check let through", () => {
    const product = { title: "Physics notes", description: "<p>Formulas</p>", price: "0.00", pdfUrl: PLACEHOLDER_PDF_URL };
    expect(oldCheck(product)).toBe(false);
    expect(getProductPublishIssues({ ...product, fileUrls: [PLACEHOLDER_PDF_URL] })).toEqual(["upload at least one PDF file"]);
    expect(getProductPublishIssues({ ...product, fileUrls: [] })).toEqual(["upload at least one PDF file"]);
  });

  it("accepts a free product with a real file, and a legacy product whose file lives only on pdfUrl", () => {
    const base = { title: "Physics notes", description: "Formulas", price: "0.00" };
    expect(getProductPublishIssues({ ...base, pdfUrl: PLACEHOLDER_PDF_URL, fileUrls: ["https://cdn.testkart.in/a.pdf"] })).toEqual([]);
    expect(getProductPublishIssues({ ...base, pdfUrl: "https://cdn.testkart.in/legacy.pdf", fileUrls: [] })).toEqual([]);
  });

  it("parses the price string instead of testing it for truthiness", () => {
    const base = { title: "Physics notes", description: "Formulas", pdfUrl: "https://cdn.testkart.in/a.pdf", fileUrls: [] };
    expect(getProductPublishIssues({ ...base, price: "abc" })).toEqual(["set a price (0 for free)"]);
    expect(getProductPublishIssues({ ...base, price: "-1" })).toEqual(["set a price (0 for free)"]);
    expect(getProductPublishIssues({ ...base, price: "199.00" })).toEqual([]);
  });

  it("lists every missing piece in one sentence", () => {
    const issues = getProductPublishIssues({ title: "", description: "<p></p>", price: null, pdfUrl: PLACEHOLDER_PDF_URL, fileUrls: [] });
    expect(formatPublishIssues(issues)).toBe("Add a title, add a description, set a price (0 for free) and upload at least one PDF file");
  });
});

describe("planProductFileSync", () => {
  it("updates rows in place by id, inserts only new files and deletes only removed ones", () => {
    const plan = planProductFileSync(
      [{ id: 11, fileUrl: "https://cdn/a.pdf" }, { id: 12, fileUrl: "https://cdn/b.pdf" }],
      [
        { id: 12, title: "B renamed", fileUrl: "https://cdn/b.pdf" },
        { title: "C", fileUrl: "https://cdn/c.pdf" },
      ]
    );
    expect(plan.updates.map((u) => [u.id, u.orderIndex])).toEqual([[12, 0]]);
    expect(plan.inserts.map((i) => [i.file.title, i.orderIndex])).toEqual([["C", 1]]);
    expect(plan.deleteIds).toEqual([11]);
  });

  it("matches files sent without ids by URL, drops placeholders and never adopts another product's id", () => {
    const plan = planProductFileSync(
      [{ id: 21, fileUrl: "https://cdn/a.pdf" }, { id: 22, fileUrl: PLACEHOLDER_PDF_URL }],
      [
        { title: "Placeholder", fileUrl: PLACEHOLDER_PDF_URL },
        { id: 999, title: "Foreign", fileUrl: "https://cdn/x.pdf" },
        { title: "A", fileUrl: "https://cdn/a.pdf" },
      ]
    );
    expect(plan.updates.map((u) => [u.id, u.orderIndex])).toEqual([[21, 1]]);
    expect(plan.inserts.map((i) => i.file.fileUrl)).toEqual(["https://cdn/x.pdf"]);
    expect(plan.deleteIds).toEqual([22]);
  });
});

describe("syncProductFiles", () => {
  it("keeps the ids of unchanged files across a save, inside one transaction", async () => {
    const { db, statements, tx } = fakeDb([row(31, "https://cdn/a.pdf", "One"), row(32, "https://cdn/b.pdf", "Two")]);
    await db.transaction().execute((trx) =>
      syncProductFiles(trx, 1, [
        { id: 31, title: "One", fileUrl: "https://cdn/a.pdf" },
        { id: 32, title: "Two, renamed", fileUrl: "https://cdn/b.pdf" },
      ])
    );
    const writes = statements.filter((s) => !s.sql.startsWith("select"));
    expect(writes.every((s) => s.sql.startsWith("update"))).toBe(true);
    expect(writes.length).toBe(2);
    expect(writes.some((s) => s.sql.startsWith("delete"))).toBe(false);
    expect(tx).toEqual({ begun: 1, committed: 1, rolledBack: 0 });
  });

  it("refuses to replace real files with nothing and writes nothing", async () => {
    const { db, statements, tx } = fakeDb([row(41, "https://cdn/a.pdf")]);
    let error: unknown;
    try {
      await db.transaction().execute((trx) => syncProductFiles(trx, 1, [{ title: "x", fileUrl: PLACEHOLDER_PDF_URL }]));
    } catch (e) {
      error = e;
    }
    expect(error instanceof ProductRuleError).toBe(true);
    expect(statements.filter((s) => !s.sql.startsWith("select")).length).toBe(0);
    expect(tx.rolledBack).toBe(1);
  });

  it("rolls the whole save back when an insert fails", async () => {
    const { db, tx } = fakeDb([row(51, "https://cdn/a.pdf")], { failInsert: true });
    let error: unknown;
    try {
      await db.transaction().execute((trx) =>
        syncProductFiles(trx, 1, [
          { id: 51, title: "A", fileUrl: "https://cdn/a.pdf" },
          { title: "B", fileUrl: "https://cdn/b.pdf" },
        ])
      );
    } catch (e) {
      error = e;
    }
    expect(String(error)).toContain("insert failed");
    expect(tx).toEqual({ begun: 1, committed: 0, rolledBack: 1 });
  });
});
