import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { GovtExamsCalendarView } from "../components/GovtExamsCalendarView";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Skeleton } from "../components/Skeleton";
import { gecBlock, type GecBlockKey } from "../helpers/gecModel";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useAdminGecDraft } from "../helpers/useAdminGovtExamsCalendar";
import { useGecView } from "../helpers/useGovtExamsCalendar";
import styles from "./admin.govt-exams-calendar.preview-frame.module.css";

/**
 * The saved draft on the real public layout, site header and footer included. Loaded inside the preview
 * page's device frame; never indexed and never visible to readers.
 */
const AdminGecPreviewFramePage: React.FC = () => {
  const [params] = useSearchParams();
  const section = gecBlock(params.get("section"))?.key as GecBlockKey | undefined;
  const only = params.get("only") === "1" && section ? section : null;
  const { data, isError, error } = useAdminGecDraft();
  const view = useGecView(data);

  useEffect(() => {
    if (!view || only || !section) return;
    const target = document.getElementById(section);
    if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 50);
  }, [view, section, only]);

  return (
    <>
      <Helmet>
        <title>Draft preview - Government Exams Calendar</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className={styles.banner} role="status">
        Draft preview{only ? `: ${gecBlock(only)?.label}` : ""} - not live until you publish
      </div>
      {view ? (
        <GovtExamsCalendarView view={view} onlyBlock={only} />
      ) : isError ? (
        <div className={styles.state}>
          <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load the draft" description={parseErrorMessage(error)} />
        </div>
      ) : (
        <div className={styles.state}>
          <Skeleton style={{ height: "24rem", borderRadius: "1.5rem" }} />
        </div>
      )}
    </>
  );
};

export default AdminGecPreviewFramePage;