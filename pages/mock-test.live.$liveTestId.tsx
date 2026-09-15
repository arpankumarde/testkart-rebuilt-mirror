import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { stripHtmlClient } from "../helpers/stripHtmlClient";
import { wrapContentTables } from "../helpers/contentTables";
import { BookOpen, BarChart2, AlertTriangle, PlayCircle, FileText, Target, Trophy, Clock, AlertCircle, ShieldAlert, CreditCard, Award } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestDetailsQuery";
import { LiveTestHero } from "../components/LiveTestHero";
import { LiveTestLeaderboard } from "../components/LiveTestLeaderboard";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { TeacherProfileCard } from "../components/TeacherProfileCard";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import { getLiveTestStatus } from "../helpers/useLiveTestHelpers";
import styles from "./mock-test.live.$liveTestId.module.css";

const LiveTestDetailsSkeleton: React.FC = () => (
  <div className={styles.skeletonContainer}>
    <Skeleton className={styles.skeletonHero} />
    <div className={styles.skeletonContent}>
      <Skeleton className={styles.skeletonTabs} />
      <Skeleton className={styles.skeletonText} />
      <Skeleton className={styles.skeletonText} style={{ width: "80%" }} />
      <Skeleton className={styles.skeletonText} style={{ width: "60%" }} />
    </div>
  </div>
);

