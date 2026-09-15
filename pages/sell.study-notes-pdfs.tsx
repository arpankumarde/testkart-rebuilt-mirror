import React, { useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { SEOHead } from "../components/SEOHead";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import { Button } from "../components/Button";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { BookDemoButton } from "../components/BookDemoButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { 
  ArrowRight, 
  FileText, 
  BookOpen, 
  HelpCircle, 
  Globe, 
  IndianRupee, 
  Wallet, 
  Users, 
  Languages, 
  Coins, 
  CheckCircle 
} from "lucide-react";
import { SellPageTestimonials } from "../components/SellPageTestimonials";
import styles from "./sell.study-notes-pdfs.module.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://testkart.in/sell/study-notes-pdfs",
      url: "https://testkart.in/sell/study-notes-pdfs",
      name: "Sell Study Notes & PDFs Online | Testkart",
      description: "Sell study notes and PDFs online to students preparing for UPSC, SSC, NEET, JEE & other exams. Earn passive income with Testkart.",
    },
    {
      "@type": "Service",
      name: "Sell Study Notes & PDFs Platform",
      provider: {
        "@type": "Organization",
        name: "Testkart",
        url: "https://testkart.in",
      },
      description: "Platform for educators to sell study notes, eBooks, and previous year papers.",
      areaServed: "IN",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://testkart.in",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Sell",
          item: "https://testkart.in/sell",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Study Notes & PDFs",
          item: "https://testkart.in/sell/study-notes-pdfs",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I receive payments?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can withdraw your earnings via UPI or direct bank transfer (NEFT/IMPS) to any Indian bank account. Payouts are processed within 2-3 business days.",
          },
        },
        {
          "@type": "Question",
          name: "Can I sell notes in Hindi or regional languages?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely! You can sell study notes in Hindi, English, or any regional language. Just mention the language clearly in your product description.",
          },
        },
        {
          "@type": "Question",
          name: "What file formats can I upload?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Currently, we accept PDF files as they are universally compatible and maintain formatting across all devices.",
          },
        },
        {
          "@type": "Question",
          name: "How much can I earn?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Earnings vary based on content quality and promotion. Since it's passive income, you can keep earning from the same notes for years without additional work.",
          },
        },
        {
          "@type": "Question",
          name: "Is my content protected from piracy?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Students can only access files after successful payment, and your notes open read-only inside Testkart's viewer instead of being handed over as a file. Every access is tracked. While no system is 100% piracy-proof, we implement best practices to protect your IP.",
          },
        },
        {
          "@type": "Question",
          name: "What is the platform fee?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Our fee structure is transparent. Free plan users pay a standard transaction fee per sale, which covers payment gateway charges, secure hosting, and support. There are no hidden charges.",
          },
        },
      ],
    },
  ],
};

const SellDigitalProductsPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay with sound failed, fallback to muted autoplay
          video.muted = true;
          video.play().catch(console.error);
        });
      }
    }
  }, []);

  return (
    <>
      <SEOHead
        title="Sell Study Notes & PDFs Online"
        description="Sell study notes and PDFs online to students preparing for UPSC, SSC, NEET, JEE & other exams. Earn passive income with Testkart."
        url="https://testkart.in/sell/study-notes-pdfs"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className={styles.pageWrapper}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeadline}>
              Sell Study Notes & PDFs Online
            </h1>
            <p className={styles.heroSubheadline}>
              Earn passive income from your educational content. Join thousands of Indian educators selling study notes online for UPSC, SSC, Banking, NEET, JEE, and other competitive exams. 
            </p>
            <video
              ref={videoRef}
              className={styles.heroVideo}
              src="https://cdn.testkart.in/marketing-assets/selling-notes-and-pdfs.mp4"
              autoPlay
              playsInline
              controls
            />
            <div className={styles.heroActions}>
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Start Selling Free <ArrowRight className={styles.btnIcon} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>
            <p className={styles.heroNote}>
              Zero Setup Fee &nbsp;&bull;&nbsp; UPI & Bank Transfer &nbsp;&bull;&nbsp; Hindi & English Support
            </p>
          </div>
        </section>

        {/* What You Can Sell Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>What You Can Sell</h2>
            <p>Monetize any educational content that helps students prepare for exams.</p>
          </div>
          <div className={styles.grid4}>
            <div className={styles.card}>
              <div className={styles.iconWrapper}>
                <FileText size={24} />
              </div>
              <h3>Handwritten & Typed Notes</h3>
              <p>Class notes, subject summaries, and revision notes for various state and national exams.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.iconWrapper}>
                <BookOpen size={24} />
              </div>
              <h3>eBooks & Study Guides</h3>
              <p>Comprehensive guides, formula books, and strategy manuals for entrance exams.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.iconWrapper}>
                <HelpCircle size={24} />
              </div>
              <h3>Previous Year Papers</h3>
              <p>Solved question papers and topic-wise practice sets with detailed solutions.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.iconWrapper}>
                <Globe size={24} />
              </div>
              <h3>Current Affairs & GK</h3>
              <p>Monthly current affairs compilations, GK capsules, and one-liners for quick revision.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.section} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>How It Works</h2>
            <p>From uploading to earning in three simple steps.</p>
          </div>
          <div className={styles.grid3}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Create Your Notes</h3>
              <p>Prepare high-quality study materials and save them as PDF files for universal compatibility.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Upload & Set Price</h3>
              <p>Upload your PDFs to Testkart, add descriptions, and set your own price in INR.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Share, Sell & Earn</h3>
              <p>Share your product links. When students buy, receive instant payouts directly to your bank or UPI.</p>
            </div>
          </div>
        </section>

        {/* Teacher Testimonials */}
        <SellPageTestimonials />

        {/* Why Testkart for Indian Educators */}
        <section className={styles.sectionAlt}>
          <div className={styles.sectionHeader}>
            <h2>Why Testkart for Indian Educators</h2>
            <p>Built specifically to help Indian teachers reach more students and earn more.</p>
          </div>
          
          <div className={styles.tabsContainer}>
            <Tabs defaultValue="payments">
              <div className={styles.tabsListWrapper}>
                <TabsList>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="reach">Reach & Exams</TabsTrigger>
                  <TabsTrigger value="tools">Business Tools</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="payments" className={styles.tabContent}>
                <div className={styles.grid2}>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <IndianRupee size={24} />
                    </div>
                    <h3>INR Pricing</h3>
                    <p>Set your prices in ₹ INR. Students pay in rupees, you earn in rupees. No confusing conversions.</p>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <Wallet size={24} />
                    </div>
                    <h3>UPI & Bank Payouts</h3>
                    <p>Get your earnings directly to your Indian bank account or via UPI quickly and securely.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reach" className={styles.tabContent}>
                <div className={styles.grid3}>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <BookOpen size={24} />
                    </div>
                    <h3>Designed for Indian Exams</h3>
                    <p>Optimized for UPSC, SSC, Banking, Railways, NEET, JEE, GATE, and all state-level exams.</p>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <Users size={24} />
                    </div>
                    <h3>Reach Lakhs of Students</h3>
                    <p>Connect with exam aspirants from metros to tier-3 cities across India seamlessly.</p>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <Languages size={24} />
                    </div>
                    <h3>Regional Language Support</h3>
                    <p>Sell notes in Hindi, English, or any regional language to cater to diverse linguistic needs.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tools" className={styles.tabContent}>
                <div className={styles.toolsLayout}>
                  <div className={styles.card}>
                    <div className={styles.iconWrapper}>
                      <Coins size={24} />
                    </div>
                    <h3>Low Platform Fees</h3>
                    <p>Keep more of what you earn with our transparent pricing and low transaction fees. No hidden charges.</p>
                  </div>
                  <div className={styles.featuresList}>
                    {[
                      "Secure Cloud Hosting",
                      "PDF Protection",
                      "Instant Delivery",
                      "PayU Integration",
                      "Sales Tracking",
                      "Analytics Dashboard",
                      "Content Management",
                      "Storefront Page",
                      "INR Pricing",
                      "Mobile-Friendly",
                      "Digital Wallet",
                      "Promo Codes"
                    ].map((feature, i) => (
                      <div key={i} className={styles.featureItem}>
                        <CheckCircle size={16} className={styles.featureIcon} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <h4>5,000+</h4>
              <p>Notes Listed</p>
            </div>
            <div className={styles.statItem}>
              <h4>₹50 Lakh+</h4>
              <p>Paid to Educators</p>
            </div>
            <div className={styles.statItem}>
              <h4>2 Lakh+</h4>
              <p>Students Served</p>
            </div>
            <div className={styles.statItem}>
              <h4>95%</h4>
              <p>Satisfaction</p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className={styles.faqWrapper}>
            <Accordion type="single" collapsible>
              <AccordionItem value="faq-1">
                <AccordionTrigger>How do I receive payments?</AccordionTrigger>
                <AccordionContent>
                  You can withdraw your earnings via UPI or direct bank transfer (NEFT/IMPS) to any Indian bank account. Payouts are processed within 2-3 business days.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-2">
                <AccordionTrigger>Can I sell notes in Hindi or regional languages?</AccordionTrigger>
                <AccordionContent>
                  Absolutely! You can sell study notes in Hindi, English, or any regional language. Just mention the language clearly in your product description.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>What file formats can I upload?</AccordionTrigger>
                <AccordionContent>
                  Currently, we accept PDF files as they are universally compatible and maintain formatting across all devices.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-4">
                <AccordionTrigger>How much can I earn?</AccordionTrigger>
                <AccordionContent>
                  Earnings vary based on content quality and promotion. Since it's passive income, you can keep earning from the same notes for years without additional work.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-5">
                <AccordionTrigger>Is my content protected from piracy?</AccordionTrigger>
                <AccordionContent>
                  Students can only access files after successful payment, and your notes open read-only inside Testkart's viewer instead of being handed over as a file. Every access is tracked. While no system is 100% piracy-proof, we implement best practices to protect your IP.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-6">
                <AccordionTrigger>What is the platform fee?</AccordionTrigger>
                <AccordionContent>
                  Our fee structure is transparent. Free plan users pay a standard transaction fee per sale, which covers payment gateway charges, secure hosting, and support. There are no hidden charges.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Start Earning?</h2>
            <p>Join thousands of Indian educators who are building passive income streams.</p>
            <div className={styles.finalCtaActions}>
              <BookDemoButton size="lg" variant="outline" />
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">Create Free Account <ArrowRight className={styles.btnIcon} /></Link>
              </Button>
            </div>
          </div>
        </section>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellDigitalProductsPage;