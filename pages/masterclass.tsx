import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useMasterclassesListQuery } from "../helpers/useMasterclasses";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { GraduationCap, Calendar, Users } from "lucide-react";
import styles from "./masterclass.module.css";

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(date)
  );

const MasterclassListPage: React.FC = () => {
  const { data, isFetching, isError } = useMasterclassesListQuery();

  const upcoming = (data?.masterclasses ?? []).filter((m) => !m.isPast);
  const past = (data?.masterclasses ?? []).filter((m) => m.isPast);

  const renderCard = (m: (typeof upcoming)[number]) => (
    <Link
      key={m.id}
      to={`/masterclass/${m.slug}`}
      className={`${styles.card} ${m.isPast ? styles.cardPastBadge : ""}`}
    >
      {m.coverImageUrl ? (
        <img src={m.coverImageUrl} alt={m.title} className={styles.cardCover} />
      ) : (
        <div className={styles.cardCoverPlaceholder}>
          <GraduationCap size={40} />
        </div>
      )}
      <div className={styles.cardBody}>
        <span className={styles.cardDateRow}>
          <Calendar size={14} /> {formatDate(m.startTime)}
        </span>
        <h3 className={styles.cardTitle}>{m.title}</h3>
        {m.subtitle && <p className={styles.cardSubtitle}>{m.subtitle}</p>}
        <div className={styles.cardFooter}>
          <span>{m.hostName ? `Hosted by ${m.hostName}` : "Testkart"}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Users size={13} /> {m.registrantCount}
          </span>
        </div>
      </div>
    </Link>
  );

  return (
    <>
      <Helmet>
        <title>Masterclasses for Teachers | Testkart</title>
        <meta
          name="description"
          content="Free live webinars for teachers on Testkart — practical training on growing your teaching business, content, and more."
        />
        <link rel="canonical" href="https://testkart.in/masterclass" />
      </Helmet>

      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>
            <GraduationCap size={14} /> Testkart Masterclasses
          </span>
          <h1 className={styles.heroTitle}>Free live training for teachers</h1>
          <p className={styles.heroSubtitle}>
            Join our webinars to learn how to grow your teaching business, create better content, and make the most of
            Testkart — hosted live, free to attend.
          </p>
        </div>
      </div>

      <main className={styles.mainContainer}>
        {isFetching && !data ? (
          <div className={styles.grid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton style={{ height: "10rem", width: "100%" }} />
                <Skeleton style={{ height: "1rem", width: "70%" }} />
                <Skeleton style={{ height: "0.875rem", width: "90%" }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className={styles.emptyState}>Could not load masterclasses right now. Please try again shortly.</p>
        ) : (
          <>
            <h2 className={styles.sectionTitle}>Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className={styles.emptyState}>No upcoming masterclasses right now — check back soon.</p>
            ) : (
              <div className={styles.grid}>{upcoming.map(renderCard)}</div>
            )}

            {past.length > 0 && (
              <>
                <h2 className={styles.sectionTitle}>Past masterclasses</h2>
                <div className={styles.grid}>{past.map(renderCard)}</div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default MasterclassListPage;
