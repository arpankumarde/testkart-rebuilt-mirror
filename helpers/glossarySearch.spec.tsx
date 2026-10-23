import { glossarySearch } from "./glossarySearch";

const terms = [
  { term: "Achievement test", definition: "Measures what has been learned." },
  { term: "Computer-based test", definition: "An exam taken on a computer." },
  { term: "Mock test", definition: "A practice exam under real conditions." },
  { term: "Test series", definition: "A planned set of mock tests." },
];

const names = (query: string) => glossarySearch.find(terms, query).map((t) => t.term);

describe("glossarySearch", () => {
  it("finds nothing for a blank query", () => {
    expect(names("   ")).toEqual([]);
  });

  it("searches names and definitions, ignoring case", () => {
    expect(names("PRACTICE")).toEqual(["Mock test"]);
    expect(names("zebra")).toEqual([]);
  });

  it("puts name matches before definition matches", () => {
    expect(names("mock")).toEqual(["Mock test", "Test series"]);
    expect(names("test")).toEqual(["Test series", "Achievement test", "Computer-based test", "Mock test"]);
  });

  it("treats spaces and hyphens alike", () => {
    expect(names("computer based")).toEqual(["Computer-based test"]);
    expect(names("computer-based")).toEqual(["Computer-based test"]);
  });

  it("takes special characters literally", () => {
    expect(names("(")).toEqual([]);
    expect(names("c++")).toEqual([]);
  });

  it("matches a single letter only at the start of a word", () => {
    expect(names("m")).toEqual(["Mock test", "Achievement test", "Test series"]);
    expect(glossarySearch.highlight("Mock team", "m")).toEqual([
      { text: "M", match: true },
      { text: "ock team", match: false },
    ]);
  });

  it("marks every match in the text", () => {
    expect(glossarySearch.highlight("Mock test mock", "mock")).toEqual([
      { text: "Mock", match: true },
      { text: " test ", match: false },
      { text: "mock", match: true },
    ]);
    expect(glossarySearch.highlight("Computer-based test", "computer based")).toEqual([
      { text: "Computer-based", match: true },
      { text: " test", match: false },
    ]);
  });

  it("leaves the text alone for a blank query", () => {
    expect(glossarySearch.highlight("Mock test", " ")).toEqual([{ text: "Mock test", match: false }]);
  });
});