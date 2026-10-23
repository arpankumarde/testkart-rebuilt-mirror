import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, BookA, Edit } from "lucide-react";
import { useAdminGlossaryTerm } from "../helpers/useAdminGlossary";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { Button } from "../components/Button";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { GlossaryTermArticle } from "../components/GlossaryTermArticle";
import { Skeleton } from "../components/Skeleton";
import styles from "./admin.glossary.preview.$id.module.css";

/**
 * The saved term on the real public layout, site header and footer included, with one bar on top.
 * Unsaved edits preview from the editor instead.
 */
const AdminGlossaryPreviewPage: React.FC = () => {
  const { id: idSegment } = useParams<{ id: string }>();
  const id = idSegment && /^\d+$/.test(idSegment) ? Number(idSegment) : null;
  const { data, isFetching, isError, error, refetch } = useAdminGlossaryTerm(id);
  const term = data?.term;
  const related = term?.relatedTerms.filter((item) => item.status === "published") ?? [];
  const hiddenRelated = (term?.relatedTerms.length ?? 0) - related.length;

  return (
    <>
      <Helmet>
        <title>{`Preview${term ? `: ${term.term}` : ""} - Testkart Admin`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className={styles.bar}>
        <Button asChild variant="ghost" size="sm">
          <Link to={glossaryMeta.ADMIN_PATH}>
            <ArrowLeft size={16} /> Glossary
          </Link>
        </Button>
        {term && (
          <>
            <span className={styles.note} role="status">
              {term.status === "published" ? "Preview of the live page" : "Draft preview - not visible on the site"}
              {hiddenRelated > 0 && ` - ${hiddenRelated} related term${hiddenRelated === 1 ? " is a draft, so it is" : "s are drafts, so they are"} hidden`}
            </span>
            <Button asChild size="sm" className={styles.edit}>
              <Link to={glossaryMeta.editPath(term.id)}>
                <Edit size={15} /> Edit
              </Link>
            </Button>
          </>
        )}
      </div>

      {id === null ? (
        <div className={styles.state}>
          <ConsoleListEmpty icon={<BookA size={24} />} title="Term not found" description="The link is wrong." />
        </div>
      ) : isError && !term ? (
        <div className={styles.state}>
          <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load this term" description={parseErrorMessage(error)}>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        </div>
      ) : !term || (isFetching && !data) ? (
        <div className={styles.state}>
          <Skeleton style={{ height: "32rem", borderRadius: "var(--radius-lg)" }} />
        </div>
      ) : (
        <GlossaryTermArticle term={term} related={related} preview />
      )}
    </>
  );
};

export default AdminGlossaryPreviewPage;