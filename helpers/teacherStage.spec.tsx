import type { TeacherOverviewTotals, TeacherStageItem } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { teacherStage, teacherStageSteps } from "./teacherStage";

const zero: TeacherOverviewTotals = {
  students: 0,
  followers: 0,
  publishedTests: 0,
  draftTests: 0,
  publishedCourses: 0,
  draftCourses: 0,
  publishedProducts: 0,
  draftProducts: 0,
  publishedBundles: 0,
  draftBundles: 0,
  activeLiveTests: 0,
  lifetimeEarnings: 0,
  availableBalance: 0,
};

const item: TeacherStageItem = { kind: "mock_test", id: 1, title: "SSC CGL mock", at: new Date(), note: null };

const stageOf = (totals: Partial<TeacherOverviewTotals>, extra: Partial<{ inReview: TeacherStageItem[]; rejected: TeacherStageItem[]; lastDraft: TeacherStageItem | null }> = {}) =>
  teacherStage({
    totals: { ...zero, ...totals },
    inReview: extra.inReview ?? [],
    rejected: extra.rejected ?? [],
    lastDraft: extra.lastDraft ?? null,
  });

describe("teacherStage", () => {
  it("is start when nothing exists", () => {
    expect(stageOf({})).toBe("start");
  });

  it("is drafting with a draft and nothing live or in review", () => {
    expect(stageOf({ draftCourses: 1 })).toBe("drafting");
    expect(stageOf({}, { lastDraft: item })).toBe("drafting");
  });

  it("is review when something waits on review or was sent back, even with drafts", () => {
    expect(stageOf({ draftTests: 2 }, { inReview: [item] })).toBe("review");
    expect(stageOf({}, { rejected: [{ ...item, note: "Add answer keys" }] })).toBe("review");
  });

  it("is live once anything is published and there are no students", () => {
    expect(stageOf({ publishedProducts: 1 }, { inReview: [item] })).toBe("live");
    expect(stageOf({ activeLiveTests: 1 })).toBe("live");
  });

  it("is learners with students and no earnings", () => {
    expect(stageOf({ publishedTests: 1, students: 40 })).toBe("learners");
  });

  it("is selling once anything has been earned", () => {
    expect(stageOf({ publishedTests: 1, students: 3, lifetimeEarnings: 49 })).toBe("selling");
  });

  it("never reaches selling for a manager, whose money the endpoint zeroes", () => {
    expect(stageOf({ publishedTests: 4, students: 120, lifetimeEarnings: 0, availableBalance: 0 })).toBe("learners");
  });
});

describe("teacherStageSteps", () => {
  it("marks each milestone from the same totals", () => {
    const steps = teacherStageSteps({
      totals: { ...zero, publishedTests: 1, students: 2 },
      inReview: [],
      rejected: [],
      lastDraft: null,
    });
    expect(steps.map((step) => step.done)).toEqual([true, true, true, false]);
  });

  it("counts an item in review as created but not live", () => {
    const steps = teacherStageSteps({ totals: zero, inReview: [item], rejected: [], lastDraft: null });
    expect(steps.map((step) => step.done)).toEqual([true, false, false, false]);
  });
});