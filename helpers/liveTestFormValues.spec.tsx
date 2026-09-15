import {
  buildLiveTestChanges,
  buildLiveTestEditValues,
  findLiveTestIssues,
  normalizeLiveTestFormValues,
  parseStoredStringList,
} from "./liveTestFormValues";
import { getTotalPrizePool, parseStoredPrizeTiers, resolveLiveTestPrizeTiers } from "./liveTestPrizeTiers";
import type { LiveTestFormValues } from "./liveTestCreationFormSchema";

const DAY = 24 * 60 * 60 * 1000;
const STRING_TIERS = '[{"rankFrom":1,"rankTo":1,"amountPerRank":500},{"rankFrom":2,"rankTo":5,"amountPerRank":100}]';

const details = (overrides: Record<string, unknown> = {}): any => ({
  id: 75010,
  mockTestId: 75020,
  teacherId: 75001,
  title: "Mock A",
  description: "<p>A valid description</p>",
  price: "0.00",
  discountPrice: null,
  isFree: true,
  startTime: null,
  endTime: new Date(Date.now() + 3 * DAY),
  registrationDeadline: null,
  maxSeats: 100,
  thumbnailUrl: "https://cdn.example.invalid/thumb.png",
  thumbnailFileId: "file-1",
  introVideoUrl: null,
  introVideoFileId: null,
  hasPrizes: true,
  prizeTiers: STRING_TIERS,
  totalPrizePool: "900.00",
  firstPrize: "500.00",
  secondPrize: "100.00",
  thirdPrize: "100.00",
  isActive: false,
  mockTest: { examName: "SSC CGL", language: "Hindi", whatYouLearn: '["Point one"]', requirements: null },
  mockTestItem: { durationMinutes: 60, calculatorEnabled: false, subjectWiseTiming: false, questionWiseTiming: false },
  subjects: [],
  ...overrides,
});

const edit = (base: LiveTestFormValues, patch: Partial<LiveTestFormValues>): LiveTestFormValues => ({ ...base, ...patch });

