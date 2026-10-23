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
    explanationSecond: "",
    extraHeading: "",
    extraBody: "",
    productText: "",
    productUrl: "",
    productLabel: "",
    relatedTermIds: [2, 4],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    status: "draft",
    relatedTerms: [
      { id: 2, term: "Test series", slug: "test-series", category: "test_types", definition: "A set of tests taken over time.", status: "published" },
      { id: 4, term: "Computer-based test", slug: "computer-based-test", category: "delivery_and_creation", definition: "An exam taken on a computer.", status: "draft" },
    ],
    usedByCount: 0,
    previousSlugs: [],
    publishedAt: null,
    firstPublishedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    createdByName: "Content Editor",
    updatedByName: "Content Editor",
  },
};

export default defineScreens({
  backend: { "admin/session_GET": session, "admin/dashboard/overview_GET": pending },
  screens: [{ title: "Unfinished draft", route: "/admin/glossary/preview/1", backend: { "admin/glossary/get_GET": term } }],
});