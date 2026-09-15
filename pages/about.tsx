import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import styles from "./about.module.css";

/*
 * Page content lives here so copy, figures and image URLs can be edited without
 * touching markup. Optional blocks render only once they hold real content, so
 * an unfilled section is absent rather than showing an empty frame. The team
 * photograph is the exception - it holds its place until a file is set.
 */

const IDENTITY: { label: string; value: string }[] = [
  { label: "Legal name", value: "Digikind Education Private Limited" },
  { label: "Started", value: "2022" },
  { label: "Incorporated", value: "3 September 2024" },
  { label: "Office", value: "Noida, Uttar Pradesh" },
];

/* Held back until there is a photograph worth running. Setting src brings the
   band back, between the coral rule and the milestones. */
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
}[] = [
  {
    year: "2022",
    date: null,
    title: "Testkart starts",
    body: "A place for teachers to publish the mock tests they were already writing, instead of passing them around a class.",
  },
  {
    year: "2024",
    date: "3 September",
    title: "Digikind Education Private Limited",
    body: "Testkart is incorporated. The same product, now with a company behind it, and the paperwork a student can check.",
  },
  {
    year: "2026",
    date: "3 August",
    title: "First office, in Noida",
    body: "The team stops working apart and moves into one room in Noida, Uttar Pradesh.",
  },
];

const PRINCIPLES: { statement: string; body: string }[] = [
  {
    statement: "Teachers keep what they make.",
    body: "Material published on Testkart belongs to the teacher who wrote it. We take a share of what sells, not ownership of the work.",
  },
  {
    statement: "A test is only useful if it behaves like the real one.",
    body: "Timing, negative marking, the mix of questions. Practice that flatters a student is worse than no practice at all.",
  },
  {
    statement: "No surprises in the price.",
    body: "What a student pays and what a teacher is paid are both visible before anything changes hands.",
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
];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const TeamMember: React.FC<{ person: Person }> = ({ person }) => {
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <div className={styles.person}>
      {person.photo && !imageFailed ? (
        <img
          src={person.photo}
          alt={person.name}
          className={styles.personPhoto}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={styles.personPhotoSlot} aria-hidden="true">
          {initials(person.name)}
        </div>
      )}
      <div>
        <p className={styles.personName}>{person.name}</p>
        <p className={styles.personRole}>{person.role}</p>
      </div>
    </div>
  );
};

const AboutPage: React.FC = () => {
  const figures = FIGURES.filter((figure) => figure.value);
  /* With the photograph and the figures both held back, the milestones follow
     the coral rule directly and must not draw a second rule of their own. */
  const milestonesLead = !TEAM_PHOTO.src && figures.length === 0;

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
          <h1 className={styles.statement}>
            Exam practice, made by the people who actually teach the exam.
          </h1>
          <p className={styles.lede}>
            Testkart is a marketplace. Teachers publish mock tests, study notes
            and courses; students buy them and sit them. We run the platform,
            the payments and the delivery, so a teacher with good material does
            not have to build a business around it first.
          </p>
        </header>

        <dl className={styles.identity}>
          {IDENTITY.map((row) => (
            <div key={row.label} className={styles.identityItem}>
              <dt className={styles.identityLabel}>{row.label}</dt>
              <dd className={styles.identityValue}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.brandRule} />

        {TEAM_PHOTO.src && (
          <figure className={styles.photo}>
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
          <section className={styles.figures}>
            {figures.map((figure) => (
              <div key={figure.label} className={styles.figure}>
                <span className={styles.figureValue}>{figure.value}</span>
                <span className={styles.figureLabel}>{figure.label}</span>
              </div>
            ))}
          </section>
        )}

        <section
          className={
            milestonesLead
              ? `${styles.section} ${styles.sectionLead}`
              : styles.section
          }
        >
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
                <p className={styles.principleStatement}>
                  {principle.statement}
                </p>
                <p className={styles.principleBody}>{principle.body}</p>
              </div>
            ))}
          </div>
        </section>

        {PEOPLE.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Who runs it</h2>
            <div className={styles.people}>
              {PEOPLE.map((person) => (
                <TeamMember key={person.name} person={person} />
              ))}
            </div>
          </section>
        )}

        <section className={styles.invitation}>
          <h2 className={styles.invitationHeading}>Two ways in</h2>
          <p className={styles.invitationBody}>
            If you teach, sell what you already write. If you would rather build
            the thing itself, we are hiring.
          </p>
          <div className={styles.invitationActions}>
            <Button asChild size="lg">
              <Link to="/teacher/signup">Start selling</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/careers">See open roles</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;
