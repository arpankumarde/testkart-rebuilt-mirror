import React from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ExternalLink, Monitor, PenLine, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { GecAdminHeader } from "../components/GecAdminHeader";
import { GovtExamsCalendarView } from "../components/GovtExamsCalendarView";
import { GEC_ADMIN_PATH, GEC_BLOCKS, GEC_PATH, gecBlock, type GecBlockKey } from "../helpers/gecModel";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { useAdminGecDraft } from "../helpers/useAdminGovtExamsCalendar";
import { useGecView } from "../helpers/useGovtExamsCalendar";
import styles from "./admin.govt-exams-calendar.preview.module.css";

const FULL = "__full";
const DEVICES = [
  { key: "desktop", label: "Desktop", width: 1280, icon: Monitor },
  { key: "tablet", label: "Tablet", width: 820, icon: Tablet },
  { key: "mobile", label: "Mobile", width: 390, icon: Smartphone },
] as const;

/**
 * The saved draft rendered by the public page's own component at a device width, as the whole page or
 * one block. The page's breakpoints are container queries, so the narrow widths show the real layouts.
 */
const AdminGecPreviewPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const section = (gecBlock(params.get("section"))?.key ?? null) as GecBlockKey | null;
  const only = params.get("only") === "1";
  const device = DEVICES.find((item) => item.key === params.get("device")) ?? DEVICES[0];
  const { data, isFetching, isError, error, refetch } = useAdminGecDraft();
  const view = useGecView(data);
  const stageRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!view || !section || only) return;
    const target = stageRef.current?.querySelector<HTMLElement>(`#${section}`);
    if (target && stageRef.current) stageRef.current.scrollTop = target.offsetTop - 16;
  }, [view, section, only, device.key]);

  const set = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );

  const frameQuery = new URLSearchParams();
  if (section) frameQuery.set("section", section);
  if (section && only) frameQuery.set("only", "1");
  const frameSrc = `${GEC_ADMIN_PATH}/preview-frame${frameQuery.toString() ? `?${frameQuery}` : ""}`;

  return (
    <>
      <Helmet>
        <title>Preview - Government Exams Calendar - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <GecAdminHeader />

        <div className={styles.toolbar}>
          <Select value={section ?? FULL} onValueChange={(value) => set({ section: value === FULL ? null : value })}>
            <SelectTrigger className={styles.select} aria-label="Section to preview">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FULL}>Complete page</SelectItem>
              {GEC_BLOCKS.filter((block) => block.key !== "footer").map((block) => (
                <SelectItem key={block.key} value={block.key}>
                  {block.n}. {block.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className={`${styles.check} ${section ? "" : styles.disabled}`}>
            <Checkbox checked={only && !!section} disabled={!section} onChange={(e) => set({ only: e.target.checked ? "1" : null })} />
            Only this block
          </label>

          <div className={styles.devices} role="radiogroup" aria-label="Screen size">
            {DEVICES.map((item) => (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={device.key === item.key}
                className={`${styles.device} ${device.key === item.key ? styles.deviceOn : ""}`}
                onClick={() => set({ device: item.key === "desktop" ? null : item.key })}
              >
                <item.icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.toolbarEnd}>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={15} /> {isFetching ? "Loading..." : "Reload draft"}
            </Button>
            {section && (
              <Button asChild variant="outline" size="sm">
                <Link to={`${GEC_ADMIN_PATH}/content?block=${encodeURIComponent(section)}`}>
                  <PenLine size={15} /> Edit this block
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <a href={frameSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> With site header and footer
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={GEC_PATH} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Live page
              </a>
            </Button>
          </div>
        </div>

        <div className={styles.stage}>
          <div ref={stageRef} className={styles.frameWrap} style={{ width: `min(100%, ${device.width}px)` }} aria-label="Draft preview of the public page">
            <div className={styles.banner} role="status">
              Draft preview{section && only ? `: ${gecBlock(section)?.label}` : ""} - not live until you publish
            </div>
            {view ? (
              <GovtExamsCalendarView view={view} onlyBlock={only ? section : null} />
            ) : isError ? (
              <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load the draft" description={parseErrorMessage(error)} />
            ) : (
              <Skeleton style={{ height: "24rem", margin: "var(--spacing-4)" }} />
            )}
          </div>
          <p className={styles.caption}>
            {device.label} width ({device.width}px). Shows the saved draft as it would appear if published today.
          </p>
        </div>
      </div>
    </>
  );
};

export default AdminGecPreviewPage;