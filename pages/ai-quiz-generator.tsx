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
  BookOpenCheck,
  Brain,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Gamepad2,
  Home,
  Lightbulb,
  ListChecks,
  MessageSquare,
  PencilLine,
  Presentation,
  Repeat,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Target,
  ToggleRight,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import styles from "./ai-quiz-generator.module.css";

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

const AiQuizGeneratorPage: React.FC = () => {
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
        <title>AI Quiz Generator for Educators | Testkart</title>
        <meta
          name="description"
          content="Create engaging, interactive quizzes in seconds with Testkart's AI Quiz Generator. Perfect for teachers, trainers, and educators to build gamified assessments and boost student learning."
        />
        <link rel="canonical" href="https://testkart.in/ai-quiz-generator" />
        <meta property="og:title" content="AI Quiz Generator for Educators | Testkart" />
        <meta property="og:description" content="Automate quiz creation with our powerful AI quiz maker. Generate multiple choice, true/false, fill-in-the-blanks, and more. Save time and increase student engagement." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://testkart.in/ai-quiz-generator" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "AI Quiz Generator for Educators",
            "description": "Discover Testkart's AI-powered tool to generate interactive quizzes and assessments automatically. Save time, ensure quality, and make learning fun.",
            "url": "https://testkart.in/ai-quiz-generator",
            "keywords": "AI quiz generator, quiz maker for teachers, automated quiz creation, quiz generator for educators, AI quiz maker",
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
              <span>Make Learning Fun</span>
            </div>
            <h1 className={styles.heroHeadline}>
              AI Quiz Generator for Educators
            </h1>
            <p className={styles.heroSubheadline}>
              Instantly create engaging quizzes that make learning interactive. Turn any topic into a fun, gamified assessment and get instant feedback on student understanding.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Create a Quiz for Free <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="#how-it-works">See How It Works</Link>
              </Button>
            </div>
            <p className={styles.heroNote}>
              ✓ Free to start ✓ Gamified learning ✓ Instant feedback
            </p>
          </div>
        </section>

        {/* What Makes Quizzes Special Section */}
        <section className={styles.specialSection}>
          <div className={styles.sectionHeader}>
            <h2>More Than a Test, It's an Experience</h2>
            <p>Discover why quizzes are a powerful tool for modern education.</p>
          </div>
          <div className={styles.specialGrid}>
            <div className={styles.specialCard}>
              <div className={styles.specialIcon}><Gamepad2 /></div>
              <h3>Engaging & Interactive</h3>
              <p>Move beyond static questions with dynamic formats that capture student attention and participation.</p>
            </div>
            <div className={styles.specialCard}>
              <div className={styles.specialIcon}><Clock /></div>
              <h3>Quick Knowledge Checks</h3>
              <p>Assess understanding in minutes, not hours. Perfect for starting or ending a class on a high note.</p>
            </div>
            <div className={styles.specialCard}>
              <div className={styles.specialIcon}><Sparkles /></div>
              <h3>Gamification Elements</h3>
              <p>Incorporate points, timers, and leaderboards to foster a healthy, competitive, and fun learning environment.</p>
            </div>
            <div className={styles.specialCard}>
              <div className={styles.specialIcon}><MessageSquare /></div>
              <h3>Instant Feedback</h3>
              <p>Students learn immediately from their mistakes with automated scoring and explanations, reinforcing concepts.</p>
            </div>
          </div>
        </section>

        {/* AI Features Section */}
        <section className={styles.aiFeaturesSection}>
          <div className={styles.sectionHeader}>
            <h2>Your AI-Powered Quiz Co-Pilot</h2>
            <p>Generate a variety of question types with unparalleled ease and control.</p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><ListChecks /></div>
              <h3>Multiple Choice Questions</h3>
              <p>Instantly generate MCQs with smart, plausible distractors that truly test student knowledge.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><ToggleRight /></div>
              <h3>True/False Questions</h3>
              <p>Quickly create a series of true or false statements to check factual recall and comprehension.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><PencilLine /></div>
              <h3>Fill in the Blanks</h3>
              <p>AI identifies key terms in your content and automatically creates fill-in-the-blank questions.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Shuffle /></div>
              <h3>Match the Following</h3>
              <p>Generate matching questions to test connections between concepts, terms, and definitions.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target /></div>
              <h3>Difficulty Level Control</h3>
              <p>Tailor your quiz to any learning level, from introductory concepts to advanced topics, with a simple slider.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Brain /></div>
              <h3>Topic-Specific Generation</h3>
              <p>Provide any topic, from history to quantum physics, and our AI will generate relevant, accurate questions.</p>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className={styles.benefitsSection}>
          <div className={styles.sectionHeader}>
            <h2>Transform Your Teaching Workflow</h2>
            <p>Save time, boost engagement, and improve learning outcomes.</p>
          </div>
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Save /></div>
              <h3>Save Time Instantly</h3>
              <p>Cut down on prep time and focus on teaching. Create a comprehensive quiz in seconds.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Users /></div>
              <h3>Increase Student Engagement</h3>
              <p>Turn passive learning into active participation with fun, game-like quizzes.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><ClipboardCheck /></div>
              <h3>Perfect for Formative Assessments</h3>
              <p>Get real-time insights into student understanding without the pressure of a formal test.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Repeat /></div>
              <h3>Ideal for Quick Revision</h3>
              <p>Help students reinforce key concepts before exams with targeted review quizzes.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Presentation /></div>
              <h3>Interactive Classroom Activities</h3>
              <p>Launch live quizzes in your classroom to create a dynamic and collaborative learning experience.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIcon}><Brain /></div>
              <h3>Boost Knowledge Retention</h3>
              <p>Gamified learning and instant feedback are proven to improve long-term memory and recall.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.howItWorksSection} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>Create a Quiz in 4 Simple Steps</h2>
            <p>From concept to classroom in under a minute.</p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Enter Topic</h3>
              <p>Provide a topic, keyword, or learning objective. You can even paste text for context.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Select Format</h3>
              <p>Choose your desired quiz format (e.g., MCQ, True/False) and set the difficulty level.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Generate Quiz</h3>
              <p>Our AI instantly crafts a set of questions, complete with answers and explanations.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>4</div>
              <h3>Customize & Publish</h3>
              <p>Review, edit, and fine-tune the questions before publishing the quiz for your students.</p>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className={styles.useCasesSection}>
          <div className={styles.sectionHeader}>
            <h2>For Every Kind of Educator</h2>
            <p>Testkart's AI Quiz Generator is a versatile tool for any learning environment.</p>
          </div>
          <div className={styles.useCasesGrid}>
            <div className={styles.useCaseCard}><h4>Classroom Teachers</h4><p>For quick knowledge checks and exit tickets.</p></div>
            <div className={styles.useCaseCard}><h4>Online Educators</h4><p>For engaging remote and hybrid learning.</p></div>
            <div className={styles.useCaseCard}><h4>Coaching Institutes</h4><p>For regular practice and topic revision.</p></div>
            <div className={styles.useCaseCard}><h4>Corporate Trainers</h4><p>For skills assessment and training reinforcement.</p></div>
            <div className={styles.useCaseCard}><h4>Homeschooling Parents</h4><p>For personalized and adaptive learning paths.</p></div>
          </div>
        </section>

        {/* Quiz Types Section */}
        <section className={styles.quizTypesSection}>
          <div className={styles.sectionHeader}>
            <h2>A Quiz for Every Occasion</h2>
            <p>Create the perfect assessment for any teaching scenario.</p>
          </div>
          <div className={styles.quizTypesGrid}>
            <div className={styles.quizTypeItem}><Zap size={20} /> Pop Quizzes</div>
            <div className={styles.quizTypeItem}><BookOpenCheck size={20} /> Review Quizzes</div>
            <div className={styles.quizTypeItem}><Home size={20} /> Practice Quizzes</div>
            <div className={styles.quizTypeItem}><Trophy size={20} /> Competitive Quizzes</div>
            <div className={styles.quizTypeItem}><Search size={20} /> Diagnostic Quizzes</div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsContent}>
            <div className={styles.statsHeader}>
              <h2>Trusted by Innovative Educators</h2>
              <p>Join a community that's making learning more effective and fun.</p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}><h4>5 Million+</h4><p>Quizzes Generated</p></div>
              <div className={styles.statCard}><h4>+40%</h4><p>Increase in Engagement</p></div>
              <div className={styles.statCard}><h4>250,000+</h4><p>Hours Saved</p></div>
              <div className={styles.statCard}><h4>99.2%</h4><p>AI Question Accuracy</p></div>
            </div>
          </div>
        </section>

        {/* Subscription Plans Section */}
        <section className={styles.subscriptionPlansSection}>
          <div className={styles.sectionHeader}>
            <h2>Plans That Fit Your Needs</h2>
            <p>Start for free and unlock more power as you grow.</p>
          </div>
          <TeacherSubscriptionPlans />
        </section>

        {/* Contact Form Section */}
        <section className={styles.contactSection}>
          <div className={styles.sectionHeader}>
            <h2>Questions or Need a Demo?</h2>
            <p>Our team is here to help you revolutionize your assessments.</p>
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
            <p>Your questions about AI quiz generation, answered.</p>
          </div>
          <div className={styles.faqContainer}>
            <Accordion type="single" collapsible>
              <AccordionItem value="faq-1">
                <AccordionTrigger>What's the difference between a quiz and a test?</AccordionTrigger>
                <AccordionContent>A quiz is typically shorter, more informal, and focuses on a small amount of material, often used for quick knowledge checks (formative assessment). A test is usually more formal, longer, and covers a wider range of material to measure mastery (summative assessment). Our <Link to="/ai-mock-test-generator">AI Mock Test Generator</Link> is perfect for the latter.</AccordionContent>
              </AccordionItem>
                            <AccordionItem value="faq-2">
                <AccordionTrigger>How accurate are the AI-generated quiz questions?</AccordionTrigger>
                <AccordionContent>Our AI is trained on a vast library of educational materials to ensure high accuracy and relevance. We always recommend a quick review by the educator to ensure the questions perfectly match the specific context of their lesson.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>Can I edit the generated questions?</AccordionTrigger>
                <AccordionContent>Absolutely. You have full editorial control. You can easily edit, delete, or add your own questions to any quiz generated by the AI to ensure it meets your exact standards.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-4">
                <AccordionTrigger>What subjects are supported?</AccordionTrigger>
                <AccordionContent>Our AI is designed to be subject-agnostic. It can generate quizzes for a vast range of subjects, from STEM and humanities to vocational training and languages. If you can provide a topic, our AI can create a quiz for it.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-5">
                <AccordionTrigger>How long does it take to generate a quiz?</AccordionTrigger>
                <AccordionContent>It takes just a few seconds. Simply provide your topic and parameters, and our AI will generate a complete quiz almost instantly, saving you valuable preparation time.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Make Learning More Engaging?</h2>
            <p>Start creating fun, interactive quizzes today and see the difference it makes in your classroom.</p>
            <div className={styles.finalCtaActions}>
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">Start for Free - No Credit Card Required</Link>
              </Button>
            </div>
            <p className={styles.finalCtaNote}>
              ✓ Instant Quiz Creation ✓ Gamified Assessments ✓ Boost Student Retention
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default AiQuizGeneratorPage;