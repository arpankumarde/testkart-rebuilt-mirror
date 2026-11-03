import React from "react";
import { ArrowRight, BookOpenCheck, CircleDollarSign, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import styles from "./mcp.module.css";

const MCP_ENDPOINT = "https://testkart.in/_api/mcp/teacher";

const tools = [
  { name: "teacher_whoami", description: "Confirm which Testkart teacher account is connected." },
  { name: "teacher_docs", description: "Read Testkart's question-writing and math-format guidance." },
  { name: "teacher_tests_*, teacher_test_items_*", description: "List, create, update, submit for review and delete test series and their papers." },
  { name: "teacher_questions_*, teacher_question_bank_*", description: "Read, write, reorder and bulk-edit questions, and manage the question bank." },
  { name: "teacher_live_tests_*", description: "Schedule, update and submit live tests, and read their analytics." },
  { name: "teacher_courses_*, teacher_course_sections_*, teacher_course_lessons_*", description: "Build courses, their sections and lessons." },
  { name: "teacher_products_*, teacher_bundles_*", description: "Manage study notes and bundles." },
  { name: "teacher_students_list, teacher_reviews_latest, teacher_certificates_issued", description: "Read enrolled students, reviews and issued certificates." },
  { name: "teacher_earnings_*, teacher_withdrawal_*, teacher_subscription_*", description: "Read earnings, payouts and plan status, and request a withdrawal with confirmation." },
];

const MCPPage: React.FC = () => (
  <>
    <SEOHead
      title="Testkart Teacher MCP"
      description="Connect an MCP client to Testkart's teacher tools using Testkart sign-in. Explore supported content, account, student, and earnings workflows."
      url="https://testkart.in/mcp"
    />
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="mcp-title">
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>For Testkart teachers and MCP developers</p>
          <h1 id="mcp-title" className={styles.title}>Testkart Teacher MCP</h1>
          <p className={styles.lede}>
            Connect a supported MCP client to your Testkart teacher account. Review courses, tests,
            live tests, questions, students, earnings, and subscription details, or manage supported
            teaching content through a sign-in protected connection.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryLink} href="https://testkart.in/teacher/login">
              Sign in to Testkart <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className={styles.secondaryLink} href="#connection">Connection details</a>
          </div>
          <div className={styles.endpoint} id="connection">
            <span className={styles.endpointLabel}>Teacher MCP endpoint</span>
            <code>{MCP_ENDPOINT}</code>
            <p>Transport: Streamable HTTP · Authentication: Testkart OAuth sign-in</p>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.section} aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <span className={styles.iconTile}><BookOpenCheck size={21} aria-hidden="true" /></span>
            <div>
              <p className={styles.kicker}>What it supports</p>
              <h2 id="capabilities-title">Teacher workflows in one connection</h2>
            </div>
          </div>
          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <BookOpenCheck className={styles.cardIcon} size={22} aria-hidden="true" />
              <h3>Build and manage content</h3>
              <p>Work with test series, test items, questions, live tests, courses, study notes, and bundles.</p>
            </article>
            <article className={styles.card}>
              <UsersRound className={styles.cardIcon} size={22} aria-hidden="true" />
              <h3>Review learners and results</h3>
              <p>Read supported student, enrollment, review, certificate, and live-test analytics information.</p>
            </article>
            <article className={styles.card}>
              <CircleDollarSign className={styles.cardIcon} size={22} aria-hidden="true" />
              <h3>Check teacher account details</h3>
              <p>Review earnings and payouts, check subscription options, request a wallet withdrawal, and manage supported account actions.</p>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="tools-title">
          <div className={styles.sectionHeading}>
            <span className={`${styles.iconTile} ${styles.iconMint}`}><LockKeyhole size={20} aria-hidden="true" /></span>
            <div>
              <p className={styles.kicker}>MCP tools</p>
              <h2 id="tools-title">One tool per teacher action</h2>
            </div>
          </div>
          <p className={styles.sectionIntro}>
            Every supported teacher action is its own tool with a typed input schema and read-only,
            destructive, idempotent and open-world hints. The main tool groups are below.
          </p>
          <ul className={styles.toolList}>
            {tools.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <span>{tool.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.notice} aria-labelledby="access-title">
          <span className={styles.noticeIcon}><ShieldCheck size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="access-title">Access, approvals, and payments</h2>
            <ul>
              <li>Connect by signing in to Testkart and authorizing access for the MCP client. The connection acts within the signed-in teacher account's permissions.</li>
              <li>Responses are returned to the connected MCP client and can contain student contact information or the teacher's payout and tax details. Use a trusted client and request only the data needed for the task.</li>
              <li>Deletes, unpublishing, withdrawals, bank-detail changes, sponsorship, and other sensitive actions require the teacher's explicit confirmation.</li>
              <li>Publishing eligible content can submit it for Testkart review; it is not live until the result confirms publication or an administrator approves it.</li>
              <li>Teachers sell notes, mock tests, and courses on Testkart, where students complete checkout. Teachers can request a wallet withdrawal and use supported subscription actions; any online payment is completed on Testkart. The MCP connection does not complete checkout or subscription cancellation.</li>
            </ul>
          </div>
        </section>

        <section className={styles.links} aria-label="Testkart policies and support">
          <div>
            <p className={styles.kicker}>Need help?</p>
            <h2>Testkart Teacher is provided by Digikind Education Private Limited.</h2>
            <p>Read the Testkart policies or contact the team for help with the teacher connection.</p>
          </div>
          <nav className={styles.policyLinks}>
            <a href="https://testkart.in/privacy">Privacy policy <ArrowRight size={15} aria-hidden="true" /></a>
            <a href="https://testkart.in/terms">Terms and conditions <ArrowRight size={15} aria-hidden="true" /></a>
            <a href="https://testkart.in/contact">Contact support <ArrowRight size={15} aria-hidden="true" /></a>
          </nav>
        </section>
      </div>
    </main>
  </>
);

export default MCPPage;