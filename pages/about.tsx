import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  PenLine,
  Receipt,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { PlayfulButton } from "../components/PlayfulButton";
import { AboutReviews } from "../components/AboutReviews";
import styles from "./about.module.css";

/*
 * Page content lives here so copy, figures and image URLs can be edited without
 * touching markup. Optional blocks render only once they hold real content, so
 * an unfilled section is absent rather than showing an empty frame. Page order:
 * masthead, company facts, story, principles, team, reviews, closing panel.
 */

type Tone = "peach" | "lavender" | "sage" | "blue";

const IDENTITY: { label: string; value: string; icon: LucideIcon; tone: Tone }[] = [
  { label: "Legal name", value: "Digikind Education Private Limited", icon: Building2, tone: "peach" },
  { label: "Started", value: "2022", icon: CalendarDays, tone: "lavender" },
  { label: "Incorporated", value: "3 September 2024", icon: BadgeCheck, tone: "sage" },
  { label: "Office", value: "Noida, Uttar Pradesh", icon: MapPin, tone: "blue" },
];

/* Held back until there is a photograph worth running. Setting src brings the
   band back, between the company facts and the milestones. */
const TEAM_PHOTO: { src: string | null; alt: string; caption: string | null } = {
  src: null,
  alt: "The Testkart team at the Noida office",
  caption: null,
};

const FIGURES: { value: string | null; label: string }[] = [
  { value: null, label: "Students" },
  { value: null, label: "Tests published" },
  { value: null, label: "Teachers selling" },
  { value: null, label: "Exams covered" },
];

const MILESTONES: {
  year: string;
  date: string | null;
  title: string;
  body: string;
  tone: Tone;
}[] = [
  {
    year: "2022",
    date: null,
    title: "Testkart starts",
    body: "A place for teachers to publish the mock tests they were already writing, instead of passing them around a class.",
    tone: "peach",
  },
  {
    year: "2024",
    date: "3 September",
    title: "Digikind Education Private Limited",
    body: "Testkart is incorporated. The same product, now with a company behind it, and the paperwork a student can check.",
    tone: "sage",
  },
  {
    year: "2026",
    date: "3 August",
    title: "First office, in Noida",
    body: "The team stops working apart and moves into one room in Noida, Uttar Pradesh.",
    tone: "lavender",
  },
];

const PRINCIPLES: {
  statement: string;
  body: string;
  icon: LucideIcon;
  tone: Tone;
}[] = [
  {
    statement: "Teachers keep what they make.",
    body: "Material published on Testkart belongs to the teacher who wrote it. We take a share of what sells, not ownership of the work.",
    icon: PenLine,
    tone: "peach",
  },
  {
    statement: "A test is only useful if it behaves like the real one.",
    body: "Timing, negative marking, the mix of questions. Practice that flatters a student is worse than no practice at all.",
    icon: Timer,
    tone: "sage",
  },
  {
    statement: "No surprises in the price.",
    body: "What a student pays and what a teacher is paid are both visible before anything changes hands.",
    icon: Receipt,
    tone: "lavender",
  },
];

type Person = { name: string; role: string; photo: string | null };

/* Portraits live at https://cdn.testkart.in/team/<name-slug>.jpg. A card falls
   back to initials when photo is null and also when the file is not there yet,
   so a link can be written ahead of the upload. */
