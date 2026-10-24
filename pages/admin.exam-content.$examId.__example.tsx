import { defineScreens, pending } from "@floot/examples";
import type { ExamContentPageItem, OutputType as ListOutput } from "../endpoints/admin/exam-content/list_GET.schema";
import { ADMIN_EXAM_SECTION_TYPES, serializeExamContent, type ExamSectionPageType } from "../helpers/examContentTypes";

const session = {
  admin: { id: 1, email: "editor@testkart.in", fullName: "Content Editor", role: "admin", permissions: ["exam_content", "content", "blog"] },
};

const blankPage = (pageType: ExamSectionPageType): ExamContentPageItem => ({
  id: null,
  examId: 22,
  pageType,
  status: "draft",
  title: "",
  seoTitle: null,
  seoDescription: null,
  description: null,
  content: null,
  faqItems: null,
  source: "manual",
  aiGeneratedAt: null,
  publishedTitle: null,
  publishedSeoTitle: null,
  publishedSeoDescription: null,
  publishedDescription: null,
  publishedContent: null,
  publishedFaqItems: null,
  publishedAt: null,
  reviewedByAdminId: null,
  reviewedByAdminName: null,
  reviewedAt: null,
  readyForReviewAt: null,
  readyForReviewByAdminId: null,
  readyForReviewByAdminName: null,
  updatedAt: null,
});

const layout = `<style>
.plan {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.plan-card {
  padding: 16px;
  color: #7c2d12;
  background-color: #fff1e6;
  border-radius: 12px;
}
th {
  color: #ffffff;
  background-color: #0f5f6e;
}
@media (max-width: 480px) {
  .plan-card {
    padding: 10px;
  }
}
</style>
<h2>Study plan</h2>
<div class="plan">
  <div class="plan-card"><strong>Week 1</strong><p>Quant basics</p></div>
  <div class="plan-card"><strong>Week 2</strong><p>Reasoning drills</p></div>
  <div class="plan-card" style="position: fixed; top: 0"><strong>Week 3</strong><p>Full mock</p></div>
</div>
<table><thead><tr><th>Paper</th><th>Marks</th></tr></thead><tbody><tr><td>Tier 1</td><td>200</td></tr></tbody></table>
<script>alert("removed")</script>
<button onclick="alert(1)">Inert</button>`;

const htmlPage: ExamContentPageItem = {
  ...blankPage("custom:calculator"),
  id: 501,
  title: "SSC CGL ca",
  content: serializeExamContent("html", layout),
  updatedAt: new Date("2026-11-01T09:30:00Z"),
};

const richPage: ExamContentPageItem = {
  ...blankPage("syllabus"),
  id: 502,
  title: "SSC CGL Syllabus",
  content: "<h2>Tier 1</h2><p>Existing rich text content.</p>",
  updatedAt: new Date("2026-11-01T09:30:00Z"),
};

const list: ListOutput = {
  exam: { id: 22, examName: "SSC CGL", fullName: "SSC CGL", examSlug: "ssc-cgl", categoryName: "SSC" },
  customPages: [{ id: 1, slug: "calculator", label: "ca", pageType: "custom:calculator" }],
  pages: [
    ...ADMIN_EXAM_SECTION_TYPES.map((type) => (type === "syllabus" ? richPage : blankPage(type))),
    htmlPage,
  ],
};

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
    "admin/exam-content/list_GET": list,
    "admin/exam-content/custom-page/update_POST": {
      customPage: { id: 1, slug: "calculator", label: "Current Affairs", pageType: "custom:calculator" },
    },
  },
  screens: [
    { title: "HTML tab", route: "/admin/exam-content/22?section=custom%3Acalculator" },
    { title: "Rich text section", route: "/admin/exam-content/22?section=syllabus" },
  ],
});