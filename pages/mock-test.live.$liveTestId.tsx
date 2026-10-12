import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { stripHtmlClient } from "../helpers/stripHtmlClient";
import { wrapContentTables } from "../helpers/contentTables";
import { BookOpen, BarChart2, AlertTriangle, PlayCircle, FileText, Target, Trophy, Clock, AlertCircle, ShieldAlert, CreditCard, Award, ListChecks } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { SEOHead } from "../components/SEOHead";
import { Placeholder } from "../helpers/placeholderImages";
import { useLiveTestDetailsQuery } from "../helpers/useLiveTestDetailsQuery";
import { LiveTestHero } from "../components/LiveTestHero";
import { LiveTestLeaderboard } from "../components/LiveTestLeaderboard";
import { Skeleton } from "../components/Skeleton";
import { PlayfulButton, playfulButtonClass } from "../components/PlayfulButton";
import { TeacherProfileCard } from "../components/TeacherProfileCard";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import { PublicCouponsCard } from "../components/PublicCouponsCard";
import { getLiveTestStatus } from "../helpers/useLiveTestHelpers";
import { useTrackStorefrontView } from "../helpers/trackStorefrontEvent";
import { NotFoundState } from "../components/NotFoundState";
import { isNotFoundError } from "../helpers/isNotFoundError";
import styles from "./mock-test.live.$liveTestId.module.css";

type Tab = "about" | "leaderboard";

