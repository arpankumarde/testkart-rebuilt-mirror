import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { BookDemoButton } from "../components/BookDemoButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/Tabs";
import { Button } from "../components/Button";
import {
  ArrowRight,
  CalendarClock,
  Users,
  BarChart3,
  Gift,
  DollarSign,
  Crown,
  Rocket,
  Award,
  Target,
  Zap,
  Clock,
  Trophy,
  Globe,
  Sparkles,
  CreditCard,
  FileText,
  Share2,
  Wallet
} from "lucide-react";
import { SellPageTestimonials } from "../components/SellPageTestimonials";
import styles from "./sell.host-live-exam.module.css";

const LiveMockTestPage: React.FC = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://testkart.in/sell/host-live-exam",
        "url": "https://testkart.in/sell/host-live-exam",
        "name": "Host Live Mock Test Contests | Testkart",
        "description": "Launch exciting live mock test contests on Testkart. Engage students with real-time leaderboards, prize pools, and competitive exams. Earn 3x more and build a viral student community."
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://testkart.in/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Sell",
            "item": "https://testkart.in/sell"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Host Live Exam",
            "item": "https://testkart.in/sell/host-live-exam"
          }
        ]
      },
      {
        "@type": "Service",
        "name": "Host Live Mock Test Contests",
        "provider": {
          "@type": "Organization",
          "name": "Testkart",
          "url": "https://testkart.in/"
        },
        "description": "Launch exciting live mock test contests on Testkart. Engage students with real-time leaderboards, prize pools, and competitive exams. Earn 3x more and build a viral student community.",
        "url": "https://testkart.in/sell/host-live-exam"
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do prizes and entry fees work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "You set the entry fee for students. A percentage of the total collection forms the prize pool, which you can distribute among top rankers as you see fit. Testkart handles the collection and distribution automatically, deducting a small platform fee."
            }
          },
          {
            "@type": "Question",
            "name": "Can I offer free live contests?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes! Free contests are a fantastic way to attract a large number of students and promote your paid test series. You can run free contests to build your brand and create a funnel for your premium content."
            }
          },
          {
            "@type": "Question",
            "name": "What happens if a student's internet disconnects?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Our platform is designed to be resilient. If a student disconnects, their timer pauses. They can rejoin the test as long as the contest window is still active. Their progress is saved automatically."
            }
          },
          {
            "@type": "Question",
            "name": "How is ranking determined in case of a tie?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Ranking is based on two factors: score and time taken. If two students have the same score, the one who completed the test faster will be ranked higher. This ensures fair and decisive results."
            }
          },
          {
            "@type": "Question",
            "name": "Do I need to create new questions for every contest?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Not at all. You can reuse any of your existing mock tests to create a live contest. Simply select a test from your library, set the contest parameters, and you're ready to launch."
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <SEOHead
        title="Host Live Mock Test Contests"
        description="Launch exciting live mock test contests on Testkart. Engage students with real-time leaderboards, prize pools, and competitive exams. Earn 3x more and build a viral student community."
        url="https://testkart.in/sell/host-live-exam"
      />

      <div className={styles.pageWrapper}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeadline}>
              Host Live Mock Test Contests
            </h1>
            <p className={styles.heroSubheadline}>
              Turn your mock tests into thrilling live events. Engage thousands of students with real-time competition, live leaderboards, and automated prize pools. Maximize your earnings and build a viral brand.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Create Your First Contest <ArrowRight className={styles.btnIcon} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">
                  See How It Works
                </a>
              </Button>
            </div>
            <p className={styles.heroNote}>
              Free to Create <span className={styles.separator}>•</span> Real-Time Competition <span className={styles.separator}>•</span> Automated Prizes
            </p>
          </div>
        </section>

        {/* What is a Live Contest Section */}
        <section className={styles.whatIsSection}>
          <div className={styles.sectionHeader}>
            <h2>What is a Live Contest?</h2>
            <p>It's more than a test. It's a competitive event.</p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.cardIconWrapper}>
                <CalendarClock className={styles.cardIcon} />
              </div>
              <h3>Time-Bound Event</h3>
              <p>A live test happens at a specific date and time, creating urgency and excitement for all participants.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.cardIconWrapper}>
                <Users className={styles.cardIcon} />
              </div>
              <h3>Real-Time Competition</h3>
              <p>Thousands of students take the test simultaneously, competing against each other for the top ranks.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.cardIconWrapper}>
                <BarChart3 className={styles.cardIcon} />
              </div>
              <h3>Live Leaderboard</h3>
              <p>Students see their rank update in real-time as they answer questions, fueling their competitive spirit.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.cardIconWrapper}>
                <Gift className={styles.cardIcon} />
              </div>
              <h3>Prize Pools</h3>
              <p>Attract more participants by offering cash prizes or rewards for top performers, managed automatically by us.</p>
            </div>
          </div>
        </section>

        {/* Teacher Testimonials */}
        <SellPageTestimonials />

        {/* Why Launch Live Contests Section */}
        <section className={styles.whyCreateSection}>
          <div className={styles.sectionHeader}>
            <h2>Why Launch Live Contests?</h2>
            <p>Supercharge your growth and earnings on Testkart.</p>
          </div>
          
          <div className={styles.tabsContainer}>
            <Tabs defaultValue="revenue" className={styles.tabsRoot}>
              <TabsList className={styles.tabsList}>
                <TabsTrigger value="revenue" className={styles.tabTrigger}>Revenue</TabsTrigger>
                <TabsTrigger value="growth" className={styles.tabTrigger}>Growth</TabsTrigger>
                <TabsTrigger value="automation" className={styles.tabTrigger}>Automation</TabsTrigger>
              </TabsList>
              
              <TabsContent value="revenue" className={styles.tabContent}>
                <div className={styles.benefitsGrid}>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <DollarSign className={styles.cardIcon} />
                    </div>
                    <h3>Earn 3x More</h3>
                    <p>Live contests have higher perceived value, allowing you to set premium entry fees and maximize revenue from a single event.</p>
                  </div>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <Crown className={styles.cardIcon} />
                    </div>
                    <h3>Automated Ranking</h3>
                    <p>Our system handles all the complex calculations for leaderboards and final rankings instantly and accurately.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="growth" className={styles.tabContent}>
                <div className={styles.benefitsGrid}>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <Rocket className={styles.cardIcon} />
                    </div>
                    <h3>Create Viral Buzz</h3>
                    <p>The competitive nature encourages students to share contests with friends, creating organic marketing for your brand.</p>
                  </div>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <Users className={styles.cardIcon} />
                    </div>
                    <h3>Build Community</h3>
                    <p>Regular contests turn students into loyal followers who eagerly await your next event, building a strong community.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="automation" className={styles.tabContent}>
                <div className={styles.benefitsGrid}>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <Award className={styles.cardIcon} />
                    </div>
                    <h3>Effortless Prize Distribution</h3>
                    <p>We manage the entire prize distribution process, ensuring winners are paid promptly and correctly straight to their wallets.</p>
                  </div>
                  <div className={styles.benefitCard}>
                    <div className={styles.cardIconWrapper}>
                      <Target className={styles.cardIcon} />
                    </div>
                    <h3>Real-Time Analytics</h3>
                    <p>Track registrations, attendance, and performance as the contest happens, giving you valuable insights into student behavior.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.howItWorksSection} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>How It Works</h2>
            <p>Go from idea to live event in under an hour.</p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Set Up Contest</h3>
              <p>Choose your mock test, set the date, time, duration, entry fee, and prize pool. Our dashboard makes configuration simple and intuitive.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Promote Your Event</h3>
              <p>We'll list your contest on our platform. Share the unique link with your students and on social media to drive massive registrations.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Go Live & Earn</h3>
              <p>On contest day, watch the leaderboard light up. After the event, we handle results, automated prize distribution, and your payout directly to your bank account.</p>
            </div>
          </div>
          <div className={styles.ctaContainer}>
            <BookDemoButton size="lg" variant="outline" />
            <Button asChild size="lg" variant="secondary">
              <Link to="/teacher/signup">
                Start Your First Contest Now
              </Link>
            </Button>
          </div>
        </section>

        {/* Features Grid Section */}
        <section className={styles.allFeaturesSection}>
          <div className={styles.sectionHeader}>
            <h2>Packed with Powerful Features</h2>
            <p>Everything you need for a seamless and professional contest experience.</p>
          </div>
          <div className={styles.allFeaturesGrid}>
            <div className={styles.allFeatureItem}>
              <Zap className={styles.featureIconSmall} />
              <span>Real-Time Leaderboard</span>
            </div>
            <div className={styles.allFeatureItem}>
              <DollarSign className={styles.featureIconSmall} />
              <span>Automated Prize Calculation</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Clock className={styles.featureIconSmall} />
              <span>Live Countdown Timers</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Users className={styles.featureIconSmall} />
              <span>Registration Management</span>
            </div>
            <div className={styles.allFeatureItem}>
              <BarChart3 className={styles.featureIconSmall} />
              <span>Performance Analytics</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Trophy className={styles.featureIconSmall} />
              <span>Winner Announcements</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Globe className={styles.featureIconSmall} />
              <span>Public Contest Page</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Sparkles className={styles.featureIconSmall} />
              <span>AI Question Generation</span>
            </div>
            <div className={styles.allFeatureItem}>
              <CreditCard className={styles.featureIconSmall} />
              <span>Entry Fee Collection</span>
            </div>
            <div className={styles.allFeatureItem}>
              <FileText className={styles.featureIconSmall} />
              <span>Result Publishing</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Share2 className={styles.featureIconSmall} />
              <span>Share on WhatsApp/Social</span>
            </div>
            <div className={styles.allFeatureItem}>
              <Wallet className={styles.featureIconSmall} />
              <span>Student Wallet Integration</span>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsContent}>
            <div className={styles.statsHeader}>
              <h2>The Power of Live Competition</h2>
              <p>The numbers speak for themselves. Live contests are a game-changer for educators.</p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h4>10,000+</h4>
                <p>Live Tests Hosted</p>
              </div>
              <div className={styles.statCard}>
                <h4>₹2 Cr+</h4>
                <p>Prize Money Distributed</p>
              </div>
              <div className={styles.statCard}>
                <h4>₹15,000</h4>
                <p>Avg. Earnings Per Contest</p>
              </div>
              <div className={styles.statCard}>
                <h4>500%</h4>
                <p>Higher Student Engagement</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Live Contest FAQs</h2>
            <p>Your questions, answered.</p>
          </div>
          <div className={styles.faqContainer}>
            <Accordion type="single" collapsible>
              <AccordionItem value="faq-1">
                <AccordionTrigger>How do prizes and entry fees work?</AccordionTrigger>
                <AccordionContent>You set the entry fee for students. A percentage of the total collection forms the prize pool, which you can distribute among top rankers as you see fit. Testkart handles the collection and distribution automatically, deducting a small platform fee.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-2">
                <AccordionTrigger>Can I offer free live contests?</AccordionTrigger>
                <AccordionContent>Yes! Free contests are a fantastic way to attract a large number of students and promote your paid test series. You can run free contests to build your brand and create a funnel for your premium content.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>What happens if a student's internet disconnects?</AccordionTrigger>
                <AccordionContent>Our platform is designed to be resilient. If a student disconnects, their timer pauses. They can rejoin the test as long as the contest window is still active. Their progress is saved automatically.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-4">
                <AccordionTrigger>How is ranking determined in case of a tie?</AccordionTrigger>
                <AccordionContent>Ranking is based on two factors: score and time taken. If two students have the same score, the one who completed the test faster will be ranked higher. This ensures fair and decisive results.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-5">
                <AccordionTrigger>Do I need to create new questions for every contest?</AccordionTrigger>
                <AccordionContent>Not at all. You can reuse any of your existing mock tests to create a live contest. Simply select a test from your library, set the contest parameters, and you're ready to launch.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Launch Your First Live Contest?</h2>
            <p>Join thousands of educators transforming learning into an exciting, competitive event.</p>
            <div className={styles.finalCtaActions}>
              <BookDemoButton size="lg" variant="outline" />
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">Start Creating Free — No Credit Card Required</Link>
              </Button>
            </div>
            <p className={styles.finalCtaNote}>
              Automated Leaderboards <span className={styles.separator}>•</span> Secure Payouts <span className={styles.separator}>•</span> Viral Growth
            </p>
          </div>
        </section>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default LiveMockTestPage;