import {
  buildMockTestUpdateSet,
  dropBlankEntries,
  isBlankHtml,
  mergeRangeEntries,
  nextFreeTestTitles,
  parseStringList,
  pickFirstIssue,
  splitNewSubjectNames,
} from "./testSeriesEditing";

const now = new Date("2026-09-11T10:00:00Z");

// What update_POST wrote before the fix, kept as a control so the omission
// assertions below are known to fail against the old mapping.
const legacySet = (input: any) => ({
  ...input,
  subject: JSON.stringify(input.subjects || []),
  price: input.price.toString(),
  discountPrice: input.discountPrice !== null && input.discountPrice !== undefined ? input.discountPrice.toString() : null,
  isFree: input.isFree ?? false,
  thumbnailUrl: input.thumbnailUrl || null,
  thumbnailFileId: input.thumbnailFileId || null,
  introVideoUrl: input.introVideoUrl ?? null,
  introVideoFileId: input.introVideoFileId ?? null,
  whatYouLearn: input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null,
  requirements: input.requirements ? JSON.stringify(input.requirements) : null,
  longDescription: input.longDescription || null,
  updatedAt: now,
});

describe("buildMockTestUpdateSet", () => {
  const basicInfoSave = {
    title: "SSC CGL Mocks",
    description: "Ten full-length papers",
    price: 299,
    discountPrice: 199,
    isFree: false,
    thumbnailUrl: "https://cdn.example.invalid/t.png",
    thumbnailFileId: "file-1",
    language: "English",
    whatYouLearn: ["Speed"],
    requirements: null,
    longDescription: "<p>Long</p>",
  };

  it("never writes a column the request left out", () => {
    const set = buildMockTestUpdateSet(basicInfoSave, { now });
    expect("introVideoUrl" in set).toBe(false);
    expect("introVideoFileId" in set).toBe(false);
    expect("subject" in set).toBe(false);
    expect("examId" in set).toBe(false);
    expect("examName" in set).toBe(false);
    expect("slug" in set).toBe(false);

    const control = legacySet(basicInfoSave);
    expect(control.introVideoUrl).toBeNull();
    expect(control.subject).toBe("[]");
  });

  it("writes the fields the basic info form sends", () => {
    const set: Record<string, unknown> = buildMockTestUpdateSet(basicInfoSave, { now });
    expect(set).toEqual({
      title: "SSC CGL Mocks",
      description: "Ten full-length papers",
      price: "299",
      updatedAt: now,
      discountPrice: "199",
      isFree: false,
      thumbnailUrl: "https://cdn.example.invalid/t.png",
      thumbnailFileId: "file-1",
      language: "English",
      whatYouLearn: JSON.stringify(["Speed"]),
      requirements: null,
      longDescription: "<p>Long</p>",
    });
  });

  it("clears a field only when the request clears it explicitly", () => {
    const set = buildMockTestUpdateSet(
      {
        title: "T",
        description: "D",
        price: 0,
        discountPrice: null,
        thumbnailUrl: "",
        introVideoUrl: null,
        introVideoFileId: null,
        subjects: ["Physics"],
        longDescription: "",
      },
      { now, slug: "t-1", exam: { examId: null, examName: null } }
    );
    expect(set.discountPrice).toBeNull();
    expect(set.thumbnailUrl).toBeNull();
    expect(set.introVideoUrl).toBeNull();
    expect(set.introVideoFileId).toBeNull();
    expect(set.subject).toBe(JSON.stringify(["Physics"]));
    expect(set.longDescription).toBeNull();
    expect(set.slug).toBe("t-1");
    expect(set.examId).toBeNull();
    expect("isFree" in set).toBe(false);
  });
});

describe("basic info list helpers", () => {
  it("drops blank rows and trims the rest", () => {
    expect(dropBlankEntries(["  Speed ", "", "   ", "Accuracy"])).toEqual(["Speed", "Accuracy"]);
    expect(dropBlankEntries(["", " "])).toBeNull();
    expect(dropBlankEntries(null)).toBeNull();
  });

  it("reads stored lists in either shape", () => {
    expect(parseStringList('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStringList(["a", 3, "b"])).toEqual(["a", "b"]);
    expect(parseStringList("not json")).toEqual([]);
    expect(parseStringList(null)).toEqual([]);
  });

  it("treats an emptied rich text editor as blank", () => {
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("<p><br></p>")).toBe(true);
    expect(isBlankHtml("")).toBe(true);
    expect(isBlankHtml("<p>Hi</p>")).toBe(false);
  });

  it("names the field that sits highest on the page", () => {
    const order = ["title", "description", "price", "whatYouLearn"];
    const issues = [
      { path: ["whatYouLearn", 2], message: "blank" },
      { path: ["price"], message: "negative" },
      { path: ["unknown"], message: "other" },
    ];
    expect(pickFirstIssue(issues, order)?.message).toBe("negative");
    expect(pickFirstIssue([], order)).toBeNull();
  });
});

describe("nextFreeTestTitles", () => {
  it("counts on from the live items and skips titles already in use", () => {
    expect(nextFreeTestTitles(["Test 1", "Test 2"], 1, 3)).toEqual(["Test 3"]);
    expect(nextFreeTestTitles(["Test 1", "Test 3"], 3, 3)).toEqual(["Test 4", "Test 5", "Test 6"]);
    expect(nextFreeTestTitles(["Mock A", "Test 2"], 2, 2)).toEqual(["Test 3", "Test 4"]);
    expect(nextFreeTestTitles([], 2, 0)).toEqual(["Test 1", "Test 2"]);
  });
});

describe("splitNewSubjectNames", () => {
  it("reports names that already exist instead of dropping them silently", () => {
    expect(splitNewSubjectNames(["Physics", " chemistry ", "Maths", "maths", ""], ["physics"])).toEqual({
      toCreate: ["chemistry", "Maths"],
      skipped: ["Physics", "maths"],
    });
  });
});

describe("mergeRangeEntries", () => {
  it("keeps typed ranges when a rename or new section refetches the list", () => {
    const current = { 1: { fromQ: "1", toQ: "3" }, 2: { fromQ: "", toQ: "" } };
    const derived = { 1: { fromQ: "", toQ: "" }, 2: { fromQ: "", toQ: "" }, 3: { fromQ: "", toQ: "" } };
    expect(mergeRangeEntries(current, derived, new Set([1]))).toEqual({
      1: { fromQ: "1", toQ: "3" },
      2: { fromQ: "", toQ: "" },
      3: { fromQ: "", toQ: "" },
    });
  });

  it("drops rows for deleted sections and takes server values for untouched rows", () => {
    const current = { 1: { fromQ: "1", toQ: "2" }, 2: { fromQ: "3", toQ: "4" } };
    const derived = { 2: { fromQ: "5", toQ: "6" } };
    expect(mergeRangeEntries(current, derived, new Set([1]))).toEqual({ 2: { fromQ: "5", toQ: "6" } });
  });
});