describe("stored value parsing", () => {
  it("reads prize tiers stored as an array or as a JSON string", () => {
    const expected = [
      { rankFrom: 1, rankTo: 1, amountPerRank: 500 },
      { rankFrom: 2, rankTo: 5, amountPerRank: 100 },
    ];
    expect(parseStoredPrizeTiers(STRING_TIERS)).toEqual(expected);
    expect(parseStoredPrizeTiers(JSON.stringify(STRING_TIERS))).toEqual(expected);
    expect(parseStoredPrizeTiers(expected)).toEqual(expected);
    expect(parseStoredPrizeTiers("not json")).toEqual([]);
    expect(parseStoredPrizeTiers(null)).toEqual([]);
  });

  it("uses the legacy 1st/2nd/3rd columns only when no tier list is stored", () => {
    expect(resolveLiveTestPrizeTiers(null, "300.00", "100.00", "0")).toEqual([
      { rankFrom: 1, rankTo: 1, amountPerRank: 300 },
      { rankFrom: 2, rankTo: 2, amountPerRank: 100 },
    ]);
    expect(getTotalPrizePool(resolveLiveTestPrizeTiers(STRING_TIERS, "500", "100", "100"))).toBe(900);
  });

  it("reads storefront lists stored as JSON strings", () => {
    expect(parseStoredStringList('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStoredStringList(["a"])).toEqual(["a"]);
    expect(parseStoredStringList(null)).toEqual([]);
  });
});

describe("buildLiveTestEditValues", () => {
  it("keeps ranged tiers, the storefront list and the language of the stored test", () => {
    const values = buildLiveTestEditValues(details());
    expect(values.prizeTiers).toEqual([
      { rankFrom: 1, rankTo: 1, amountPerRank: 500 },
      { rankFrom: 2, rankTo: 5, amountPerRank: 100 },
    ]);
    expect(getTotalPrizePool(values.prizeTiers)).toBe(900);
    expect(values.whatYouLearn).toEqual(["Point one"]);
    expect(values.language).toBe("Hindi");
  });
});

describe("buildLiveTestChanges", () => {
  const saved = buildLiveTestEditValues(details());

  it("sends nothing when nothing changed", () => {
    expect(buildLiveTestChanges(saved, { ...saved }, false)).toEqual({});
  });

  it("sends only the title for a title-only edit, so exam and language are left alone", () => {
    expect(buildLiveTestChanges(saved, edit(saved, { title: "Mock B" }), false)).toEqual({ title: "Mock B" });
  });

  it("sends a language change, and null when it is cleared", () => {
    expect(buildLiveTestChanges(saved, edit(saved, { language: "English" }), false)).toEqual({ language: "English" });
    expect(buildLiveTestChanges(saved, edit(saved, { language: undefined }), false)).toEqual({ language: null });
  });

  it("drops locked fields of a published test", () => {
    const current = edit(saved, {
      title: "Mock B",
      examName: "UPSC",
      price: 99,
      isFree: false,
      endTime: new Date(Date.now() + 9 * DAY),
      maxSeats: 5,
    });
    expect(buildLiveTestChanges(saved, current, true)).toEqual({ title: "Mock B" });
  });

  it("sends the whole schedule group when one member changes", () => {
    const endTime = new Date(Date.now() + 9 * DAY);
    expect(buildLiveTestChanges(saved, edit(saved, { endTime }), false)).toEqual({
      registrationDeadline: null,
      startTime: null,
      endTime,
    });
  });

  it("clears tiers when prizes are switched off on a draft", () => {
    expect(buildLiveTestChanges(saved, edit(saved, { hasPrizes: false }), false)).toEqual({
      hasPrizes: false,
      prizeTiers: [],
    });
  });

  it("treats a removed thumbnail, reported as '' or null, as null url and file id", () => {
    const expected = { thumbnailUrl: null, thumbnailFileId: null };
    expect(buildLiveTestChanges(saved, edit(saved, { thumbnailUrl: "", thumbnailFileId: "file-1" }), false)).toEqual(expected);
    expect(buildLiveTestChanges(saved, edit(saved, { thumbnailUrl: null, thumbnailFileId: null }), false)).toEqual(expected);
  });

  it("does not count an emptied editor as a change from an empty description", () => {
    const empty = edit(saved, { description: null });
    expect(buildLiveTestChanges(empty, edit(empty, { description: "<p></p>" }), false)).toEqual({});
  });
});

describe("findLiveTestIssues", () => {
  const valid = buildLiveTestEditValues(details());

  it("accepts an emptied description and a removed thumbnail", () => {
    expect(findLiveTestIssues(edit(valid, { description: "<p></p>", thumbnailUrl: "", thumbnailFileId: null }))).toEqual([]);
    expect(normalizeLiveTestFormValues(edit(valid, { description: "<p> &nbsp; </p>" })).description).toBeNull();
  });

  it("lists issues in page order with the step that holds them", () => {
    const broken = edit(valid, {
      subjectWiseTiming: false,
      durationMinutes: 0,
      prizeTiers: [
        { rankFrom: 1, rankTo: 3, amountPerRank: 100 },
        { rankFrom: 2, rankTo: 4, amountPerRank: 50 },
      ],
    });
    const issues = findLiveTestIssues(broken);
    expect(issues.map((issue) => [issue.field, issue.step])).toEqual([
      ["durationMinutes", "info"],
      ["prizeTiers", "prizes"],
    ]);
    expect(issues[0].message).toBe("Duration must be at least 1 minute.");
    expect(issues[1].message).toBe("Prize ranks: Rank ranges cannot overlap.");
  });

  it("flags storefront fields so the form can open that section", () => {
    const [issue] = findLiveTestIssues(edit(valid, { thumbnailUrl: "not a url" }));
    expect(issue.field).toBe("thumbnailUrl");
    expect(issue.storefront).toBe(true);
  });

  it("ignores locked fields of a published test", () => {
    const broken = edit(valid, { durationMinutes: 0, title: "ab" });
    expect(findLiveTestIssues(broken, { isPublished: true }).map((issue) => issue.field)).toEqual(["title"]);
  });

  it("can be limited to one step", () => {
    const broken = edit(valid, { title: "ab", endTime: new Date(Date.now() + DAY), startTime: new Date(Date.now() + 2 * DAY) });
    expect(findLiveTestIssues(broken, { steps: ["schedule"] }).map((issue) => issue.field)).toEqual(["startTime"]);
  });
});