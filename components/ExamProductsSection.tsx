import React from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, BookOpen, GraduationCap, Package, ArrowRight } from "lucide-react";
import { useTestsQuery } from "../helpers/useTestsQuery";
import { useShopProductsQuery } from "../helpers/useShopQuery";
import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useBundlesQuery } from "../helpers/useBundlesQuery";
import { TeacherProductCard } from "./HomepageContentSection";
import { PublicBundleCard } from "./PublicBundleCard";
import { Placeholder } from "../helpers/placeholderImages";
import { formatItemPrice, itemPriceProps } from "../helpers/homepageItemUtils";
import styles from "./ExamProductsSection.module.css";

// Two full rows of the 3-column preview grid. Keep in sync with
// pages/exams.$examSlug.prefetch.ts so the SSR query keys match.
const PREVIEW_LIMIT = 6;

// The section's loading state, also shown by the exam hub while the exam
// itself loads inside the exam shell, so the two read as one skeleton.
export const ExamProductsSectionSkeleton: React.FC = () => (
  <section className={styles.section}>
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonBlock} />
      ))}
    </div>
  </section>
);

interface ExamProductsSectionProps {
  examId: number;
  examSlug: string;
  examName: string;
}

// Mixed "popular products" preview shown on the exam hub page — a small
// slice (mock tests, study notes, courses, bundles) each tagged to this
// exam, with a "View all" link to the dedicated full listing page for that
// type. Per the hide-if-empty rule: any block with zero items is omitted,
// and the whole section disappears if every block is empty (so an exam with
// no products yet shows nothing here, and no dedicated sub-page URL is ever
// linked to from this page either).
export const ExamProductsSection: React.FC<ExamProductsSectionProps> = ({
  examId,
  examSlug,
  examName,
}) => {
  const testsQuery = useTestsQuery({
    examId: String(examId),
    limit: String(PREVIEW_LIMIT),
    sortBy: "popular",
  });
  const shopQuery = useShopProductsQuery({
    examId,
    limit: PREVIEW_LIMIT,
    page: 1,
    sort: "popular",
  });
  const coursesQuery = usePublicCoursesQuery({
    examId: String(examId),
    limit: String(PREVIEW_LIMIT),
    sortBy: "popular",
  });
  const bundlesQuery = useBundlesQuery({
    examId,
    limit: PREVIEW_LIMIT,
    sort: "popular",
  });

  const isInitialLoading =
    testsQuery.isLoading || shopQuery.isLoading || coursesQuery.isLoading || bundlesQuery.isLoading;

  if (isInitialLoading) {
    return <ExamProductsSectionSkeleton />;
  }

  const tests = testsQuery.data?.tests ?? [];
  const products = shopQuery.data?.products ?? [];
  const courses = coursesQuery.data?.courses ?? [];
  const bundles = bundlesQuery.data?.bundles ?? [];

  const blocks = [
    {
      key: "mock-tests",
      title: "Mock Tests",
      icon: <ClipboardCheck size={18} />,
      count: tests.length,
      viewAllUrl: `/exams/${examSlug}/mock-tests`,
      content: (
        <div className={styles.cardsGrid}>
          {tests.map((test) => (
            <TeacherProductCard
              key={test.id}
              link={`/mock-test/${test.slug}`}
              teacherName={test.teacherName}
              teacherAvatarUrl={test.teacherAvatarUrl}
              teacherTagline={test.teacherTagline}
              teacherYearsOfExperience={test.teacherYearsOfExperience}
              teacherSlug={test.teacherSlug}
              teacherIsVerified={test.teacherIsVerified}
              productTitle={test.title}
              examName={test.examName}
              {...itemPriceProps(test.price, test.discountPrice)}
              thumbnailUrl={test.thumbnailUrl}
              placeholderUrl={Placeholder.TEST}
            />
          ))}
        </div>
      ),
    },
    {
      key: "study-notes",
      title: "Study Notes",
      icon: <BookOpen size={18} />,
      count: products.length,
      viewAllUrl: `/exams/${examSlug}/study-notes`,
      content: (
        <div className={styles.cardsGrid}>
          {products.map((product) => (
            <TeacherProductCard
              key={product.id}
              link={`/study-notes/${product.slug}`}
              teacherName={product.teacherName}
              teacherAvatarUrl={product.teacherAvatar}
              teacherTagline={product.teacherTagline}
              teacherYearsOfExperience={product.teacherYearsOfExperience}
              teacherSlug={product.teacherSlug}
              teacherIsVerified={product.teacherIsVerified}
              productTitle={product.title}
              examName={product.examName}
              stats={[
                product.pageCount ? `${product.pageCount} pages` : null,
                product.fileCount > 1 ? `${product.fileCount} files` : null,
              ].filter(Boolean).join(" · ")}
              priceLabel={formatItemPrice(product.price)}
              isFree={product.price === 0}
              // Study note / digital product thumbnails are discontinued
              // site-wide — never pass thumbnailUrl/placeholderUrl here.
              // See the note on TeacherProductCard in HomepageContentSection.tsx.
            />
          ))}
        </div>
      ),
    },
    {
      key: "courses",
      title: "Courses",
      icon: <GraduationCap size={18} />,
      count: courses.length,
      viewAllUrl: `/exams/${examSlug}/courses`,
      content: (
        <div className={styles.cardsGrid}>
          {courses.map((course) => (
            <TeacherProductCard
              key={course.id}
              link={`/course/${course.slug}`}
              teacherName={course.teacherName}
              teacherAvatarUrl={course.teacherAvatarUrl}
              teacherTagline={course.teacherTagline}
              teacherYearsOfExperience={course.teacherYearsOfExperience}
              teacherSlug={course.teacherSlug}
              teacherIsVerified={course.teacherIsVerified}
              productTitle={course.title}
              {...itemPriceProps(course.price, course.discountPrice)}
              thumbnailUrl={course.thumbnailImageUrl || course.thumbnailUrl}
              placeholderUrl={Placeholder.COURSE}
            />
          ))}
        </div>
      ),
    },
    {
      key: "bundles",
      title: "Bundles",
      icon: <Package size={18} />,
      count: bundles.length,
      viewAllUrl: `/exams/${examSlug}/bundles`,
      content: (
        <div className={styles.cardsGrid}>
          {bundles.map((bundle) => (
            <PublicBundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      ),
    },
  ];

  const visibleBlocks = blocks.filter((block) => block.count > 0);

  if (visibleBlocks.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{examName} Study Material</h2>
      {visibleBlocks.map((block) => (
        <div key={block.key} className={styles.block} data-block={block.key}>
          <div className={styles.blockHeader}>
            <h3 className={styles.blockTitle}>
              {block.icon}
              {block.title}
            </h3>
            <Link to={block.viewAllUrl} className={styles.viewAllLink}>
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          {block.content}
        </div>
      ))}
    </section>
  );
};
