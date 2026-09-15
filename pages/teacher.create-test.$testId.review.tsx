import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from '../components/Button';
import { useTeacherTestsQuery, useTeacherTestItemsQuery } from '../helpers/useTeacherTestsQuery';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';
import { useTeacherLiveTestsQuery } from '../helpers/useTeacherLiveTestsQuery';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import type { TestItemWithQuestionsCount } from "../endpoints/teacher/test-items/list_GET.schema";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Edit,
  ExternalLink,
  ImageOff,
  XCircle,
} from "lucide-react";
import DOMPurify from "dompurify";
import styles from "./teacher.create-test.$testId.review.module.css";

const parseJsonArray = (val: unknown): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val) || []; } catch { return []; } }
  return [];
};

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not set";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const effectiveDuration = (item: TestItemWithQuestionsCount) =>
  item.subjectWiseTiming
    ? item.totalSubjectDurationMinutes ?? 0
    : item.questionWiseTiming
    ? item.totalQuestionDurationMinutes ?? 0
    : item.durationMinutes;

// Subjects with different question counts are normal and not flagged; only a
// genuinely empty subject is.
const itemIssues = (item: TestItemWithQuestionsCount): string[] => {
  if (item.questionsCount === 0) return ["No questions yet"];
  const issues: string[] = [];
  if (item.missingAnswerCount > 0) {
    issues.push(`${plural(item.missingAnswerCount, "question")} without a correct answer`);
  }
  if (item.subjectsCount > 1 && item.minSubjectQuestionCount === 0) {
    issues.push("A subject has no questions");
  }
  return issues;
};

type CheckState = "pass" | "fail" | "advisory";

type Check = {
  id: string;
  label: string;
  state: CheckState;
  note?: string;
  action?: { label: string; to: string };
  items?: { id: number; title: string; detail?: string; fixLabel: string; to: string }[];
};

const CHECK_ICON: Record<CheckState, React.ReactNode> = {
  pass: <CheckCircle2 size={18} aria-hidden="true" />,
  fail: <XCircle size={18} aria-hidden="true" />,
  advisory: <AlertCircle size={18} aria-hidden="true" />,
};

const CHECK_STATUS: Record<CheckState, string> = {
  pass: "Passed",
  fail: "Needs fixing",
  advisory: "Recommended",
};

const CHECK_CLASS: Record<CheckState, string> = {
  pass: styles.checkPass,
  fail: styles.checkFail,
  advisory: styles.checkAdvisory,
};

