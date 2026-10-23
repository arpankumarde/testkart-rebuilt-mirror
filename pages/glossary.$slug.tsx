import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, BookA } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { useGlossaryDetails } from "../helpers/useGlossaryPublic";
import { Button } from "../components/Button";
import { GlossaryTermArticle } from "../components/GlossaryTermArticle";
import { SEOHead } from "../components/SEOHead";
import { Skeleton } from "../components/Skeleton";
import styles from "./glossary.$slug.module.css";

/** /glossary/{slug}: one published term. Drafts, unpublished and deleted terms answer as not found. */
const GlossaryTermPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const termSlug = decodeURIComponent(slug).toLowerCase();
  const { data, isLoading, isError, error, refetch } = useGlossaryDetails(termSlug);
  const notFound = isError && /not found/i.test(String(error));
  const location = useLocation();
  const navigate = useNavigate();

  // In-app visits to a renamed term's old URL land on the current one (SSR answers those with a 301).
  useEffect(() => {
    if (data && data.canonicalPath !== location.pathname) navigate(data.canonicalPath, { replace: true });
  }, [data, location.pathname, navigate]);

  if (isLoading && !data) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.column}>
          <Skeleton style={{ height: "1rem", width: "12rem", marginBottom: "1.5rem" }} />
          <Skeleton style={{ height: "2.5rem", width: "60%", marginBottom: "1rem" }} />
          <Skeleton style={{ height: "1.25rem", width: "90%", marginBottom: "2rem" }} />
          <Skeleton style={{ height: "16rem", borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <SEOHead
          title={notFound ? "Term not found" : "Glossary"}
          description="This glossary term is not available."
          url={glossaryMeta.termPath(termSlug)}
          noIndex
        />
        <div className={styles.state} role={notFound ? undefined : "alert"}>
          <span className={`${styles.stateIcon} ${notFound ? "" : styles.stateIconError}`} aria-hidden="true">
            {notFound ? <BookA size={22} /> : <AlertCircle size={22} />}
          </span>
          <h1 className={styles.stateTitle}>{notFound ? "We could not find that term" : "We could not load this term"}</h1>
          <p className={styles.stateText}>
            {notFound ? "It may have been removed, or the link may be wrong." : "Check your connection and try again."}
          </p>
          <div className={styles.stateActions}>
            {!notFound && (
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            )}
            <Button asChild variant={notFound ? "outline" : "ghost"}>
              <Link to={glossaryMeta.HUB_PATH}>Back to Glossary</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { term, related, canonicalPath } = data;

  return (
    <>
      <SEOHead
        title={glossaryMeta.metaTitle(term.term, term.seoTitle)}
        description={glossaryMeta.metaDescription(term.definition, term.seoDescription)}
        url={glossaryMeta.canonicalPath(term.canonicalUrl, term.slug)}
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">
          {glossaryMeta.breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Glossary", path: glossaryMeta.HUB_PATH },
            { name: term.term, path: canonicalPath },
          ])}
        </script>
      </Helmet>
      <GlossaryTermArticle term={term} related={related} />
    </>
  );
};

export default GlossaryTermPage;