interface RuleCardData {
  title: string;
  icon: React.ReactNode;
  tone: "lavender" | "blue" | "sage" | "peach" | "yellow";
  items: string[];
}

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
  useTrackStorefrontView("live_test", data?.id);

  const { authState } = useAuth();
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  // Until the visitor picks a tab, the default follows the session: Leaderboard
  // when signed in, About otherwise. null while the session is still resolving,
  // so the wrong tab never flashes. Once picked, the choice is never overridden.
  const defaultTab: Tab | null =
    authState.type === "loading"
      ? null
      : authState.type === "authenticated"
        ? "leaderboard"
        : "about";
  const activeTab = selectedTab ?? defaultTab;
  const setActiveTab = setSelectedTab;

  if (isFetching && !data) {
    return <LiveTestDetailsSkeleton />;
  }

  if (error && !isNotFoundError(error)) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} />
        <h1>Could not load this live test</h1>
        <p>Something went wrong on our side. Please try again in a moment.</p>
        <PlayfulButton asChild tone="primary" size="lg">
          <Link to="/mock-test/live">Browse Live Tests</Link>
        </PlayfulButton>
      </div>
    );
  }

  if (!data) {
    return <NotFoundState kind="live" />;
  }

  const status = getLiveTestStatus(data);
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const ruleCards: RuleCardData[] = [
    {
      title: "Test Format",
      icon: <FileText size={18} />,
      tone: "lavender",
      items: [
        `Subject: ${data.mockTestDetails.subject || 'General'}`,
        `Total Questions: ${data.mockTestDetails.totalQuestions}`,
        `Duration: ${data.mockTestDetails.durationMinutes} minutes`,
      ],
    },
    {
      title: "Scoring Rules",
      icon: <Target size={18} />,
      tone: "blue",
      items: [
        "Each question carries positive marks. Negative marking may apply.",
        "For multiple correct questions, partial marking may be available.",
        "Final score = Sum of marks obtained across all questions.",
      ],
    },
    {
      title: "Ranking & Leaderboard",
      icon: <BarChart2 size={18} />,
      tone: "sage",
      items: [
        "Rank is determined by score first, then time taken (less time = higher rank).",
        "Leaderboard updates in real-time during the test.",
        "Final rankings are declared after the test ends.",
      ],
    },
    ...(data.hasPrizes
      ? [{
          title: "Prizes",
          icon: <Trophy size={18} />,
          tone: "yellow" as const,
          items: [
            `1st Prize: ₹${data.firstPrize} | 2nd Prize: ₹${data.secondPrize} | 3rd Prize: ₹${data.thirdPrize}`,
            "Prize money will be credited to the winner's Testkart wallet after the test ends.",
            "Winners can withdraw prize money to their bank account.",
          ],
        }]
      : []),
    {
      title: "Attempt Rules",
      icon: <Clock size={18} />,
      tone: "peach",
      items: [
        "Only one attempt is allowed per student.",
        "Once you submit the test, you cannot re-attempt.",
        "Test will auto-submit when the time expires.",
        "You must be enrolled to attempt the test.",
      ],
    },
    {
      title: "Enrollment & Refund",
      icon: <CreditCard size={18} />,
      tone: "blue",
      items: [
        `Seats are limited (Max seats: ${data.maxSeats}).`,
        "Registration closes at the deadline or when all seats are filled.",
        "No refund once enrolled in the contest.",
      ],
    },
    {
      title: "Disclaimer",
      icon: <ShieldAlert size={18} />,
      tone: "lavender",
      items: [
        "Testkart does not proctor the test or verify student identity.",
        "Quality and correctness of questions solely depends upon the teacher who hosts this live test.",
        "By enrolling, you agree to the above rules and Testkart's Terms of Service.",
      ],
    },
  ];

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
        image={data.thumbnailUrl || Placeholder.LIVE}
      />
      <div className={styles.pageContainer}>
        <LiveTestHero liveTest={data} />

        <div className={styles.contentContainer}>
          {!data.isEnrolled && data.price > 0 && (
            <PublicCouponsCard itemType="live_test" itemId={data.id} playful />
          )}
          <div className={styles.tabs} role="group" aria-label="Competition sections">
            <button
              type="button"
              className={playfulButtonClass(activeTab === "about" ? "primary" : "soft", "md")}
              aria-pressed={activeTab === "about"}
              onClick={() => setActiveTab("about")}
            >
              <BookOpen /> About
            </button>
            <button
              type="button"
              className={playfulButtonClass(activeTab === "leaderboard" ? "primary" : "soft", "md")}
              aria-pressed={activeTab === "leaderboard"}
              onClick={() => setActiveTab("leaderboard")}
            >
              <BarChart2 /> Leaderboard
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
                
                <section className={styles.rulesSection} aria-labelledby="live-rules-heading">
                  <div className={styles.rulesHeader}>
                    <span className={styles.rulesHeaderIcon}>
                      <ListChecks size={20} aria-hidden="true" />
                    </span>
                    <h2 id="live-rules-heading" className={styles.rulesHeading}>Comprehensive Rules & Information</h2>
                  </div>
                  <div className={styles.rulesGrid}>
                    {ruleCards.map((card) => (
                      <article key={card.title} className={`${styles.ruleCard} ${styles[`tone_${card.tone}`]}`}>
                        <header className={styles.ruleHeader}>
                          <span className={styles.ruleIconTile}>{card.icon}</span>
                          <h3 className={styles.ruleTitle}>{card.title}</h3>
                        </header>
                        <ul className={styles.ruleList}>
                          {card.items.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>

                

                <div className={styles.teacherSection}>
                  <h2>About the Host</h2>
                                    <TeacherProfileCard 
                    variant="compact"
                    tone="soft"
                    teacher={{
                      id: data.teacherProfile.id,
                      displayName: data.teacherProfile.name,
                      avatarUrl: data.teacherProfile.avatarUrl,
                      slug: data.teacherSlug,
                      bio: data.teacherProfile.bio,
                      websiteUrl: data.teacherProfile.websiteUrl,
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
            {activeTab === null && (
              <div className={styles.tabLoading} aria-busy="true">
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonText} style={{ width: "80%" }} />
                <Skeleton className={styles.skeletonText} style={{ width: "60%" }} />
              </div>
            )}
            {activeTab === "leaderboard" && (
                            <LiveTestLeaderboard 
                liveTestId={data.id} 
                autoRefresh 
              />
            )}
          </div>

          <TeacherCtaBanner className={styles.earnBanner} tone="soft" />
        </div>
      </div>
    </>
  );
};

export default LiveTestDetailsPage;