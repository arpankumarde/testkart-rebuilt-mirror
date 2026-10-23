import { defineScreens, httpError } from "@floot/examples";
import type { OutputType as DetailOutput } from "../endpoints/glossary/details_GET.schema";

const loaded: DetailOutput = {
  term: {
    term: "Mock test",
    slug: "mock-test",
    category: "test_types",
    definition: "A practice exam taken under real exam conditions.",
    explanationHeading: "What is a mock test?",
    explanationFirst: "<p>A mock test copies the format, timing and marking of a real exam, so students meet the paper before the day that counts.</p>",
    explanationSecond: "<p>Students use it to find weak topics and to practise time management. Teachers use the results to decide what to revise.</p>",
    extraHeading: "Full form and other languages",
    extraBody: "<p>Mock means practice. In Hindi it is often called an abhyas pariksha.</p>",
    productText: "Create a mock test and sell it to your students on Testkart.",
    productUrl: "/sell/mock-test",
    productLabel: "Sell your mock tests",
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
  },
  canonicalPath: "/glossary/mock-test",
  related: [
    { term: "Test series", slug: "test-series", category: "test_types", definition: "A set of tests taken over time." },
    { term: "Negative marking", slug: "negative-marking", category: "scoring_and_assessment", definition: "Marks taken away for a wrong answer." },
    { term: "Computer-based test", slug: "computer-based-test", category: "delivery_and_creation", definition: "An exam taken on a computer." },
  ],
};

export default defineScreens({
  screens: [
    { title: "Loaded", route: "/glossary/mock-test", backend: { "glossary/details_GET": loaded } },
    { title: "Load failed", route: "/glossary/mock-test", backend: { "glossary/details_GET": httpError(500) } },
  ],
});