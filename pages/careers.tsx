import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useCareersListQuery } from "../helpers/useCareersQuery";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Briefcase, MapPin, Building, Clock, Banknote, ArrowRight } from "lucide-react";
import styles from "./careers.module.css";

const CareersPage: React.FC = () => {
  const { data, isLoading, isError } = useCareersListQuery();

  const formatEmploymentType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <>
      <Helmet>
        <title>Careers at Testkart - Join Our Team</title>
        <meta
          name="description"
          content="Join our team and help transform education in India. We're building the future of online testing and learning."
        />
        <link rel="canonical" href="https://testkart.in/careers" />
      </Helmet>

      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Careers at Testkart</h1>
          <p className={styles.heroSubtitle}>
            Join our team and help transform education in India. We're building
            the future of online testing and learning.
          </p>
        </div>
      </div>

      <main className={styles.mainContainer}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>Open Positions</h2>
        </div>

        {isLoading ? (
          <div className={styles.gridContainer}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton style={{ width: "60%", height: "1.5rem", marginBottom: "var(--spacing-2)" }} />
                <Skeleton style={{ width: "40%", height: "1rem", marginBottom: "var(--spacing-4)" }} />
                <div className={styles.skeletonTags}>
                  <Skeleton style={{ width: "80px", height: "1.5rem", borderRadius: "var(--radius-full)" }} />
                  <Skeleton style={{ width: "80px", height: "1.5rem", borderRadius: "var(--radius-full)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className={styles.emptyState}>
            <Briefcase size={48} className={styles.emptyIcon} />
            <h3>Failed to load positions</h3>
            <p>There was an error loading the job postings. Please try again later.</p>
          </div>
        ) : !data || data.careers.length === 0 ? (
          <div className={styles.emptyState}>
            <Briefcase size={48} className={styles.emptyIcon} />
            <h3>No open positions right now</h3>
            <p>We're not actively hiring at the moment, but check back later as we are always growing!</p>
          </div>
        ) : (
          <div className={styles.gridContainer}>
            {data.careers.map((career) => (
              <Link to={`/careers/${career.slug}`} key={career.id} className={styles.careerCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.careerTitle}>{career.title}</h3>
                  <div className={styles.careerMeta}>
                    {career.department && (
                      <span className={styles.metaItem}>
                        <Building size={16} />
                        {career.department}
                      </span>
                    )}
                    {career.location && (
                      <span className={styles.metaItem}>
                        <MapPin size={16} />
                        {career.location}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.cardTags}>
                  <Badge variant="secondary" className={styles.tag}>
                    <Clock size={14} className={styles.tagIcon} />
                    {formatEmploymentType(career.employmentType)}
                  </Badge>
                  {career.experienceLevel && (
                    <Badge variant="outline" className={styles.tag}>
                      <Briefcase size={14} className={styles.tagIcon} />
                      {career.experienceLevel}
                    </Badge>
                  )}
                  {career.salaryRange && (
                    <Badge variant="success" className={styles.tag}>
                      <Banknote size={14} className={styles.tagIcon} />
                      {career.salaryRange}
                    </Badge>
                  )}
                </div>
                
                <div className={styles.cardFooter}>
                  <span className={styles.viewDetailsText}>View Details</span>
                  <ArrowRight size={18} className={styles.arrowIcon} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default CareersPage;