const Page = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const packageId = Number(testId);

  // The last stop in the flow, often reached seconds after the series or its
  // items changed, so it refetches on arrival instead of trusting the cache,
  // and offers a manual retry so a slow load is not a dead end.
  const { data: tests, isFetching: isTestsFetching, isError: isTestsError, refetch: refetchTests } =
    useTeacherTestsQuery({ refetchOnMount: "always" });
  const { data: testItems, isFetching: isItemsFetching, isError: isItemsError, refetch: refetchItems } =
    useTeacherTestItemsQuery(packageId, { refetchOnMount: "always" });
  const { data: liveTestsData, isFetching: isLiveTestsFetching } = useTeacherLiveTestsQuery({ mockTestId: packageId });
  const { usePublishTestMutation, usePublishLiveTestMutation } = useTeacherTestMutations();
  const publishMutation = usePublishTestMutation();
  const publishLiveMutation = usePublishLiveTestMutation();

  const testPackage = tests?.find((t) => t.id === packageId);
  const liveTest = liveTestsData?.tests.find((lt) => lt.mockTestId === packageId);
  const isLiveTest = !!liveTest;

  // Skeleton until the arrival refetches settle once. After that a background
  // refetch (an invalidation from a mutation) updates the page in place.
  const isAnyFetching = isTestsFetching || isItemsFetching || isLiveTestsFetching;
  const [hasArrived, setHasArrived] = useState(false);
  useEffect(() => {
    if (!isAnyFetching) setHasArrived(true);
  }, [isAnyFetching]);
  const isInitialLoading = !hasArrived && isAnyFetching;

  // Both publish hooks toast their own success and error, so this only navigates.
  const handlePublish = () => {
    if (isLiveTest && liveTest) {
      publishLiveMutation.mutate({ testId: packageId }, {
        onSuccess: () => navigate("/teacher/live-tests"),
      });
    } else {
      publishMutation.mutate({ testId: packageId }, {
        // Land on the tab the series just moved into: the next question is "is it live?".
        onSuccess: () => navigate("/teacher/test-series?status=published"),
      });
    }
  };

  const testItemsLink = `/teacher/create-test/${packageId}/test-items`;
  const basicInfoLink = `/teacher/create-test/basic-info?testId=${packageId}`;

  if (isInitialLoading) {
    return (
      <div className={styles.page}>
        <Skeleton style={{ height: "4.5rem", maxWidth: "40rem" }} />
        <div className={styles.layout}>
          <div className={styles.rail}>
            <Skeleton style={{ height: "22rem" }} />
          </div>
          <div className={styles.content}>
            <Skeleton style={{ height: "34rem" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!testPackage || !testItems) {
    return (
      <div className={styles.page}>
        <div className={styles.loadError} role="alert">
          <span className={styles.loadErrorIcon}>
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <h2>Could not load the review</h2>
          <p>
            {isTestsError || isItemsError
              ? "The test series details did not load. Check your connection and try again."
              : "This can happen right after creating a test series. Give it a moment and try again."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              refetchTests();
              refetchItems();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const orderedItems = [...testItems].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id);
  const questionsLink = (itemId: number) => `/teacher/create-test/${packageId}/test-items/${itemId}/questions`;

  // Failing checks block publishing. The thumbnail check is advisory and holds
  // nothing up. Every failure links to the page that fixes it.
  const checks: Check[] = [];
  if (orderedItems.length === 0) {
    checks.push({
      id: "tests",
      label: "Has at least one test",
      state: "fail",
      note: "Add a test and its questions before publishing.",
      action: { label: "Add a test", to: testItemsLink },
    });
  } else {
    const emptyItems = orderedItems.filter((item) => item.questionsCount === 0);
    const unansweredItems = orderedItems.filter((item) => item.questionsCount > 0 && item.missingAnswerCount > 0);
    checks.push({
      id: "questions",
      label: "Every test has questions",
      state: emptyItems.length > 0 ? "fail" : "pass",
      items: emptyItems.map((item) => ({
        id: item.id,
        title: item.title,
        fixLabel: "Add questions",
        to: questionsLink(item.id),
      })),
    });
    checks.push({
      id: "answers",
      label: "Every question has a correct answer",
      state: unansweredItems.length > 0 ? "fail" : "pass",
      items: unansweredItems.map((item) => ({
        id: item.id,
        title: item.title,
        detail: plural(item.missingAnswerCount, "question"),
        fixLabel: "Mark answers",
        to: questionsLink(item.id),
      })),
    });
    if (orderedItems.some((item) => item.subjectsCount > 1)) {
      const emptySubjectItems = orderedItems.filter(
        (item) => item.questionsCount > 0 && item.subjectsCount > 1 && item.minSubjectQuestionCount === 0,
      );
      checks.push({
        id: "subjects",
        label: "Every subject has questions",
        state: emptySubjectItems.length > 0 ? "fail" : "pass",
        items: emptySubjectItems.map((item) => ({
          id: item.id,
          title: item.title,
          fixLabel: "Add questions",
          to: questionsLink(item.id),
        })),
      });
    }
  }
  checks.push(
    testPackage.thumbnailUrl
      ? { id: "thumbnail", label: "Listing has a thumbnail", state: "pass" }
      : {
          id: "thumbnail",
          label: "Listing has a thumbnail",
          state: "advisory",
          note: "Optional, but a thumbnail helps the series stand out in the marketplace.",
          action: { label: "Add thumbnail", to: `${basicInfoLink}&focus=thumbnailUrl` },
        },
  );

  const failCount = checks.filter((check) => check.state === "fail").length;
  const passCount = checks.filter((check) => check.state === "pass").length;
  const isReadyToPublish = orderedItems.length > 0 && failCount === 0;

  // A published series cannot be published again (the server refuses it), and a
  // live test is published once isActive is set, so both get a live panel
  // instead of a publish button that does nothing useful.
  const isAlreadyLive = isLiveTest && liveTest ? !!liveTest.isActive : !!testPackage.isPublished;
  const kindLabel = isLiveTest ? "live test" : "test series";
  const isPublishing = publishMutation.isPending || publishLiveMutation.isPending;
  const verdict = isAlreadyLive ? "live" : isReadyToPublish ? "ready" : "blocked";

  const totalQuestions = orderedItems.reduce((sum, item) => sum + item.questionsCount, 0);
  const durations = orderedItems.map(effectiveDuration);
  const totalMinutes = durations.every((minutes) => minutes > 0)
    ? durations.reduce((sum, minutes) => sum + minutes, 0)
    : null;

  const price = Number(testPackage.price);
  const discount = testPackage.discountPrice === null ? null : Number(testPackage.discountPrice);
  const salePrice = discount !== null && discount > 0 && discount < price ? discount : null;
  const whatYouLearn = parseJsonArray(testPackage.whatYouLearn);
  const requirements = parseJsonArray(testPackage.requirements);
  const longDescription = testPackage.longDescription?.trim() ? testPackage.longDescription : null;

  const doneLink = isLiveTest ? "/teacher/live-tests" : "/teacher/test-series?status=published";
  const listingLink = isLiveTest && liveTest ? `/mock-test/live/${liveTest.id}` : `/mock-test/${testPackage.slug}`;

  return (
    <>
      <Helmet>
        <title>Review and publish | Testkart</title>
        <meta name="description" content="Review your mock test package and publish it to the marketplace." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>{isAlreadyLive ? "Review" : "Review and publish"}</h1>
            {isLiveTest && <Badge variant="secondary">Live test</Badge>}
          </div>
          <p>
            {isAlreadyLive
              ? "Check what students see and fix anything flagged."
              : `Check your ${kindLabel} the way students will see it, then publish it.`}
          </p>
        </header>

        <div className={styles.layout}>
          <aside className={styles.rail} aria-labelledby="review-verdict">
            <div className={styles.railCard}>
              <div
                className={`${styles.verdict} ${verdict === "blocked" ? styles.verdictBlocked : styles.verdictBrand}`}
                aria-live="polite"
              >
                {verdict === "live" && (
                  <>
                    <h2 id="review-verdict" className={styles.verdictTitle}>Live on Testkart</h2>
                    <p className={styles.verdictBody}>
                      Students can find this {kindLabel} now, and changes you save go live right away.
                      {failCount > 0 && " Fix the checks marked below."}
                    </p>
                    <div className={styles.verdictActions}>
                      <Button asChild size="lg">
                        <Link to={doneLink}>Done</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                        <Link to={listingLink} target="_blank" rel="noopener noreferrer">
                          View listing <ExternalLink aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
                {verdict === "ready" && (
                  <>
                    <h2 id="review-verdict" className={styles.verdictTitle}>Ready to publish</h2>
                    <p className={styles.verdictBody}>
                      {plural(orderedItems.length, "test")} and {plural(totalQuestions, "question")} pass every
                      required check. Students can find it as soon as you publish.
                    </p>
                    <div className={styles.verdictActions}>
                      <Button size="lg" onClick={handlePublish} disabled={isPublishing}>
                        {isPublishing ? "Publishing..." : `Publish ${kindLabel}`}
                      </Button>
                    </div>
                  </>
                )}
                {verdict === "blocked" && (
                  <>
                    <h2 id="review-verdict" className={styles.verdictTitle}>
                      {plural(failCount, "check")} to fix
                    </h2>
                    <p className={styles.verdictBody}>
                      Publishing unlocks once every required check below passes.
                    </p>
                  </>
                )}
              </div>

              <div className={styles.checks}>
                <div className={styles.checksHeader}>
                  <h3>Checks</h3>
                  <span>{passCount} of {checks.length} passed</span>
                </div>
                <ul className={styles.checkList}>
                  {checks.map((check) => (
                    <li key={check.id} className={`${styles.check} ${CHECK_CLASS[check.state]}`}>
                      <span className={styles.checkIcon}>{CHECK_ICON[check.state]}</span>
                      <div className={styles.checkBody}>
                        <p className={styles.checkLabel}>
                          <span className={styles.srOnly}>{CHECK_STATUS[check.state]}: </span>
                          {check.label}
                        </p>
                        {check.note && <p className={styles.checkNote}>{check.note}</p>}
                        {check.items && check.items.length > 0 && (
                          <ul className={styles.checkItems}>
                            {check.items.map((item) => (
                              <li key={item.id}>
                                <span>{item.detail ? `${item.title}: ${item.detail}` : item.title}</span>
                                <Link
                                  to={item.to}
                                  className={styles.fixLink}
                                  aria-label={`${item.fixLabel} in ${item.title}`}
                                >
                                  {item.fixLabel}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                        {check.action && (
                          <Link to={check.action.to} className={styles.fixLink}>
                            {check.action.label}
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <div className={styles.content}>
            <div className={styles.sheet}>
              {isLiveTest && liveTest && (
                <section className={styles.block} aria-labelledby="review-live">
                  <div className={styles.blockHeader}>
                    <h2 id="review-live">Live test</h2>
                  </div>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Starts</dt>
                      <dd>{formatDateTime(liveTest.startTime)}</dd>
                    </div>
                    <div>
                      <dt>Registration closes</dt>
                      <dd>{formatDateTime(liveTest.registrationDeadline)}</dd>
                    </div>
                    <div>
                      <dt>Seats</dt>
                      <dd>{liveTest.maxSeats} students</dd>
                    </div>
                    <div>
                      <dt>Entry fee</dt>
                      <dd>{liveTest.price === 0 ? "Free" : formatInr(liveTest.price)}</dd>
                    </div>
                    {liveTest.hasPrizes && (
                      <>
                        <div>
                          <dt>Prize pool</dt>
                          <dd>{formatInr(liveTest.totalPrizePool)}</dd>
                        </div>
                        <div>
                          <dt>Prizes</dt>
                          <dd>
                            1st {formatInr(liveTest.firstPrize)}, 2nd {formatInr(liveTest.secondPrize)}, 3rd{" "}
                            {formatInr(liveTest.thirdPrize)}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                </section>
              )}

              <section className={styles.block} aria-labelledby="review-listing">
                <div className={styles.blockHeader}>
                  <h2 id="review-listing">Storefront listing</h2>
                  <Button asChild variant="outline" size="sm">
                    <Link to={basicInfoLink} aria-label="Edit storefront listing">
                      <Edit size={14} /> Edit
                    </Link>
                  </Button>
                </div>

                <div className={styles.listing}>
                  <div className={styles.thumb}>
                    {testPackage.thumbnailUrl ? (
                      <img src={testPackage.thumbnailUrl} alt="Listing thumbnail" width={600} height={338} />
                    ) : (
                      <div className={styles.thumbEmpty}>
                        <ImageOff size={22} aria-hidden="true" />
                        <span>No thumbnail</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.listingMeta}>
                    {(testPackage.examName || testPackage.language) && (
                      <div className={styles.badges}>
                        {testPackage.examName && <Badge variant="default">{testPackage.examName}</Badge>}
                        {testPackage.language && <Badge variant="secondary">{testPackage.language}</Badge>}
                      </div>
                    )}
                    <h3 className={styles.listingTitle}>{testPackage.title}</h3>
                    <p className={styles.price}>
                      {price === 0 ? "Free" : formatInr(salePrice ?? price)}
                      {salePrice !== null && (
                        <>
                          <s className={styles.priceWas}>{formatInr(price)}</s>
                          <span className={styles.priceOff}>
                            {Math.round(((price - salePrice) / price) * 100)}% off
                          </span>
                        </>
                      )}
                    </p>
                    {testPackage.description ? (
                      <p className={styles.listingDescription}>{testPackage.description}</p>
                    ) : (
                      <p className={styles.muted}>No short description yet.</p>
                    )}
                  </div>
                </div>

                {(whatYouLearn.length > 0 || requirements.length > 0) && (
                  <div className={styles.listColumns}>
                    {whatYouLearn.length > 0 && (
                      <div>
                        <h3 className={styles.subheading}>What you'll master</h3>
                        <ul className={styles.bullets}>
                          {whatYouLearn.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {requirements.length > 0 && (
                      <div>
                        <h3 className={styles.subheading}>Requirements</h3>
                        <ul className={styles.bullets}>
                          {requirements.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {longDescription && (
                  <details className={styles.longDescription}>
                    <summary>
                      Detailed description
                      <ChevronDown size={16} className={styles.summaryIcon} aria-hidden="true" />
                    </summary>
                    <div
                      className={styles.prose}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(longDescription) }}
                    />
                  </details>
                )}
              </section>

              <section className={styles.block} aria-labelledby="review-tests">
                <div className={styles.blockHeader}>
                  <h2 id="review-tests">Tests</h2>
                  <Button asChild variant="outline" size="sm">
                    <Link to={testItemsLink} aria-label="Edit tests">
                      <Edit size={14} /> Edit
                    </Link>
                  </Button>
                </div>

                {orderedItems.length === 0 ? (
                  <p className={styles.muted}>No tests in this {kindLabel} yet.</p>
                ) : (
                  <>
                    <ol className={styles.testList}>
                      {orderedItems.map((item, index) => {
                        const duration = effectiveDuration(item);
                        const issues = itemIssues(item);
                        const hasNotes =
                          item.isFree || item.subjectWiseTiming || item.questionWiseTiming || !!item.scheduledDate;
                        return (
                          <li
                            key={item.id}
                            className={`${styles.testRow} ${issues.length > 0 ? styles.testRowBlocked : ""}`}
                          >
                            <span className={styles.testNumber} aria-hidden="true">{index + 1}</span>
                            <div className={styles.testMain}>
                              <p className={styles.testTitle}>{item.title}</p>
                              {hasNotes && (
                                <div className={styles.testNotes}>
                                  {item.isFree && <span className={styles.freeTag}>Free</span>}
                                  {item.subjectWiseTiming && <span>Timed per subject</span>}
                                  {item.questionWiseTiming && <span>Timed per question</span>}
                                  {item.scheduledDate && <span>Scheduled for {formatDateTime(item.scheduledDate)}</span>}
                                </div>
                              )}
                              {issues.map((issue) => (
                                <p key={issue} className={styles.testIssue}>
                                  <AlertTriangle size={14} aria-hidden="true" /> {issue}
                                </p>
                              ))}
                            </div>
                            <div className={styles.testStats}>
                              <span>{plural(item.questionsCount, "question")}</span>
                              <span>{duration === 0 ? "No time limit" : `${duration} min`}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <div className={styles.testTotals}>
                      <span className={styles.testTotalsLabel}>Total</span>
                      <div className={styles.testStats}>
                        <span>{plural(totalQuestions, "question")}</span>
                        <span>{totalMinutes === null ? "" : `${totalMinutes} min`}</span>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className={styles.navigation}>
              <Button asChild variant="outline">
                <Link to={testItemsLink}>
                  <ChevronLeft size={16} /> Previous
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
