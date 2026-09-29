import React, { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail } from "lucide-react";
import { useTeacherRelationshipManager } from "../helpers/useTeacherRelationshipManager";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import styles from "./TeacherRelationshipManagerCard.module.css";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const CopyEmailButton = ({ email }: { email: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      toast.error("Copying is blocked here. Select the email address and copy it yourself.");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          className={styles.copy}
          onClick={copy}
          aria-label={copied ? "Email address copied" : "Copy email address"}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy email address"}</TooltipContent>
    </Tooltip>
  );
};

/* The teacher's named contact at Testkart, at the top of the dashboard's side panel. */
export const TeacherRelationshipManagerCard: React.FC = () => {
  const titleId = useId();
  const { data, isPending } = useTeacherRelationshipManager(true);
  const manager = data?.manager;

  if (isPending) {
    return (
      <div className={styles.card} aria-busy="true">
        <div className={styles.person}>
          <Skeleton className={styles.avatar} />
          <div className={styles.text}>
            <Skeleton style={{ height: "0.75rem", width: "8rem" }} />
            <Skeleton style={{ height: "1rem", width: "10rem" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!manager) return null;

  const firstName = manager.name.split(/\s+/)[0];

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.person}>
        {manager.avatarUrl ? (
          <img src={manager.avatarUrl} alt="" className={styles.avatar} />
        ) : (
          <span className={`${styles.avatar} ${styles.initials}`} aria-hidden="true">
            {initialsOf(manager.name)}
          </span>
        )}
        <div className={styles.text}>
          <h2 id={titleId} className={styles.eyebrow}>
            Your relationship manager
          </h2>
          <p className={styles.name}>{manager.name}</p>
          <p className={styles.email} title={manager.email}>
            {manager.email}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <Button asChild className={styles.cta}>
          <a href={`mailto:${manager.email}`}>
            <Mail aria-hidden="true" />
            Email {firstName}
          </a>
        </Button>
        <CopyEmailButton email={manager.email} />
      </div>
    </section>
  );
};
