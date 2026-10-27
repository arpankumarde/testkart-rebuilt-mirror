import type { QueryClient } from "@tanstack/query-core";
import type { PageServerContext } from "@floot/prefetch";

type Outcome = { data: unknown } | { error: Error };
/* One outcome for every query, or one per query by its second key part ("details", "list", "sidebar"). */
type Outcomes = Outcome | Record<string, Outcome>;

// Stands in for the SSR QueryClient without running queryFn (which needs the database).
// prefetchQuery never rejects, as in @tanstack/query-core.
const fakeQc = (outcomes: Outcomes) => {
  const keys: unknown[] = [];
  const run = async (options: { queryKey: readonly unknown[] }) => {
    keys.push(options.queryKey);
    const outcome: Outcome =
      "data" in outcomes || "error" in outcomes ? (outcomes as Outcome) : ((outcomes as Record<string, Outcome>)[String(options.queryKey[1])] ?? { data: undefined });
    if ("error" in outcome) throw outcome.error;
    return outcome.data;
  };
  const qc = {
    fetchQuery: run,
    prefetchQuery: (options: { queryKey: readonly unknown[] }) => run(options).then(
      () => undefined,
      () => undefined,
    ),
  } as unknown as QueryClient;
  return { qc, keys };
};

const list = (overrides: Record<string, unknown> = {}) => ({
  data: { rows: [], total: 30, totalPages: 3, page: 1, exam: null, ...overrides },
});

describe("exam news prefetch", () => {
  let prefetch: typeof import("./examNewsPrefetch");

  beforeAll(async () => {
    // examNewsServer reads the admin session helpers, which need a secret at load.
    process.env.JWT_SECRET = process.env.JWT_SECRET || "spec-only-secret";
    prefetch = await import("./examNewsPrefetch");
  });

  const listing = (path: string, outcomes: Outcomes = list()) => {
    const { qc, keys } = fakeQc(outcomes);
    const ctx = { qc, url: `https://testkart.in${path}` } as unknown as PageServerContext;
    return { result: prefetch.prefetchExamNewsListing(ctx), keys };
  };

  const story = (path: string, outcomes: Outcomes) => {
    const { qc, keys } = fakeQc(outcomes);
    const ctx = { qc, url: `https://testkart.in${path}` } as unknown as PageServerContext;
    return { result: prefetch.prefetchExamNewsStory(ctx), keys };
  };

  it("seeds the hub list and sidebar under the client's keys", async () => {
    const { result, keys } = listing("/exam-news");
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["exam-news", "list", { page: 1 }], ["exam-news", "sidebar"]]);
  });

  it("maps a type segment and a page number", async () => {
    const { result, keys } = listing("/exam-news/type/admit-card/page/2");
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys[0]).toEqual(["exam-news", "list", { page: 2, type: "admit_card" }]);
  });

  it("keeps a search in the key", async () => {
    const { result, keys } = listing("/exam-news/page/2?q=result");
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys[0]).toEqual(["exam-news", "list", { page: 2, q: "result" }]);
  });

  it("301s an untidy URL to the clean one", async () => {
    expect(await listing("/Exam-News//Type/Result/").result).toEqual({
      redirect: { to: "/exam-news/type/result", permanent: true },
    });
  });

  it("301s /page/1 to the listing itself", async () => {
    expect(await listing("/exam-news/page/1").result).toEqual({ redirect: { to: "/exam-news", permanent: true } });
    expect(await listing("/exam-news/type/result/page/1").result).toEqual({
      redirect: { to: "/exam-news/type/result", permanent: true },
    });
  });

  it("404s an unknown type, a bad page number and a page past the end", async () => {
    expect(await listing("/exam-news/type/admitcard").result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(await listing("/exam-news/page/abc").result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(await listing("/exam-news/page/0").result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(await listing("/exam-news/page/9").result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(await listing("/exam-news/type/page/2").result).toEqual({ statusCode: 404, maxAge: 300 });
  });

  it("serves a story under its key", async () => {
    const { result, keys } = story("/exam-news/neet-ug-result", { data: { canonicalPath: "/exam-news/neet-ug-result" } });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["exam-news", "details", "neet-ug-result"]]);
  });

  it("301s a renamed story straight to its current URL", async () => {
    expect(await story("/exam-news/old-slug", { data: { canonicalPath: "/exam-news/new-slug" } }).result).toEqual({
      redirect: { to: "/exam-news/new-slug", permanent: true },
    });
  });

  it("404s a slug that is not a story, even an exam's slug, and the reserved segments", async () => {
    const { result, keys } = story("/exam-news/neet-ug", { details: { data: null } });
    expect(await result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(keys).toEqual([["exam-news", "details", "neet-ug"]]);
    expect(await story("/exam-news/exam", { data: {} }).result).toEqual({ statusCode: 404, maxAge: 300 });
  });

  it("does not cache a failed story lookup", async () => {
    expect(await story("/exam-news/neet-ug", { error: new Error("connection reset") }).result).toEqual({ maxAge: 0 });
  });
});