const PEOPLE: Person[] = [
  {
    name: "Hamraj Kumar",
    role: "Founder & CEO",
    photo: "https://cdn.testkart.in/team/hamraj-kumar.jpg",
  },
  {
    name: "Shivangi Malviya",
    role: "Product Marketing Lead",
    photo: "https://cdn.testkart.in/team/shivangi-malviya.jpg",
  },
  {
    name: "Arpan Kumar De",
    role: "Software Engineer",
    photo: "https://cdn.testkart.in/team/arpan.webp",
  },
  {
    name: "Suman Samal",
    role: "SEO Manager",
    photo: "https://cdn.testkart.in/team/suman-samal.jpg",
  },
  {
    name: "Balraj Kumar",
    role: "PR Advisor",
    photo: "https://cdn.testkart.in/team/balraj-singh.jpeg",
  },
  {
    name: "Param Grewal",
    role: "Creator Partnership Manager",
    photo: "https://cdn.testkart.in/team/param-grewal.jpg",
  },
  {
    name: "Soumya Yadav",
    role: "Social Media Executive",
    photo: "https://cdn.testkart.in/team/soumya-yadav.jpg",
  },
  {
    name: "Abhishek Gupta",
    role: "Customer Support Intern",
    photo: "https://cdn.testkart.in/team/abhishek-gupta.jpg",
  },
  {
    name: "Meet Tomar",
    role: "Market Research Intern",
    photo: "https://cdn.testkart.in/team/meet-tomar.jpg",
  },
  {
    name: "Pranjal Gautam",
    role: "Content Creator Executive",
    photo: "https://cdn.testkart.in/team/pranjal-gautam.jpg",
  },
  {
    name: "Sanjay Kumar",
    role: "Jr. Content Writer",
    photo: "https://cdn.testkart.in/team/sanjay-kumar.jpg",
  },
  {
    name: "Priya Mahato",
    role: "Software Developer Intern",
    photo: "https://cdn.testkart.in/team/priya-mahato.jpg",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

/* Illustrative preview of a Testkart mock test, framed by the three things the
   marketplace sells. Decorative, so it is hidden from assistive tech; the
   sample question is a real polity question with its correct answer marked,
   and nothing here is a statistic. */
const HERO_OPTIONS: { letter: string; text: string; correct?: boolean }[] = [
  { letter: "A", text: "Article 14" },
  { letter: "B", text: "Article 17", correct: true },
  { letter: "C", text: "Article 21" },
  { letter: "D", text: "Article 32" },
];

const HERO_PRODUCTS: { label: string; icon: LucideIcon; tone: Tone }[] = [
  { label: "Mock Tests", icon: FileText, tone: "peach" },
  { label: "Courses", icon: GraduationCap, tone: "lavender" },
  { label: "Study Notes", icon: BookOpen, tone: "sage" },
];

const HeroPreview: React.FC = () => (
  <div className={styles.visual} aria-hidden="true">
    <div className={styles.sheet}>
      <div className={styles.sheetTop}>
        <span className={`${styles.chip} ${styles.tone_lavender}`}>
          <FileText size={13} />
          Polity mock test
        </span>
        <span className={styles.timer}>
          <Clock size={13} />
          18:42
        </span>
      </div>

      <div className={styles.sheetQuestion}>
        <span className={styles.questionNo}>Question 4</span>
        <p className={styles.questionText}>
          Which article of the Constitution of India abolishes untouchability?
        </p>
      </div>

      <div className={styles.sheetOptions}>
        {HERO_OPTIONS.map((option) => (
          <div
            key={option.letter}
            className={option.correct ? `${styles.option} ${styles.optionOn}` : styles.option}
          >
            <span className={styles.optionLetter}>{option.letter}</span>
            <span className={styles.optionText}>{option.text}</span>
            {option.correct && <Check size={15} className={styles.optionCheck} />}
          </div>
        ))}
      </div>

      <div className={styles.sheetFoot}>
        <span className={`${styles.chip} ${styles.tone_sage}`}>
          <BadgeCheck size={13} />
          Written by teachers
        </span>
        <span className={styles.nextPill}>
          Next
          <ChevronRight size={14} />
        </span>
      </div>
    </div>

    <div className={styles.products}>
      {HERO_PRODUCTS.map((product) => (
        <div key={product.label} className={styles.product}>
          <span className={`${styles.productIcon} ${styles[`tone_${product.tone}`]}`}>
            <product.icon size={15} />
          </span>
          <span className={styles.productLabel}>{product.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const TeamMember: React.FC<{ person: Person }> = ({ person }) => {
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <li className={styles.person}>
      {person.photo && !imageFailed ? (
        <img
          src={person.photo}
          alt={person.name}
          className={styles.personPhoto}
          width={64}
          height={64}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={styles.personPhotoSlot} aria-hidden="true">
          {initials(person.name)}
        </div>
      )}
      <div className={styles.personText}>
        <p className={styles.personName}>{person.name}</p>
        <p className={styles.personRole}>{person.role}</p>
      </div>
    </li>
  );
};

const AboutPage: React.FC = () => {
  const figures = FIGURES.filter((figure) => figure.value);

  return (
    <>
      <Helmet>
        <title>About Testkart - Who we are and how we got here</title>
        <meta
          name="description"
          content="Testkart is a marketplace for exam practice written by the teachers who teach the exam. Read who runs it, how it started, and how it works."
        />
        <link rel="canonical" href="https://testkart.in/about" />
      </Helmet>

      <div className={styles.page}>
        <header className={styles.intro}>
          <div className={styles.introText}>
            <p className={styles.eyebrow}>About Testkart</p>
            <h1 className={styles.statement}>
              Exam practice, made by{" "}
              <mark className={styles.mark}>
                the people who actually teach the exam.
              </mark>
            </h1>
            <p className={styles.lede}>
              Testkart is a marketplace. Teachers publish mock tests, study
              notes and courses; students buy them and sit them. We run the
              platform, the payments and the delivery, so a teacher with good
              material does not have to build a business around it first.
            </p>
          </div>
          <HeroPreview />
        </header>

        <dl className={styles.identity}>
          {IDENTITY.map((row) => (
            <div key={row.label} className={styles.identityItem}>
              <span
                className={`${styles.identityIcon} ${styles[`tone_${row.tone}`]}`}
                aria-hidden="true"
              >
                <row.icon size={18} />
              </span>
              <div className={styles.identityText}>
                <dt className={styles.identityLabel}>{row.label}</dt>
                <dd className={styles.identityValue}>{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {TEAM_PHOTO.src && (
          <figure className={`${styles.photo} ${styles.section}`}>
            <img
              src={TEAM_PHOTO.src}
              alt={TEAM_PHOTO.alt}
              className={styles.photoImage}
            />
            {TEAM_PHOTO.caption && (
              <figcaption className={styles.photoCaption}>
                {TEAM_PHOTO.caption}
              </figcaption>
            )}
          </figure>
        )}

        {figures.length > 0 && (
          <section className={`${styles.figures} ${styles.section}`}>
            {figures.map((figure) => (
              <div key={figure.label} className={styles.figure}>
                <span className={styles.figureValue}>{figure.value}</span>
                <span className={styles.figureLabel}>{figure.label}</span>
              </div>
            ))}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>How it started</h2>
          <ol className={styles.milestones}>
            {MILESTONES.map((milestone) => (
              <li key={milestone.year} className={styles.milestone}>
                <div className={styles.milestoneWhen}>
                  <span className={styles.milestoneYear}>{milestone.year}</span>
                  {milestone.date && (
                    <span className={styles.milestoneDate}>
                      {milestone.date}
                    </span>
                  )}
                </div>
                <div className={styles.milestoneRail} aria-hidden="true">
                  <span
                    className={`${styles.milestoneMarker} ${styles[`tone_${milestone.tone}`]}`}
                  />
                  <span className={styles.milestoneLine} />
                </div>
                <div className={styles.milestoneWhat}>
                  <h3 className={styles.milestoneTitle}>{milestone.title}</h3>
                  <p className={styles.milestoneBody}>{milestone.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>How we work</h2>
          <div className={styles.principles}>
            {PRINCIPLES.map((principle) => (
              <div key={principle.statement} className={styles.principle}>
                <span
                  className={`${styles.principleIcon} ${styles[`tone_${principle.tone}`]}`}
                  aria-hidden="true"
                >
                  <principle.icon size={18} />
                </span>
                <h3 className={styles.principleStatement}>
                  {principle.statement}
                </h3>
                <p className={styles.principleBody}>{principle.body}</p>
              </div>
            ))}
          </div>
        </section>

        {PEOPLE.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Who runs it</h2>
            <ul className={styles.people}>
              {PEOPLE.map((person) => (
                <TeamMember key={person.name} person={person} />
              ))}
            </ul>
          </section>
        )}

        <AboutReviews className={styles.reviewsBand} />

        <section className={styles.invitation}>
          <div className={styles.invitationText}>
            <span className={styles.invitationRule} aria-hidden="true" />
            <h2 className={styles.invitationHeading}>Two ways in</h2>
            <p className={styles.invitationBody}>
              If you teach, sell what you already write. If you would rather
              build the thing itself, we are hiring.
            </p>
          </div>
          <div className={styles.invitationActions}>
            <PlayfulButton asChild tone="primary" size="lg">
              <Link to="/teacher/signup">Start selling</Link>
            </PlayfulButton>
            <PlayfulButton asChild tone="soft" size="lg">
              <Link to="/careers">See open roles</Link>
            </PlayfulButton>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;
