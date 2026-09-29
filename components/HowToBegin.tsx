import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import styles from "./HowToBegin.module.css";

const STEPS = [
  {
    id: "plan",
    label: "Plan your content",
    paragraphs: [
      "Start with what you know best. Choose a subject, define your audience, and plan the learning experience you want to create.",
      "A full test series for an exam or a single practice set: the way you teach, and what you bring to it, is up to you.",
    ],
    help: "We provide the tools and resources you need to organize your content, create assessments, and build a valuable learning experience.",
    image: "/_cdn/static/9f9bc3b9-a25a-4af3-91f5-1c335a999b77.png",
  },
  {
    id: "create",
    label: "Create your test",
    paragraphs: [
      "Build mock tests and test series question by question, or draft questions with AI and edit every one before it goes out.",
      "Set sections, timing and marking to match the real exam, so students practise the way they will be tested.",
    ],
    help: "The test builder handles the format, from timers and negative marking to instant results, and step-by-step guide videos walk you through every screen.",
    image: "/_cdn/static/674f08b0-5473-4304-99e1-cd8aabd685b0.png",
  },
  {
    id: "publish",
    label: "Publish on Testkart",
    paragraphs: [
      "Set your price and submit your test. Our team reviews every new item before it goes live, so students can trust what they buy.",
      "Once it is live, students across India can find it, buy it and attempt it on any device.",
    ],
    help: "Track sales and student results from your dashboard. Earnings collect in your Testkart wallet and you withdraw them to your bank.",
    image: "/_cdn/static/53e62e81-69c9-4127-aaa4-1cf6b74cb86a.png",
  },
];

/** /teach: three-step walkthrough as centred underline tabs over a text + illustration panel. */
export const HowToBegin = () => (
  <section className={styles.section} aria-labelledby="how-to-begin-title">
    <h2 id="how-to-begin-title" className={styles.title}>
      How to begin
    </h2>
    <Tabs defaultValue={STEPS[0].id} className={styles.tabs}>
      <TabsList className={styles.list} aria-label="Steps to start teaching">
        {STEPS.map((step) => (
          <TabsTrigger key={step.id} value={step.id} className={styles.trigger}>
            {step.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {STEPS.map((step) => (
        <TabsContent key={step.id} value={step.id} className={styles.panel}>
          <div className={styles.copy}>
            {step.paragraphs.map((paragraph) => (
              <p key={paragraph} className={styles.text}>
                {paragraph}
              </p>
            ))}
            <h3 className={styles.helpTitle}>How we help you</h3>
            <p className={styles.text}>{step.help}</p>
          </div>
          <img
            src={step.image}
            alt=""
            width={768}
            height={1024}
            loading="lazy"
            decoding="async"
            className={styles.art}
          />
        </TabsContent>
      ))}
    </Tabs>
  </section>
);