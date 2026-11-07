import React, { useId, useState } from "react";
import { toast } from "sonner";
import { LogOut, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminSessions, useTerminateAdminSession } from "../helpers/useAdminSessions";
import type { AdminSessionDevice, AdminSessionSummary } from "../helpers/adminSessions";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminSessionsSection.module.css";

/*
 * Every browser the admin is signed in to the admin panel on, each with its own Sign out. Shown on
 * the admin Profile page, which every admin can open.
 */

// Last-active time is only refreshed every few minutes, so anything this recent is in use.
const ACTIVE_NOW_MS = 6 * 60 * 1000;

const signedInFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const deviceIcon = (device: AdminSessionDevice): React.ReactNode => {
  if (device === "mobile") return <Smartphone aria-hidden="true" />;
  if (device === "tablet") return <Tablet aria-hidden="true" />;
  return <Monitor aria-hidden="true" />;
};

const activeLabel = (session: AdminSessionSummary): string => {
  if (session.isCurrent || Date.now() - session.lastActiveAt.getTime() < ACTIVE_NOW_MS) return "Active now";
  return `Active ${adminFormat.relativeTime(session.lastActiveAt)}`;
};

export const AdminSessionsSection = ({ id }: { id?: string }) => {
  const titleId = useId();
  const { logout } = useAdminAuth();
  const { data, isPending, isError, refetch, isRefetching } = useAdminSessions();
  const terminate = useTerminateAdminSession();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [confirmingOthers, setConfirmingOthers] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const sessions = data?.sessions ?? [];
  const others = sessions.filter((session) => !session.isCurrent).length;
  const otherDevices = others === 1 ? "1 other device" : `${others} other devices`;

  const endSession = (session: AdminSessionSummary) => {
    setEndingId(session.id);
    terminate.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => toast.success(`Signed out of ${session.label}`),
        onError: (error) => toast.error(error instanceof Error ? error.message : "The device could not be signed out."),
        onSettled: () => setEndingId(null),
      }
    );
  };

  const endOthers = () => {
    terminate.mutate(
      { others: true },
      {
        onSuccess: () => {
          toast.success("Signed out of every other device");
          setConfirmingOthers(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Other devices could not be signed out."),
      }
    );
  };

  const signOutHere = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      toast.error("You could not be signed out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <section id={id} className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>
            Signed-in devices
          </h2>
          <p className={styles.description}>
            Every browser signed in to the admin panel as you. Sign out any you no longer use or do not recognise.
          </p>
        </div>
        {others > 0 && (
          <Button variant="outline" className={styles.headAction} onClick={() => setConfirmingOthers(true)}>
            <LogOut size={14} aria-hidden="true" />
            Sign out all others
          </Button>
        )}
      </div>

      {isPending ? (
        <div className={styles.list} aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className={styles.row}>
              <Skeleton className={styles.markSkeleton} />
              <div className={styles.rowText}>
                <Skeleton style={{ height: "1rem", width: "9rem" }} />
                <Skeleton style={{ height: "0.875rem", width: "14rem", maxWidth: "100%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>Your signed-in devices could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RotateCw size={14} aria-hidden="true" />
            {isRefetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : (
        <ul className={styles.list} role="list">
          {sessions.map((session) => {
            const isEnding = endingId === session.id;
            return (
              <li key={session.id} className={styles.row}>
                <span className={styles.mark}>{deviceIcon(session.device)}</span>
                <div className={styles.rowText}>
                  <span className={styles.name}>
                    {session.label}
                    {session.isCurrent && <span className={styles.current}>This device</span>}
                  </span>
                  <span className={styles.meta}>
                    {activeLabel(session)}
                    <span aria-hidden="true"> - </span>
                    Signed in{" "}
                    <time dateTime={session.signedInAt.toISOString()}>
                      {signedInFormatter.format(session.signedInAt)}
                    </time>
                    {session.ipAddress && (
                      <>
                        <span aria-hidden="true"> - </span>
                        IP {session.ipAddress}
                      </>
                    )}
                  </span>
                </div>
                {session.isCurrent ? (
                  <Button
                    variant="outline"
                    className={styles.signOut}
                    onClick={signOutHere}
                    disabled={signingOut}
                    aria-label="Sign out of this device"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    {signingOut ? "Signing out..." : "Sign out"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className={`${styles.signOut} ${styles.end}`}
                    onClick={() => endSession(session)}
                    disabled={terminate.isPending}
                    aria-label={`Sign out of ${session.label}`}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    {isEnding ? "Signing out..." : "Sign out"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConsoleConfirmDialog
        open={confirmingOthers}
        onOpenChange={(open) => {
          if (!open && !terminate.isPending) setConfirmingOthers(false);
        }}
        icon={<LogOut />}
        title="Sign out all other devices?"
        description={`Every browser signed in to the admin panel as you, apart from this one, is signed out (${otherDevices}). You stay signed in here.`}
        confirmLabel="Sign out all others"
        pendingLabel="Signing out..."
        isPending={terminate.isPending && endingId === null}
        onConfirm={endOthers}
      />
    </section>
  );
};
