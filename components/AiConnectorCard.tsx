import React, { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, ExternalLink, Plug } from "lucide-react";
import { SiClaude, SiPerplexity } from "react-icons/si";
import { RiOpenaiFill } from "react-icons/ri";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { aiConnectorLinks, AiConnectorAudience, AiConnectorLinks } from "../helpers/aiConnectors";
import { useAiConnections } from "../helpers/useAiConnections";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AiConnectorCard.module.css";

type ClientKey = "claude" | "chatgpt" | "perplexity" | "other";

type Guide = {
  steps: React.ReactNode[];
  note: string;
  action?: { label: string; href: string };
  extra?: { label: string; href: string };
};

const CLIENT_OPTIONS = [
  { value: "claude", label: <><SiClaude aria-hidden="true" />Claude</> },
  { value: "chatgpt", label: <><RiOpenaiFill aria-hidden="true" />ChatGPT</> },
  { value: "perplexity", label: <><SiPerplexity aria-hidden="true" />Perplexity</> },
  { value: "other", label: <><Plug aria-hidden="true" />Other apps</> },
] as const;

const PITCH: Record<AiConnectorAudience, string> = {
  teacher: "Ask Claude, ChatGPT or Perplexity to check your sales, write questions and update your test series.",
  admin:
    "Ask Claude, ChatGPT or Perplexity to look up orders and teachers, or to write blog posts, help articles and exam pages.",
};

const guideFor = (client: ClientKey, links: AiConnectorLinks): Guide => {
  switch (client) {
    case "claude":
      return {
        steps: [
          <>Select <strong>Add to Claude</strong>. The name and URL are filled in for you.</>,
          <>Check them, select <strong>Add</strong>, then <strong>Connect</strong>.</>,
          <>Sign in to Testkart if asked, then select <strong>Allow</strong>.</>,
        ],
        note: "Works on every Claude plan, and Free plans can add one custom connector. Once added it is on Claude desktop and mobile too.",
        action: { label: "Add to Claude", href: links.claude },
        extra: { label: "Team or Enterprise owner? Add it for your organisation", href: links.claudeOrganisation },
      };
    case "chatgpt":
      return {
        steps: [
          <>In ChatGPT on the web, open <strong>Settings</strong>, then <strong>Security and login</strong>, and turn on <strong>Developer mode</strong>.</>,
          <>Open ChatGPT plugins, select <strong>+</strong>, name it <strong>{links.name}</strong> and paste the connector URL.</>,
          <>Create it, sign in to Testkart, then select <strong>Allow</strong>.</>,
        ],
        note: "Needs ChatGPT Plus, Pro, Business, Enterprise or Edu. ChatGPT asks you to confirm each change before it makes it.",
        action: { label: "Open ChatGPT plugins", href: links.chatgpt },
      };
    case "perplexity":
      return {
        steps: [
          <>Select <strong>Custom connector</strong>, then <strong>Remote</strong>.</>,
          <>Name it <strong>{links.name}</strong>, paste the connector URL, and choose <strong>OAuth</strong> and <strong>Streamable HTTP</strong>.</>,
          <>Save, select the new connector, sign in to Testkart, then select <strong>Allow</strong>.</>,
        ],
        note: "Needs Perplexity Pro, Max or Enterprise.",
        action: { label: "Open Perplexity connectors", href: links.perplexity },
      };
    case "other":
      return {
        steps: [
          <>Copy the connector URL.</>,
          <>In your app, find where it adds a <strong>custom connector</strong> and paste the URL.</>,
          <>Sign in to Testkart when it asks, then select <strong>Allow</strong>.</>,
        ],
        note: "Works with any app that can add a custom connector by URL and sign in to it.",
      };
  }
};

const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length > 3) return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error("Copying is blocked here. Select the text and copy it yourself.");
    }
  };

  return (
    <>
      <button type="button" className={styles.copy} onClick={copy}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
        <span className={styles.srOnly}> {label}</span>
      </button>
      <span role="status" className={styles.srOnly}>
        {copied ? `${label} copied` : ""}
      </span>
    </>
  );
};

type Props = {
  audience: AiConnectorAudience;
  className?: string;
};

