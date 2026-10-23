import { defineScreens, httpError, pending } from "@floot/examples";
import type { OutputType as ListOutput } from "../endpoints/admin/glossary/list_GET.schema";

const session = {
  admin: { id: 1, email: "editor@testkart.in", fullName: "Content Editor", role: "admin", permissions: ["content", "blog", "glossary"] },
};

const updatedAt = new Date("2026-11-01T09:30:00Z");

const loaded: ListOutput = {
  rows: [
    { id: 1, term: "Mock test", slug: "mock-test", category: "test_types", definition: "A practice exam taken under real conditions.", status: "published", updatedAt, liveRelatedCount: 3, usedByCount: 2 },
    { id: 2, term: "Negative marking", slug: "negative-marking", category: "scoring_and_assessment", definition: "Marks taken away for a wrong answer.", status: "published", updatedAt, liveRelatedCount: 2, usedByCount: 1 },
    { id: 3, term: "OMR sheet", slug: "omr-sheet", category: "delivery_and_creation", definition: "An answer sheet read by a machine.", status: "draft", updatedAt, liveRelatedCount: 1, usedByCount: 0 },
  ],
  total: 3,
  totalPages: 1,
  stats: { total: 3, published: 2, draft: 1, recentlyUpdated: 2 },
};

export default defineScreens({
  backend: { "admin/session_GET": session, "admin/dashboard/overview_GET": pending },
  screens: [
    { title: "Loaded", backend: { "admin/glossary/list_GET": loaded } },
    {
      title: "Empty",
      backend: { "admin/glossary/list_GET": { rows: [], total: 0, totalPages: 1, stats: { total: 0, published: 0, draft: 0, recentlyUpdated: 0 } } },
    },
    { title: "Loading", backend: { "admin/glossary/list_GET": pending } },
    { title: "Load failed", backend: { "admin/glossary/list_GET": httpError(500) } },
  ],
});