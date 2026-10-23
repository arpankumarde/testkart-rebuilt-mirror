import { validateGlossaryTerm } from "./glossaryValidation";
import { glossaryMeta } from "./glossaryMeta";
import type { InputType } from "../endpoints/admin/glossary/save_POST.schema";

const draft: InputType = {
  term: "Mock test",
  slug: "mock-test",
  category: "test_types",
  definition: "A practice exam taken under real conditions.",
  explanationHeading: "",
  explanationFirst: "",
  explanationSecond: "",
  extraHeading: "",
  extraBody: "",
  productText: "",
  productUrl: "",
  productLabel: "",
  relatedTermIds: [],
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  status: "draft",
};

const ready: InputType = {
  ...draft,
  explanationFirst: "<p>First.</p>",
  explanationSecond: "<p>Second.</p>",
  productText: "Build one on Testkart.",
  productUrl: "/sell/mock-test",
  productLabel: "Sell your mock tests",
  relatedTermIds: [1, 2, 3],
  status: "published",
};

const paths = (input: InputType) => validateGlossaryTerm(input).map((issue) => issue.path);

describe("validateGlossaryTerm", () => {
  it("lets a draft save with only the term, category and definition", () => {
    expect(paths(draft)).toEqual([]);
  });

  it("requires the term, category and definition even on a draft", () => {
    expect(paths({ ...draft, term: " ", category: null, definition: "" })).toEqual(["term", "category", "definition"]);
  });

  it("accepts a complete term for publishing", () => {
    expect(paths(ready)).toEqual([]);
  });

  it("counts empty rich text as missing when publishing", () => {
    expect(paths({ ...ready, explanationFirst: "<p>&nbsp;</p>", explanationSecond: "<p></p>" })).toEqual([
      "explanationFirst",
      "explanationSecond",
    ]);
  });

  it("needs exactly three related terms to publish, but not to save a draft", () => {
    expect(paths({ ...ready, relatedTermIds: [1, 2] })).toEqual(["relatedTermIds"]);
    expect(paths({ ...draft, relatedTermIds: [1, 2] })).toEqual([]);
  });

  it("refuses a repeated related term and the term itself", () => {
    expect(paths({ ...draft, relatedTermIds: [1, 1] })).toEqual(["relatedTermIds"]);
    expect(paths({ ...draft, id: 7, relatedTermIds: [7, 1] })).toEqual(["relatedTermIds"]);
  });

  it("only accepts internal product links", () => {
    expect(paths({ ...draft, productUrl: "https://example.com" })).toEqual(["productUrl"]);
    expect(paths({ ...draft, productUrl: "//example.com" })).toEqual(["productUrl"]);
    expect(paths({ ...draft, productUrl: "/\\example.com" })).toEqual(["productUrl"]);
    expect(paths({ ...draft, productUrl: "/sell/mock-test" })).toEqual([]);
  });

  it("only accepts a canonical URL on testkart.in", () => {
    expect(paths({ ...draft, canonicalUrl: "https://example.com/x" })).toEqual(["canonicalUrl"]);
    expect(paths({ ...draft, canonicalUrl: "https://testkart.in/glossary/mock-exam" })).toEqual([]);
  });

  it("needs the extra section to have both a heading and text", () => {
    expect(paths({ ...ready, extraHeading: "Full form" })).toEqual(["extraBody"]);
    expect(paths({ ...ready, extraBody: "<p>Text</p>" })).toEqual(["extraHeading"]);
  });
});

describe("glossaryMeta", () => {
  it("groups terms by first letter, with anything else under #", () => {
    expect(glossaryMeta.letterOf("mock test")).toBe("M");
    expect(glossaryMeta.letterOf("360-degree feedback")).toBe("#");
  });

  it("falls back to generated SEO text and the term's own canonical", () => {
    expect(glossaryMeta.metaTitle("Mock test", "")).toBe("Mock test: meaning and definition");
    expect(glossaryMeta.metaDescription("Definition.", " ")).toBe("Definition.");
    expect(glossaryMeta.canonicalPath(null, "mock-test")).toBe("/glossary/mock-test");
    expect(glossaryMeta.canonicalPath("https://example.com/x", "mock-test")).toBe("/glossary/mock-test");
    expect(glossaryMeta.canonicalPath("https://testkart.in/glossary/other", "mock-test")).toBe("/glossary/other");
  });

  it("builds BreadcrumbList data in the wireframe's shape", () => {
    const parsed = JSON.parse(
      glossaryMeta.breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Glossary", path: "/glossary" },
        { name: "Mock test", path: "/glossary/mock-test" },
      ])
    );
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Mock test",
      item: "https://testkart.in/glossary/mock-test",
    });
  });
});