/**
 * Gets an admin or teacher from their dashboard into Claude, ChatGPT, Perplexity or another app
 * with the fewest steps each one allows: Claude opens its add dialog already filled in, and the
 * others get the URL to copy and three steps. Written for non-technical users, so there are no
 * terminal commands or developer tools here.
 *
 * Opens by itself only for someone with nothing connected who has not hidden it. Once an app is
 * connected it stays a single status row, so the dashboard does not keep asking.
 */
export const AiConnectorCard = ({ audience, className }: Props) => {
  const titleId = useId();
  const bodyId = useId();
  const urlLabelId = useId();
  const links = aiConnectorLinks(audience);
  const storageKey = `ai_connector_card_hidden_${audience}`;

  const { data, isSuccess } = useAiConnections(audience);
  const connections = data?.connections ?? [];
  const connected = connections.length > 0;

  const [client, setClient] = useState<ClientKey>("claude");
  const [hidden, setHidden] = useState(false);
  const [preferenceRead, setPreferenceRead] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Storage unavailable: the card follows the connection state alone.
    }
    setPreferenceRead(true);
  }, [storageKey]);

  // Compact until both the stored preference and the connection list are in, so neither a viewer
  // who hid the card nor one already connected sees the setup open and then snap shut.
  const expanded = opened || (preferenceRead && !hidden && isSuccess && !connected);

  const toggle = () => {
    const nextHidden = expanded;
    setOpened(!expanded);
    setHidden(nextHidden);
    try {
      if (nextHidden) window.localStorage.setItem(storageKey, "1");
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Preference resets next visit.
    }
  };

  const guide = guideFor(client, links);
  // Break the URL only before the connector's own segment, never mid-word.
  const urlBreak = links.url.lastIndexOf("/") + 1;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.marks} aria-hidden="true">
          <SiClaude />
          <RiOpenaiFill />
          <SiPerplexity />
        </span>

        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>
            Use Testkart from your AI assistant
          </h2>
          {connected ? (
            <p className={styles.status}>
              <span className={styles.chip}>Connected</span>
              <span className={styles.statusApps}>{joinNames(connections.map((c) => c.clientName))}</span>
              <span className={styles.statusMeta}>
                last used {adminFormat.relativeTime(connections[0].lastUsedAt)}
              </span>
            </p>
          ) : (
            <p className={styles.pitch}>{PITCH[audience]}</p>
          )}
        </div>

        <Button
          variant={expanded ? "ghost" : connected ? "outline" : "primary"}
          className={`${styles.toggle} ${expanded ? styles.toggleHide : ""} ${!expanded && !connected ? styles.cta : ""}`}
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
        >
          {expanded ? "Hide" : connected ? "Connect another app" : "Connect"}
          <ChevronDown
            aria-hidden="true"
            className={`${styles.toggleIcon} ${expanded ? styles.toggleIconOpen : ""}`}
          />
        </Button>
      </div>

      <div
        id={bodyId}
        className={`${styles.body} ${expanded ? "" : styles.bodyCollapsed}`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className={styles.bodyInner}>
          <div className={styles.setup}>
            <SegmentedControl
              value={client}
              onValueChange={setClient}
              options={CLIENT_OPTIONS}
              aria-label="AI app"
              className={styles.clients}
            />

            <div className={styles.connect}>
              <div className={styles.socket}>
                <span id={urlLabelId} className={styles.socketLabel}>
                  Connector URL
                </span>
                <div className={styles.socketRow}>
                  <code className={styles.url} aria-labelledby={urlLabelId}>
                    {links.url.slice(0, urlBreak)}
                    <wbr />
                    {links.url.slice(urlBreak)}
                  </code>
                  <CopyButton text={links.url} label="connector URL" />
                </div>
              </div>

              {guide.action && (
                <Button asChild className={styles.cta}>
                  <a href={guide.action.href} target="_blank" rel="noopener noreferrer">
                    {guide.action.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              )}

              {guide.extra && (
                <p className={styles.extraLine}>
                  <a className={styles.extra} href={guide.extra.href} target="_blank" rel="noopener noreferrer">
                    {guide.extra.label}
                  </a>
                </p>
              )}

              <p className={styles.consent}>
                Nothing happens until you sign in to Testkart and select Allow. To disconnect, remove the
                connector in that app.
              </p>
            </div>

            <div className={styles.steps}>
              <ol className={styles.stepList} role="list">
                {guide.steps.map((step, index) => (
                  <li key={index} className={styles.step}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.note}>{guide.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};