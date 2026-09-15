import type { OutputType } from "../endpoints/teachers/profile_GET.schema";

/**
 * Everything the public expert landing page puts on screen as a number is
 * derived here, from the profile payload the page already fetches. No extra
 * request, and every figure is a real Testkart datapoint - enrolments,
 * reviews, questions authored, exams covered - rather than a self-reported
 * claim the teacher types into a form.
 */
export interface TeacherProfileStats {
  students: number;
  rating: number | null;
  reviews: number;
  courses: number;
  tests: number;
  liveTests: number;
  products: number;
  catalogue: number;
  questions: number;
  exams: string[];
  views: number;
  freeItems: number;
  yearsTeaching: number | null;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const yearsFromWorkHistory = (teacher: OutputType["teacher"]): number | null => {
  const history = teacher.workExperiences ?? [];
  const starts = history
    .map((entry) => new Date(entry.startDate).getTime())
    .filter((time) => Number.isFinite(time));

  if (starts.length === 0) return null;

  const years = Math.floor((Date.now() - Math.min(...starts)) / MS_PER_YEAR);
  return years > 0 ? years : null;
};

export const computeTeacherProfileStats = ({
  teacher,
  courses,
  tests,
  liveTests,
  products,
}: OutputType): TeacherProfileStats => {
  const students =
    tests.reduce((sum, test) => sum + toNumber(test.studentsEnrolled), 0) +
    courses.reduce((sum, course) => sum + toNumber(course.enrollmentCount), 0) +
    liveTests.reduce((sum, liveTest) => sum + toNumber(liveTest.enrolledCount), 0) +
    products.reduce((sum, product) => sum + toNumber(product.totalPurchases), 0);

  let ratingTotal = 0;
  let reviews = 0;
  const addRating = (rating: number | null | undefined, count: number) => {
    if (rating === null || rating === undefined || count <= 0) return;
    ratingTotal += rating * count;
    reviews += count;
  };
  tests.forEach((test) => addRating(test.rating, toNumber(test.reviewsCount)));
  courses.forEach((course) => addRating(course.avgRating, toNumber(course.ratingsCount)));
  products.forEach((product) => addRating(product.rating, toNumber(product.ratingsCount)));

  const questions =
    tests.reduce(
      (sum, test) => sum + Math.max(toNumber(test.actualQuestionCount), toNumber(test.totalQuestions)),
      0
    ) + liveTests.reduce((sum, liveTest) => sum + toNumber(liveTest.actualQuestionCount), 0);

  const views =
    tests.reduce((sum, test) => sum + toNumber(test.views), 0) +
    courses.reduce((sum, course) => sum + toNumber(course.views), 0) +
    products.reduce((sum, product) => sum + toNumber(product.views), 0) +
    liveTests.reduce((sum, liveTest) => sum + toNumber(liveTest.viewCount), 0);

  const exams = Array.from(
    new Set(
      [
        ...tests.map((test) => test.examName),
        ...liveTests.map((liveTest) => liveTest.examName),
        ...courses.map((course) => course.examName),
        ...products.map((product) => product.examName),
      ]
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
        .map((name) => name.trim())
    )
  );

  const freeItems =
    tests.filter((test) => (test.discountPrice ?? test.price) === 0).length +
    courses.filter((course) => course.price === 0).length +
    liveTests.filter((liveTest) => liveTest.price === 0).length +
    products.filter((product) => product.price === 0).length;

  const declaredYears = toNumber(teacher.yearsOfExperience);

  return {
    students,
    rating: reviews > 0 ? ratingTotal / reviews : null,
    reviews,
    courses: courses.length,
    tests: tests.length,
    liveTests: liveTests.length,
    products: products.length,
    catalogue: courses.length + tests.length + liveTests.length + products.length,
    questions,
    exams,
    views,
    freeItems,
    yearsTeaching: declaredYears > 0 ? declaredYears : yearsFromWorkHistory(teacher),
  };
};

/** Compact Indian-numbering label for headline figures: 940, 1.2k, 3.4L. */
export const formatStatCount = (value: number): string => {
  const trim = (text: string) => text.replace(/\.0$/, "");

  if (value >= 100000) return `${trim((value / 100000).toFixed(1))}L`;
  if (value >= 1000) return `${trim((value / 1000).toFixed(1))}k`;
  return value.toLocaleString("en-IN");
};
