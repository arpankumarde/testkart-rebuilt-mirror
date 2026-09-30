import React, { useId, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, MonitorSmartphone, Plug, RotateCw, Unplug } from "lucide-react";
import { SiClaude, SiPerplexity } from "react-icons/si";
import { RiOpenaiFill } from "react-icons/ri";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { useAiConnections, useRevokeTeacherAiConnection } from "../helpers/useAiConnections";
import { useSignOutOtherDevices, useTeacherSignIns } from "../helpers/useTeacherSignIns";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherAccountAccess.module.css";

/*
 * The two "who can get into this account" panels on teacher Settings: the AI apps holding a
 * connector token, and the teacher's sign-ins on other browsers and devices. Each can be cut off
 * from here without contacting support.
 */

const appMark = (clientName: string): React.ReactNode => {
  const name = clientName.toLowerCase();
  if (name.includes("claude")) return <SiClaude aria-hidden="true" />;
  if (name.includes("chatgpt") || name.includes("openai") || name.includes("codex")) {
    return <RiOpenaiFill aria-hidden="true" />;
  }
  if (name.includes("perplexity")) return <SiPerplexity aria-hidden="true" />;
  return <Plug aria-hidden="true" />;
};

const lastUsedLabel = (date: Date): string => {
  const relative = adminFormat.relativeTime(date);
  return relative === "just now" ? "Used just now" : `Last used ${relative}`;
};

type SectionProps = { id: string };

export const ConnectedAppsSection = ({ id }: SectionProps) => {
  const titleId = useId();
  const { data, isPending, isError, refetch, isRefetching } = useAiConnections("teacher");
  const revoke = useRevokeTeacherAiConnection();
  const [pendingApp, setPendingApp] = useState<string | null>(null);
  const connections = data?.connections ?? [];

  const confirmRevoke = () => {
    if (!pendingApp) return;
    const appName = pendingApp;
    revoke.mutate(appName, {
      onSuccess: () => {
        toast.success(`${appName} disconnected`);
        setPendingApp(null);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "The app could not be disconnected."),
    });
  };

  return (
    <section id={id} className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>
            Connected AI apps
          </h2>
          <p className={styles.description}>
            These apps can read and change your test series, courses, study notes and sales as you. Disconnect
            any you no longer use or do not recognise.
          </p>
        </div>
        {connections.length > 0 && (
          <Button asChild variant="outline" className={styles.headAction}>
            <Link to="/teacher/dashboard">Connect another app</Link>
          </Button>
        )}
      </div>

      {isPending ? (
        <div className={styles.ring} aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className={styles.app}>
              <Skeleton className={styles.markSkeleton} />
              <div className={styles.appText}>
                <Skeleton style={{ height: "1rem", width: "7rem" }} />
                <Skeleton style={{ height: "0.875rem", width: "9rem" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>Your connected apps could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RotateCw size={14} aria-hidden="true" />
            {isRefetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : connections.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyMark} aria-hidden="true">
            <Plug />
          </span>
          <div className={styles.emptyText}>
            <p className={styles.emptyTitle}>No AI apps are connected</p>
            <p className={styles.emptyBody}>
              Connect Claude, ChatGPT or Perplexity from your Overview to check sales or write questions by
              asking.
            </p>
          </div>
          <Button asChild className={styles.ink}>
            <Link to="/teacher/dashboard">Connect an app</Link>
          </Button>
        </div>
      ) : (
        <ul className={styles.ring} role="list">
          {connections.map((connection) => (
            <li key={connection.clientName} className={styles.app}>
              <span className={styles.mark}>{appMark(connection.clientName)}</span>
              <div className={styles.appText}>
                <span className={styles.appName}>{connection.clientName}</span>
                <span className={styles.appMeta}>
                  <time dateTime={connection.lastUsedAt.toISOString()}>{lastUsedLabel(connection.lastUsedAt)}</time>
                </span>
              </div>
              <Button
                variant="outline"
               
                className={styles.disconnect}
                onClick={() => setPendingApp(connection.clientName)}
                aria-label={`Disconnect ${connection.clientName}`}
              >
                <Unplug size={14} aria-hidden="true" />
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConsoleConfirmDialog
        open={pendingApp !== null}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setPendingApp(null);
        }}
        tone="destructive"
        icon={<Unplug />}
        title={`Disconnect ${pendingApp ?? "this app"}?`}
        description={`${pendingApp ?? "The app"} loses access to your Testkart account straight away, on every device it was added on. To use it again, connect it from your Overview.`}
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting..."
        isPending={revoke.isPending}
        onConfirm={confirmRevoke}
      />
    </section>
  );
};

export const OtherDevicesSection = ({ id }: SectionProps) => {
  const titleId = useId();
  const { data, isPending, isError, refetch, isRefetching } = useTeacherSignIns();
  const signOut = useSignOutOtherDevices();
  const [confirming, setConfirming] = useState(false);
  const count = data?.count ?? 0;
  const devices = count === 1 ? "1 other browser or device" : `${count} other browsers or devices`;

  const confirmSignOut = () => {
    signOut.mutate(undefined, {
      onSuccess: ({ signedOut }) => {
        toast.success(
          signedOut === 0
            ? "No other devices were signed in"
            : `Signed out of ${signedOut === 1 ? "1 other device" : `${signedOut} other devices`}`
        );
        setConfirming(false);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Other devices could not be signed out."),
    });
  };

  return (
    <section id={id} className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.headText}>
        <h2 id={titleId} className={styles.title}>
          Other devices
        </h2>
        <p className={styles.description}>
          Lost a phone or signed in on a shared computer? Sign out everywhere except this browser.
        </p>
      </div>

      {isPending ? (
        <Skeleton style={{ height: "3.5rem", width: "100%" }} />
      ) : isError ? (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>Your sign-ins could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RotateCw size={14} aria-hidden="true" />
            {isRefetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : (
        <div className={styles.devices}>
          <span className={styles.deviceMark} aria-hidden="true">
            <MonitorSmartphone />
          </span>
          <p className={styles.deviceText}>
            {count === 0 ? (
              <>Only this browser is signed in.</>
            ) : (
              <>
                <strong>Also signed in on {devices}.</strong>
                {data?.lastActiveAt && (
                  <span className={styles.deviceMeta}>
                    {" "}
                    Last active {adminFormat.relativeTime(data.lastActiveAt)}.
                  </span>
                )}
              </>
            )}
          </p>
          {count > 0 && (
            <Button variant="outline" className={styles.signOut} onClick={() => setConfirming(true)}>
              <LogOut size={14} aria-hidden="true" />
              Sign out other devices
            </Button>
          )}
        </div>
      )}

      <ConsoleConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !signOut.isPending) setConfirming(false);
        }}
        icon={<LogOut />}
        title="Sign out other devices?"
        description={`Every browser and phone signed in to your account, apart from this one, is signed out (${devices}). Connected AI apps stay connected; disconnect them above.`}
        confirmLabel="Sign out other devices"
        pendingLabel="Signing out..."
        isPending={signOut.isPending}
        onConfirm={confirmSignOut}
      />
    </section>
  );
};