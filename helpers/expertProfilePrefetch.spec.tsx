import type { QueryClient } from "@tanstack/query-core";
import { prefetch } from "../pages/expert.$teacherSlug.prefetch";
import { TeacherNotFoundError } from "./fetchTeacherProfileServer";

type Outcome = { data: unknown } | { error: Error };

// Stands in for the SSR QueryClient without running queryFn (which needs the database).
// prefetchQuery never rejects, as in @tanstack/query-core.
const fakeQc = (outcome: Outcome) => {
  const keys: unknown[] = [];
  const run = async (options: { queryKey: unknown }) => {
    keys.push(options.queryKey);
    if ("error" in outcome) throw outcome.error;
    return outcome.data;
  };
  const qc = {
    fetchQuery: run,
    prefetchQuery: (options: { queryKey: unknown }) => run(options).then(
      () => undefined,
      () => undefined,
    ),
  } as unknown as QueryClient;
  return { qc, keys };
};

const render = (path: string, outcome: Outcome) => {
  const { qc, keys } = fakeQc(outcome);
  const result = prefetch({
    url: `https://testkart.in${path}`,
    getRequest: () => {
      throw new Error("reading the request makes the page uncacheable");
    },
    qc,
  });
  return { result, keys };
};

describe("expert profile prefetch", () => {
  it("serves a known teacher with a 5-minute cache under the client's query key", async () => {
    const { result, keys } = render("/expert/dr-sharma", { data: {} });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["teacherProfile", "dr-sharma"]]);
  });

  it("answers an unknown slug with a 404", async () => {
    const { result } = render("/expert/zz-no-such-teacher", { error: new TeacherNotFoundError() });
    expect(await result).toEqual({ statusCode: 404, maxAge: 300 });
  });

  it("does not cache the page when the lookup fails for any other reason", async () => {
    const { result } = render("/expert/dr-sharma", { error: new Error("connect ECONNREFUSED") });
    expect(await result).toEqual({ maxAge: 0 });
  });

  it("still finds the slug behind a trailing slash", async () => {
    const { result, keys } = render("/expert/dr-sharma/", { data: {} });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([["teacherProfile", "dr-sharma"]]);
  });

  it("answers a path with no slug with a 404 and no query", async () => {
    const { result, keys } = render("/expert/", { data: {} });
    expect(await result).toEqual({ statusCode: 404, maxAge: 300 });
    expect(keys).toEqual([]);
  });
});
