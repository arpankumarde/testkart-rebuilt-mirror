import type { LucideIcon } from "lucide-react";
import { Newspaper, BookOpen, FileSearch, Layout, Briefcase, Mail } from "lucide-react";
import type { ArticleSurface, ContentSurface } from "../endpoints/admin/content/dashboard_GET.schema";

/** The ?tab= value on /admin/blog for each article type. */
export const ARTICLE_TABS = {
  blog: "blog",
  knowledge_base: "help",
} as const satisfies Record<ArticleSurface, string>;

export const SURFACE_LABELS: Record<ContentSurface, string> = {
  blog: "Blog posts",
  knowledge_base: "Help pages",
  exam_page: "Exam pages",
  static_page: "Static pages",
  career: "Careers",
  email_template: "Email templates",
};

export const SURFACE_SINGULAR: Record<ContentSurface, string> = {
  blog: "Blog post",
  knowledge_base: "Guide",
  exam_page: "Exam page",
  static_page: "Static page",
  career: "Role",
  email_template: "Email template",
};

export const SURFACE_COLORS: Record<ContentSurface, string> = {
  blog: "var(--chart-color-1)",
  knowledge_base: "var(--chart-color-2)",
  exam_page: "var(--chart-color-5)",
  static_page: "var(--chart-color-3)",
  career: "var(--chart-color-4)",
  email_template: "var(--muted-foreground)",
};

export const SURFACE_HREFS: Record<ContentSurface, string> = {
  blog: `/admin/blog?tab=${ARTICLE_TABS.blog}`,
  knowledge_base: `/admin/blog?tab=${ARTICLE_TABS.knowledge_base}`,
  exam_page: "/admin/exam-content",
  static_page: "/admin/static-pages",
  career: "/admin/careers",
  email_template: "/admin/email-templates",
};

/** The editor for one blog post or help page (pages/admin.blog.e.$id.tsx). */
export const articleEditorHref = (id: number) => `/admin/blog/e/${id}`;

export const SURFACE_ICONS: Record<ContentSurface, LucideIcon> = {
  blog: Newspaper,
  knowledge_base: BookOpen,
  exam_page: FileSearch,
  static_page: Layout,
  career: Briefcase,
  email_template: Mail,
};

/** What the unpublished bucket is actually called on each surface. */
export const SURFACE_DRAFT_LABELS: Record<ContentSurface, string> = {
  blog: "draft",
  knowledge_base: "draft",
  exam_page: "unpublished",
  static_page: "draft",
  career: "closed",
  email_template: "inactive",
};

/** Surfaces that are always live once they exist have no meaningful live count. */
export const SURFACE_PUBLISH_LABELS: Record<ContentSurface, string> = {
  blog: "published",
  knowledge_base: "published",
  exam_page: "published",
  static_page: "live",
  career: "open",
  email_template: "active",
};

/** "exam_pattern" to "Exam pattern". */
export const humanisePageType = (pageType: string): string => {
  const spaced = pageType.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
