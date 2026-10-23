import type { QueryClient } from "@tanstack/query-core";
import type { PageServerContext } from "@floot/prefetch";

type Outcome = { data: unknown } | { error: Error };

// Stands in for the SSR QueryClient without running queryFn (which needs the database).
const fakeQc = (outcome: Outcome) => {
  const keys: unknown[] = [];
  const qc = {
    fetchQuery: async (options: { queryKey: unknown }) => {
      keys.push(options.queryKey);
      if ("error" in outcome) throw outcome.error;
      return outcome.data;
    },
  } as unknown as QueryClient;
  return { qc, keys };
};

const context = (qc: QueryClient, path: string) => ({ qc, url: `https://testkart.in${path}` }) as unknown as PageServerContext;

describe("glossary prefetch", () => {
  let prefetch: typeof import("./glossaryPrefetch");

  beforeAll(async () => {
    prefetch = await import("./glossaryPrefetch");
  });

  const hub = (path: string, outcome: Outcome = { data: { terms: [] } }) => {
    const { qc, keys } = fakeQc(outcome);
    return { result: prefetch.prefetchGlossaryHub(context(qc, path)), keys };
  };

  const term = (path: string, outcome: Outcome) => {
    const { qc, keys } = fakeQc(outcome);
    return { result: prefetch.prefetchGlossaryTerm(context(qc, path)), keys };
  };

  it("seeds the hub under the client's key", async () => {
    const { result, keys } = hub("/glossary");
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["glossary", "list"]]);
  });

  it("seeds a term under the client's key", async () => {
    const { result, keys } = term("/glossary/mock-test", { data: { canonicalPath: "/glossary/mock-test" } });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["glossary", "details", "mock-test"]]);
  });

  it("sends untidy URLs to the clean one", async () => {
    expect(await hub("/Glossary/").result).toEqual({ redirect: { to: "/glossary", permanent: true } });
    expect(await term("/Glossary/Mock-Test/", { data: {} }).result).toEqual({
      redirect: { to: "/glossary/mock-test", permanent: true },
    });
  });

  it("sends a renamed term's old URL to its current one", async () => {
    expect(await term("/glossary/old-slug", { data: { canonicalPath: "/glossary/new-slug" } }).result).toEqual({
      redirect: { to: "/glossary/new-slug", permanent: true },
    });
  });

  it("answers 404 for an invalid slug, including a draft or unpublished term", async () => {
    expect(await term("/glossary/gone", { error: new Error("Term not found") }).result).toEqual({ statusCode: 404, maxAge: 300 });
  });

  it("does not cache a failed load", async () => {
    expect(await hub("/glossary", { error: new Error("connection lost") }).result).toEqual({ maxAge: 0 });
    expect(await term("/glossary/mock-test", { error: new Error("connection lost") }).result).toEqual({ maxAge: 0 });
  });
});