const LiveTestDetailsPage: React.FC = () => {
  const { liveTestId } = useParams<{ liveTestId: string }>();
  const numericLiveTestId = liveTestId ? parseInt(liveTestId, 10) : undefined;

  const { data, isFetching, error } = useLiveTestDetailsQuery(
    numericLiveTestId && !isNaN(numericLiveTestId) ? numericLiveTestId : null
  );

  const [activeTab, setActiveTab] = useState<"about" | "leaderboard">("leaderboard");

  if (isFetching && !data) {
    return <LiveTestDetailsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} />
        <h1>Test Not Found</h1>
        <p>
          The live test you are looking for does not exist or may have been
          removed.
        </p>
        <Button asChild>
          <Link to="/mock-test/live">Browse Live Tests</Link>
        </Button>
      </div>
    );
  }

  const status = getLiveTestStatus(data);
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  // Teachers frequently re-run the same named live competition on a new
  // date (recurring editions), which otherwise all get the identical
  // <title>. Appending the start date disambiguates each edition instead
  // of letting them collide on one duplicate title.
  const formattedStartDate = data.startTime
    ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(data.startTime))
    : null;
  const seoTitle = formattedStartDate ? `${data.title} - ${formattedStartDate} | Live Test` : `${data.title} | Live Test`;

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={
          stripHtmlClient(data.description) ||
          `Join the live test '${data.title}'${formattedStartDate ? ` on ${formattedStartDate}` : ''} on Testkart. Compete, learn, and see where you stand.`
        }
        image={data.thumbnailUrl ?? undefined}
      />
      <div className={styles.pageContainer}>
        <LiveTestHero liveTest={data} />

        <div className={styles.contentContainer}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabButton} ${
                activeTab === "about" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("about")}
            >
              <BookOpen size={16} /> About
            </button>
            <button
              className={`${styles.tabButton} ${
                activeTab === "leaderboard" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <BarChart2 size={16} /> Leaderboard
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === "about" && (
              <div className={styles.aboutSection}>
                <h2>About This Test</h2>
                {data.description ? (
                  <div
                    className={styles.descriptionText}
                    dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(data.description)) }}
                  />
                ) : (
                  <div className={styles.descriptionText}>No description provided.</div>
                )}

                {data.hasPrizes && data.totalPrizePool > 0 && (
                  <div className={styles.prizeSection}>
                    <div className={styles.prizeHeader}>
                      <div className={styles.prizeWinText}>Win up to</div>
                      <div className={styles.prizeTopAmount}>{formatCurrency(data.firstPrize)}</div>
                      <div className={styles.prizeTotalPool}>
                        <Award size={24} />
                        <span>Total Prize Pool: {formatCurrency(data.totalPrizePool)}</span>
                      </div>
                    </div>
                    <div className={styles.prizeBreakdown}>
                      <div className={`${styles.prizeItem} ${styles.firstPrize}`}>
                        <div className={styles.prizeRank}>
                          <span className={styles.prizeEmoji}>🏆</span>
                          <span className={styles.prizePosition}>1st Place</span>
                        </div>
                        <div className={styles.prizeAmount}>{formatCurrency(data.firstPrize)}</div>
                      </div>
                      <div className={`${styles.prizeItem} ${styles.secondPrize}`}>
                        <div className={styles.prizeRank}>
                          <span className={styles.prizeEmoji}>🥈</span>
                          <span className={styles.prizePosition}>2nd Place</span>
                        </div>
                        <div className={styles.prizeAmount}>{formatCurrency(data.secondPrize)}</div>
                      </div>
                      <div className={`${styles.prizeItem} ${styles.thirdPrize}`}>
                        <div className={styles.prizeRank}>
                          <span className={styles.prizeEmoji}>🥉</span>
                          <span className={styles.prizePosition}>3rd Place</span>
                        </div>
                        <div className={styles.prizeAmount}>{formatCurrency(data.thirdPrize)}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <h2>Comprehensive Rules & Information</h2>
                <div className={styles.rulesGrid}>
                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <FileText className={styles.ruleIcon} size={20} />
                      <h3>Test Format</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Subject: {data.mockTestDetails.subject || 'General'}</li>
                      <li>Total Questions: {data.mockTestDetails.totalQuestions}</li>
                      <li>Duration: {data.mockTestDetails.durationMinutes} minutes</li>
                    </ul>
                  </div>

                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <Target className={styles.ruleIcon} size={20} />
                      <h3>Scoring Rules</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Each question carries positive marks. Negative marking may apply.</li>
                      <li>For multiple correct questions, partial marking may be available.</li>
                      <li>Final score = Sum of marks obtained across all questions.</li>
                    </ul>
                  </div>

                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <BarChart2 className={styles.ruleIcon} size={20} />
                      <h3>Ranking & Leaderboard</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Rank is determined by score first, then time taken (less time = higher rank).</li>
                      <li>Leaderboard updates in real-time during the test.</li>
                      <li>Final rankings are declared after the test ends.</li>
                    </ul>
                  </div>

                  {data.hasPrizes && (
                    <div className={styles.ruleCard}>
                      <div className={styles.ruleHeader}>
                        <Trophy className={styles.ruleIcon} size={20} />
                        <h3>Prizes</h3>
                      </div>
                      <ul className={styles.ruleList}>
                        <li>1st Prize: ₹{data.firstPrize} | 2nd Prize: ₹{data.secondPrize} | 3rd Prize: ₹{data.thirdPrize}</li>
                        <li>Prize money will be credited to the winner's Testkart wallet after the test ends.</li>
                        <li>Winners can withdraw prize money to their bank account.</li>
                      </ul>
                    </div>
                  )}

                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <Clock className={styles.ruleIcon} size={20} />
                      <h3>Attempt Rules</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Only one attempt is allowed per student.</li>
                      <li>Once you submit the test, you cannot re-attempt.</li>
                      <li>Test will auto-submit when the time expires.</li>
                      <li>You must be enrolled to attempt the test.</li>
                    </ul>
                  </div>

                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <CreditCard className={styles.ruleIcon} size={20} />
                      <h3>Enrollment & Refund</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Seats are limited (Max seats: {data.maxSeats}).</li>
                      <li>Registration closes at the deadline or when all seats are filled.</li>
                      <li>No refund once enrolled in the contest.</li>
                    </ul>
                  </div>

                  <div className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <ShieldAlert className={styles.ruleIcon} size={20} />
                      <h3>Disclaimer</h3>
                    </div>
                    <ul className={styles.ruleList}>
                      <li>Testkart does not proctor the test or verify student identity.</li>
                      <li>Quality and correctness of questions solely depends upon the teacher who hosts this live test.</li>
                      <li>By enrolling, you agree to the above rules and Testkart's Terms of Service.</li>
                    </ul>
                  </div>
                </div>

                

                <div className={styles.teacherSection}>
                  <h2>About the Host</h2>
                                    <TeacherProfileCard 
                    variant="compact"
                    teacher={{
                      id: data.teacherProfile.id,
                      displayName: data.teacherProfile.name,
                      avatarUrl: data.teacherProfile.avatarUrl,
                      slug: data.teacherSlug,
                      bio: data.teacherProfile.bio,
                      websiteUrl: data.teacherProfile.websiteUrl,
                      publicEmail: data.teacherProfile.publicEmail,
                      publicPhone: data.teacherProfile.publicPhone,
                      isVerified: data.teacherIsVerified,
                      socialLinks: data.teacherProfile.socialLinks,
                      awardsCertificates: data.teacherProfile.awardsCertificates,
                    }}
                  />
                </div>

                {data.disclaimer && (
                  <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
                    {data.disclaimer}
                  </div>
                )}
              </div>
            )}
            {activeTab === "leaderboard" && (
                            <LiveTestLeaderboard 
                liveTestId={data.id} 
                autoRefresh 
              />
            )}
          </div>

          <TeacherCtaBanner className={styles.earnBanner} />
        </div>
      </div>
    </>
  );
};

export default LiveTestDetailsPage;