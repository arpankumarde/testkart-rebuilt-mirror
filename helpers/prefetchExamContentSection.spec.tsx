import type { QueryClient } from "@tanstack/query-core";
import { prefetchExamContentSection, examSectionFromUrl } from "./prefetchExamContentSection";

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
  return { result: prefetchExamContentSection(qc, `https://testkart.in${path}`), keys };
};

const published = { exam: { examSlug: "ssc-cgl" }, page: { title: "Syllabus" } };

describe("exam section prefetch", () => {
  it("seeds the page's content and the product counts under the client's keys", async () => {
    const { result, keys } = render("/exams/ssc-cgl/syllabus", { data: published });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys).toEqual([
      ["exam-content", "ssc-cgl", "syllabus"],
      ["exam-products", "counts", "ssc-cgl"],
    ]);
  });

  it("maps the exam-pattern segment to its page type", async () => {
    const { keys } = render("/exams/ssc-cgl/exam-pattern", { data: published });
    await Promise.resolve();
    expect(keys[0]).toEqual(["exam-content", "ssc-cgl", "exam_pattern"]);
  });

  it("uses the custom page type for an admin-added slug", async () => {
    const { result, keys } = render("/exams/ssc-cgl/previous-year-papers/", { data: published });
    expect(await result).toEqual({ maxAge: 300 });
    expect(keys[0]).toEqual(["exam-content", "ssc-cgl", "custom:previous-year-papers"]);
  });

  it("answers an unknown exam with a 404", async () => {
    const { result } = render("/exams/no-such-exam/syllabus", { data: null });
    expect(await result).toEqual({ statusCode: 404, maxAge: 300 });
  });

  it("redirects an unpublished section to the hub", async () => {
    const { result } = render("/exams/ssc-cgl/cutoff", { data: { ...published, page: null } });
    expect(await result).toEqual({ redirect: { to: "/exams/ssc-cgl", permanent: false } });
  });

  it("redirects a malformed custom slug to the hub without a query", async () => {
    const { result, keys } = render("/exams/ssc-cgl/Bad_Slug", { data: published });
    expect(await result).toEqual({ redirect: { to: "/exams/ssc-cgl", permanent: false } });
    expect(keys).toEqual([]);
  });

  it("does not cache the page when the lookup fails", async () => {
    const { result } = render("/exams/ssc-cgl/syllabus", { error: new Error("connect ECONNREFUSED") });
    expect(await result).toEqual({ maxAge: 0 });
  });

  it("reads nothing from a path outside /exams/:examSlug/:segment", () => {
    expect(examSectionFromUrl("https://testkart.in/exams/ssc-cgl")).toBeNull();
  });
});
