import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { postTeacherInquiry } from "../endpoints/teacher/inquiry_POST.schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { TeacherSubscriptionPlans } from "../components/TeacherSubscriptionPlans";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Layers,
  Lightbulb,
  Rocket,
  Save,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import styles from "./ai-mock-test-generator.module.css";

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  instituteName: z.string().optional(),
  message: z.string().optional(),
  captcha: z.string().refine((val) => val === "15", {
    message: "Incorrect answer. Please try again.",
  }),
});

type ContactFormInputs = z.infer<typeof contactFormSchema>;

const AiMockTestGeneratorPage: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormInputs>({
    resolver: zodResolver(contactFormSchema),
  });

  const onFormSubmit: SubmitHandler<ContactFormInputs> = async (data) => {
    try {
      const { captcha, ...inquiryData } = data;
      const result = await postTeacherInquiry(inquiryData);
      toast.success(
        result.message || "Thank you! Our team will contact you shortly."
      );
      reset();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit inquiry. Please try again.";
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Helmet>
        <title>AI Mock Test Generator for Teachers and Coaching Institutes | Testkart</title>
        <meta
          name="description"
          content="Save 90% of your time with Testkart's AI Mock Test Generator. Create high-quality, curriculum-aligned questions for any subject in seconds. Perfect for teachers and coaching institutes."
        />
        <link rel="canonical" href="https://testkart.in/ai-mock-test-generator" />
        <meta property="og:title" content="AI Mock Test Generator for Teachers and Coaching Institutes | Testkart" />
        <meta property="og:description" content="Automate test creation with our powerful AI question generator. Generate MCQs, True/False, and more. Control difficulty, customize topics, and build your question bank effortlessly." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://testkart.in/ai-mock-test-generator" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "AI Mock Test Generator for Teachers and Coaching Institutes",
            "description": "Discover Testkart's AI-powered tool to generate mock tests and question banks automatically. Save time, ensure quality, and focus on teaching.",
            "url": "https://testkart.in/ai-mock-test-generator",
            "keywords": "AI mock test generator, question generator for teachers, AI question bank, automated test creation",
            "provider": {
              "@type": "EducationalOrganization",
              "name": "Testkart"
            }
          })}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <div className={styles.heroLabel}>
              <Sparkles className={styles.labelIcon} />
              <span>Powered by Advanced AI</span>
            </div>
            <h1 className={styles.heroHeadline}>
              AI Mock Test Generator for Teachers and Coaching Institutes
            </h1>
            <p className={styles.heroSubheadline}>
              Stop wasting hours on manual question creation. Generate high-quality, curriculum-aligned mock tests in seconds and focus on what truly matters: teaching.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Get Started for Free <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="#how-it-works">See How It Works</Link>
              </Button>
            </div>
            <p className={styles.heroNote}>
              ✓ No credit card required ✓ 100 free AI questions on signup
            </p>
          </div>
        </section>

        {/* Benefits Section */}
        <section className={styles.benefitsSection}>
          <div className={styles.sectionHeader}>
            <h2>The Smarter Way to Create Tests</h2>
            <p>Unlock efficiency and quality with our AI-powered platform.</p>
          </div>
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Clock /></div>
              <h3>Save 90% of Your Time</h3>
              <p>Go from topic to a full-fledged mock test in under 60 seconds. Reclaim hours of your week from tedious manual work.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><BrainCircuit /></div>
              <h3>Superior Question Quality</h3>
              <p>Our AI is trained on vast educational datasets to generate relevant, accurate, and thought-provoking questions.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Layers /></div>
              <h3>Diverse Question Formats</h3>
              <p>Effortlessly generate MCQs, True/False, Fill-in-the-blanks, and more to create comprehensive assessments.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Zap /></div>
              <h3>Instant Test Creation</h3>
              <p>No more writer's block. Provide a topic, and our AI instantly populates your test with ready-to-use questions.</p>
            </div>
          </div>
        </section>

        {/* AI Features Section */}
        <section className={styles.aiFeaturesSection}>
          <div className={styles.sectionHeader}>
            <h2>Unleash the Power of AI</h2>
            <p>Advanced features designed for complete control and customization.</p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Lightbulb /></div>
              <h3>AI Question Generation</h3>
              <p>Simply input your topic, syllabus, or even a block of text, and let our AI craft precise questions with detailed explanations.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target /></div>
              <h3>Difficulty Level Control</h3>
              <p>Fine-tune your tests by specifying the difficulty level (Easy, Medium, Hard) to match your students' learning stage.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><FileText /></div>
              <h3>Subject & Topic Customization</h3>
              <p>Generate questions for any subject and topic, from K-12 to competitive exams like JEE, NEET, and UPSC.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Rocket /></div>
              <h3>Bulk Question Generation</h3>
              <p>Need a large volume of questions? Generate hundreds of unique questions at once to build a robust question bank.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Database /></div>
              <h3>Smart Question Bank</h3>
              <p>All generated questions are automatically saved to your private, searchable question bank for easy reuse and management.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><CheckCircle /></div>
              <h3>Review & Edit</h3>
              <p>You have the final say. Easily review, edit, or regenerate any question to ensure it perfectly fits your standards.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.howItWorksSection} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>Generate a Test in 4 Simple Steps</h2>
            <p>Our intuitive process makes test creation effortless.</p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Select Subject & Topic</h3>
              <p>Choose from a wide range of subjects or enter your custom topic. You can even paste text or a URL for context.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Set Your Parameters</h3>
              <p>Specify the number of questions, desired format (e.g., MCQ), and difficulty level for your test.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Generate with One Click</h3>
              <p>Our AI analyzes your input and generates a complete set of questions with answers and explanations in seconds.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>4</div>
              <h3>Review & Publish</h3>
              <p>Fine-tune the generated questions, add them to your test, and publish it to start assessing your students.</p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsContent}>
            <div className={styles.statsHeader}>
              <h2>Join the Revolution in Education</h2>
              <p>Thousands of educators are already saving time and enhancing their teaching with Testkart AI.</p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}><h4>10 Million+</h4><p>AI Questions Generated</p></div>
              <div className={styles.statCard}><h4>500,000+</h4><p>Hours Saved for Teachers</p></div>
              <div className={styles.statCard}><h4>50,000+</h4><p>Educators on Platform</p></div>
              <div className={styles.statCard}><h4>98%</h4><p>Satisfaction Rate</p></div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className={styles.useCasesSection}>
          <div className={styles.sectionHeader}>
            <h2>Perfect for Every Educator</h2>
            <p>Testkart's AI generator is versatile enough to meet diverse teaching needs.</p>
          </div>
          <div className={styles.useCasesGrid}>
            <div className={styles.useCaseCard}>
              <h4>Individual Teachers</h4>
              <p>Quickly create chapter-end quizzes, homework assignments, and practice tests.</p>
            </div>
            <div className={styles.useCaseCard}>
              <h4>Coaching Institutes</h4>
              <p>Build extensive question banks and full-length mock tests for competitive exams.</p>
            </div>
            <div className={styles.useCaseCard}>
              <h4>Online Tutors</h4>
              <p>Generate personalized assessments for one-on-one sessions and group classes.</p>
            </div>
            <div className={styles.useCaseCard}>
              <h4>Content Creators</h4>
              <p>Rapidly produce high-quality question content for your educational apps and platforms.</p>
            </div>
          </div>
        </section>

        {/* Subscription Plans Section */}
        <section className={styles.subscriptionPlansSection}>
          <div className={styles.sectionHeader}>
            <h2>Flexible Plans for Every Need</h2>
            <p>Start for free and scale as you grow. All plans include our powerful AI generator.</p>
          </div>
          <TeacherSubscriptionPlans />
        </section>

        {/* Contact Form Section */}
        <section className={styles.contactSection}>
          <div className={styles.sectionHeader}>
            <h2>Have a Question or Need a Demo?</h2>
            <p>Our team is ready to help you integrate AI into your teaching workflow.</p>
          </div>
          <form onSubmit={handleSubmit(onFormSubmit)} className={styles.contactForm} noValidate>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label htmlFor="name">Name</label>
                <Input id="name" {...register("name")} placeholder="Your Name" />
                {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}
              </div>
              <div className={styles.formField}>
                <label htmlFor="email">Email</label>
                <Input id="email" type="email" {...register("email")} placeholder="your.email@example.com" />
                {errors.email && <p className={styles.errorMessage}>{errors.email.message}</p>}
              </div>
              <div className={styles.formField}>
                <label htmlFor="phone">Phone Number</label>
                <Input id="phone" type="tel" {...register("phone")} placeholder="Your Phone Number" />
                {errors.phone && <p className={styles.errorMessage}>{errors.phone.message}</p>}
              </div>
              <div className={styles.formField}>
                <label htmlFor="instituteName">Institute Name (Optional)</label>
                <Input id="instituteName" {...register("instituteName")} placeholder="Your Institute's Name" />
              </div>
            </div>
            <div className={styles.formField}>
              <label htmlFor="message">Message (Optional)</label>
              <Textarea id="message" {...register("message")} placeholder="Tell us about your requirements" rows={4} />
            </div>
            <div className={styles.formField}>
              <label htmlFor="captcha">Solve: 7 + 8 = ?</label>
              <Input id="captcha" type="number" {...register("captcha")} placeholder="Your Answer" className={styles.captchaInput} />
              {errors.captcha && <p className={styles.errorMessage}>{errors.captcha.message}</p>}
            </div>
            <Button type="submit" size="lg" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Request a Callback"}
            </Button>
          </form>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about our AI Test Generator.</p>
          </div>
          <div className={styles.faqContainer}>
            <Accordion type="single" collapsible>
              <AccordionItem value="faq-1">
                <AccordionTrigger>How accurate are the AI-generated questions?</AccordionTrigger>
                <AccordionContent>Our AI is trained on a massive corpus of high-quality educational content, resulting in highly accurate and relevant questions. However, we always recommend a quick review by a subject matter expert, which is why we provide easy editing tools.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-2">
                <AccordionTrigger>Can I generate questions from my own content?</AccordionTrigger>
                <AccordionContent>Absolutely! You can paste text directly, provide a URL to a webpage, or upload a document. Our AI will analyze your content and generate questions based on it, ensuring perfect alignment with your curriculum.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>Which subjects and exams are supported?</AccordionTrigger>
                <AccordionContent>Our AI is versatile and can generate questions for virtually any subject, from primary school science to advanced topics for competitive exams like JEE, NEET, UPSC, Banking, and more. You can define custom subjects and topics as needed.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-4">
                <AccordionTrigger>How does the pricing work for the AI generator?</AccordionTrigger>
                <AccordionContent>Access to the AI question generator is included in all our teacher plans, including the free plan. Each plan comes with a specific number of AI question credits per month. You can find more details in the subscription plans section above.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-5">
                <AccordionTrigger>Do I own the questions generated by the AI?</AccordionTrigger>
                <AccordionContent>Yes. Any questions you generate and save to your question bank are your intellectual property. You have full control to use, edit, and sell them as part of your mock test series on the Testkart platform.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Automate Your Test Creation?</h2>
            <p>Join 50,000+ educators who are building better tests in less time.</p>
            <div className={styles.finalCtaActions}>
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">Start Generating for Free</Link>
              </Button>
            </div>
            <p className={styles.finalCtaNote}>
              ✓ Instant Question Generation ✓ Full Editorial Control ✓ Boost Your Productivity
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default AiMockTestGeneratorPage;