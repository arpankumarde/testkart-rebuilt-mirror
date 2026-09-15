import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, GraduationCap, Package } from "lucide-react";
import { useExamProductCountsQuery } from "../helpers/useExamProductCounts";
import {
  EXAM_CONTENT_PAGE_META,
  EXAM_CONTENT_PAGE_TYPES,
  type ExamContentPageType,
} from "../helpers/examContentTypes";
import type { ExamProductCounts } from "../endpoints/exam-products/counts_GET.schema";
import styles from "./ExamPageNav.module.css";

type NavLink = {
  slug: string | null;
  label: string;
  icon?: React.ReactNode;
};

// A product listing page redirects to the hub when the exam has no items of
// that type, so its pill only appears when the count is above zero.
const PRODUCT_LINKS: (NavLink & { countKey: keyof ExamProductCounts })[] = [
  { slug: "mock-tests", label: "Mock Tests", countKey: "mockTests", icon: <FileText size={14} /> },
  { slug: "courses", label: "Courses", countKey: "courses", icon: <GraduationCap size={14} /> },
  { slug: "study-notes", label: "Study Notes", countKey: "digitalProducts", icon: <BookOpen size={14} /> },
  { slug: "bundles", label: "Bundles", countKey: "bundles", icon: <Package size={14} /> },
];

interface ExamPageNavProps {
  examSlug: string;
  // URL segment of the page being shown ("syllabus", "mock-tests"); null on the hub.
  currentSlug: string | null;
  publishedPageTypes: ExamContentPageType[];
  className?: string;
}

export const ExamPageNav: React.FC<ExamPageNavProps> = ({
  examSlug,
  currentSlug,
  publishedPageTypes,
  className,
}) => {
  const { data: countsData } = useExamProductCountsQuery(examSlug);
  const hubUrl = `/exams/${examSlug}`;

  const links: NavLink[] = [
    { slug: null, label: "Overview" },
    ...EXAM_CONTENT_PAGE_TYPES.filter((type) => publishedPageTypes.includes(type)).map((type) => ({
      slug: EXAM_CONTENT_PAGE_META[type].slug,
      label: EXAM_CONTENT_PAGE_META[type].label,
    })),
    ...PRODUCT_LINKS.filter((link) => (countsData?.counts[link.countKey] ?? 0) > 0),
  ];

  if (links.length < 2) return null;

  return (
    <nav className={`${styles.nav} ${className ?? ""}`} aria-label="Exam pages">
      {links.map((link) => {
        const isCurrent = link.slug === currentSlug;
        return (
          <Link
            key={link.slug ?? "overview"}
            to={link.slug ? `${hubUrl}/${link.slug}` : hubUrl}
            className={`${styles.link} ${isCurrent ? styles.current : ""}`}
            aria-current={isCurrent ? "page" : undefined}
          >
            {link.icon}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};