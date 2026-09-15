import React from "react";
import { Link } from "react-router-dom";
import { FileText, BookOpen, GraduationCap, Package, ArrowRight } from "lucide-react";
import { useTestsQuery } from "../helpers/useTestsQuery";
import { useShopProductsQuery } from "../helpers/useShopQuery";
import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useBundlesQuery } from "../helpers/useBundlesQuery";
import { TeacherProductCard } from "./HomepageContentSection";
import type { BundleListItem } from "../endpoints/bundles/list_GET.schema";
import { Placeholder } from "../helpers/placeholderImages";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import styles from "./ExamProductsSection.module.css";

const PREVIEW_LIMIT = 4;

// A compact bundle card sized to match TeacherProductCard exactly, so the
// Bundles block doesn't visually dominate the other three preview blocks
// the way the full-size BundlesGrid card (designed for a dedicated bundles
// page) would.
const MiniBundleCard: React.FC<{ bundle: BundleListItem }> = ({ bundle }) => {
  const isFree = bundle.price === 0;
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(bundle.price);

  return (
    <Link to={`/bundles/${bundle.slug}`} className={styles.miniCard}>
      <div className={styles.miniCardThumbnail}>
        {bundle.thumbnailUrl ? (
          <img src={bundle.thumbnailUrl} alt="" className={styles.miniCardImage} loading="lazy" />
        ) : (
          <Package size={24} className={styles.miniCardIcon} />
        )}
      </div>
      <h4 className={styles.miniCardTitle}>{bundle.title}</h4>
      <p className={styles.miniCardStats}>
        <span className={styles.miniCardStatsText}>{bundle.itemCount} items</span>
        <span className={isFree ? styles.miniCardPriceFree : styles.miniCardPricePaid}>
          {isFree ? "Free" : formattedPrice}
        </span>
      </p>
    </Link>
  );
};

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
    return (
      <section className={styles.section}>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBlock} />
          ))}
        </div>
      </section>
    );
  }

  const tests = testsQuery.data?.tests ?? [];
  const products = shopQuery.data?.products ?? [];
  const courses = coursesQuery.data?.courses ?? [];
  const bundles = bundlesQuery.data?.bundles ?? [];

  const blocks = [
    {
      key: "mock-tests",
      title: "Mock Tests",
      icon: <FileText size={18} />,
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
              stats={`${(test.views ?? 0).toLocaleString("en-IN")} views`}
              priceLabel={formatItemPrice(test.price, test.discountPrice)}
              isFree={(test.discountPrice ?? test.price) === 0}
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
                `${product.views.toLocaleString("en-IN")} views`,
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
              stats={`${course.views.toLocaleString("en-IN")} views`}
              priceLabel={formatItemPrice(course.price)}
              isFree={course.price === 0}
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
            <MiniBundleCard key={bundle.id} bundle={bundle} />
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
        <div key={block.key} className={styles.block}>
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
