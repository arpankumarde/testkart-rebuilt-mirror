import { defineScreens, pending } from "@floot/examples";
import type { OutputType as DetailOutput } from "../endpoints/admin/glossary/get_GET.schema";

const session = {
  admin: { id: 1, email: "editor@testkart.in", fullName: "Content Editor", role: "admin", permissions: ["content", "blog", "glossary"] },
};

const stamp = new Date("2026-11-01T09:30:00Z");

const term: DetailOutput = {
  term: {
    id: 1,
    term: "Mock test",
    slug: "mock-test",
    category: "test_types",
    definition: "A practice exam taken under real exam conditions.",
    explanationHeading: "What is a mock test?",
    explanationFirst: "<p>A mock test copies the format, timing and marking of a real exam.</p>",
    explanationSecond: "<p>Students use it to find weak topics and to practise time management.</p>",
    extraHeading: "Full form and other languages",
    extraBody: "<p>Mock means practice. In Hindi it is often called an abhyas pariksha.</p>",
    productText: "Create a mock test and sell it to your students on Testkart.",
    productUrl: "/sell/mock-test",
    productLabel: "Sell your mock tests",
    relatedTermIds: [2, 3, 4],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    status: "published",
    relatedTerms: [
      { id: 2, term: "Test series", slug: "test-series", category: "test_types", definition: "A set of tests taken over time.", status: "published" },
      { id: 3, term: "Negative marking", slug: "negative-marking", category: "scoring_and_assessment", definition: "Marks taken away for a wrong answer.", status: "published" },
      { id: 4, term: "Computer-based test", slug: "computer-based-test", category: "delivery_and_creation", definition: "An exam taken on a computer.", status: "draft" },
    ],
    usedByCount: 2,
    previousSlugs: [],
    publishedAt: stamp,
    firstPublishedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    createdByName: "Content Editor",
    updatedByName: "Content Editor",
  },
};

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
    "admin/glossary/slug-check_GET": { slug: "mock-test", available: true, usedBy: null },
  },
  screens: [
    { title: "New term", route: "/admin/glossary/e/new" },
    { title: "Published term", route: "/admin/glossary/e/1", backend: { "admin/glossary/get_GET": term } },
  ],
});