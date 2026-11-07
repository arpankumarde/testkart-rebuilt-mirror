import React, { useId, useState } from "react";
import { toast } from "sonner";
import { LogOut, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { useAdminAuth } from "../helpers/useAdminAuth";
import {
  useAdminSessions,
  useAdminSessionsFor,
  useTerminateAdminSession,
  useTerminateAdminSessionFor,
} from "../helpers/useAdminSessions";
import type { AdminSessionDevice, AdminSessionSummary } from "../helpers/adminSessions";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminSessionsSection.module.css";

/*
 * Every browser the admin is signed in to the admin panel on, each with its own Sign out. Shown on
 * the admin Profile page, which every admin can open. AdminSessionRows is the list on its own, which
 * the super admin's dialog for another admin's sign-ins reuses (AdminSessionsDialog).
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

export const AdminSessionRowsSkeleton = () => (
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
);

export const AdminSessionRows = ({
  sessions,
  renderAction,
}: {
  sessions: AdminSessionSummary[];
  renderAction: (session: AdminSessionSummary) => React.ReactNode;
}) => (
  <ul className={styles.list} role="list">
    {sessions.map((session) => (
      <li key={session.id} className={styles.row}>
        <span className={styles.mark}>{deviceIcon(session.device)}</span>
        <div className={styles.rowText}>
          <span className={styles.name}>
            {session.label}
            {session.isCurrent && <span className={styles.current}>This device</span>}
            {session.openedBy && <span className={styles.opened}>Opened by {session.openedBy}</span>}
          </span>
          <span className={styles.meta}>
            {activeLabel(session)}
            <span aria-hidden="true"> - </span>
            Signed in{" "}
            <time dateTime={session.signedInAt.toISOString()}>{signedInFormatter.format(session.signedInAt)}</time>
            {session.ipAddress && (
              <>
                <span aria-hidden="true"> - </span>
                IP {session.ipAddress}
              </>
            )}
          </span>
        </div>
        {renderAction(session)}
      </li>
    ))}
  </ul>
);

/** The per-row button, shared so both lists read the same. */
export const AdminSessionSignOutButton = ({
  label,
  destructive,
  pending,
  disabled,
  onClick,
}: {
  label: string;
  destructive: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) => (
  <Button
    variant="outline"
    className={`${styles.signOut} ${destructive ? styles.end : ""}`}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
  >
    <LogOut size={14} aria-hidden="true" />
    {pending ? "Signing out..." : "Sign out"}
  </Button>
);

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
        <AdminSessionRowsSkeleton />
      ) : isError ? (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>Your signed-in devices could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RotateCw size={14} aria-hidden="true" />
            {isRefetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : (
        <AdminSessionRows
          sessions={sessions}
          renderAction={(session) =>
            session.isCurrent ? (
              <AdminSessionSignOutButton
                label="Sign out of this device"
                destructive={false}
                pending={signingOut}
                disabled={signingOut}
                onClick={signOutHere}
              />
            ) : (
              <AdminSessionSignOutButton
                label={`Sign out of ${session.label}`}
                destructive
                pending={endingId === session.id}
                disabled={terminate.isPending}
                onClick={() => endSession(session)}
              />
            )
          }
        />
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

/** A super admin's view of another admin's sign-ins, opened from the Administrators list. */
export const AdminSessionsDialog = ({
  admin,
  onOpenChange,
}: {
  admin: { id: number; fullName: string } | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data, isPending, isError, refetch, isRefetching } = useAdminSessionsFor(admin?.id ?? null);
  const terminate = useTerminateAdminSessionFor();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const sessions = data?.sessions ?? [];
  const name = admin?.fullName ?? "this admin";

  const endSession = (session: AdminSessionSummary) => {
    if (!admin) return;
    setEndingId(session.id);
    terminate.mutate(
      { adminId: admin.id, sessionId: session.id },
      {
        onSuccess: () => toast.success(`Signed ${admin.fullName} out of ${session.label}`),
        onError: (error) => toast.error(error instanceof Error ? error.message : "The device could not be signed out."),
        onSettled: () => setEndingId(null),
      }
    );
  };

  const endAll = () => {
    if (!admin) return;
    terminate.mutate(
      { adminId: admin.id, all: true },
      {
        onSuccess: () => {
          toast.success(`${admin.fullName} is signed out everywhere`);
          setConfirmingAll(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "The admin could not be signed out."),
      }
    );
  };

  return (
    <>
      <Dialog open={admin !== null} onOpenChange={onOpenChange}>
        <ConsoleDialogContent size="lg">
          <ConsoleDialogHeader
            title={`Signed-in devices of ${name}`}
            description="Every browser signed in to the admin panel as this admin. Signing one out takes effect on its next click."
            icon={<Monitor size={18} />}
          />
          <ConsoleDialogBody>
            {isPending ? (
              <AdminSessionRowsSkeleton />
            ) : isError ? (
              <div className={styles.notice} role="alert">
                <p className={styles.noticeText}>The signed-in devices could not be loaded.</p>
                <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                  <RotateCw size={14} aria-hidden="true" />
                  {isRefetching ? "Retrying..." : "Retry"}
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <p className={styles.empty}>{name} is not signed in on any browser that has been seen yet.</p>
            ) : (
              <AdminSessionRows
                sessions={sessions}
                renderAction={(session) => (
                  <AdminSessionSignOutButton
                    label={`Sign ${name} out of ${session.label}`}
                    destructive
                    pending={endingId === session.id}
                    disabled={terminate.isPending}
                    onClick={() => endSession(session)}
                  />
                )}
              />
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmingAll(true)}
              disabled={isPending || terminate.isPending}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out everywhere
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={confirmingAll}
        onOpenChange={(open) => {
          if (!open && !terminate.isPending) setConfirmingAll(false);
        }}
        tone="destructive"
        icon={<LogOut />}
        title={`Sign ${name} out everywhere?`}
        description={`${name} is signed out of the admin panel on every browser, including any not listed here, and has to sign in again. Connected AI apps stay connected.`}
        confirmLabel="Sign out everywhere"
        pendingLabel="Signing out..."
        isPending={terminate.isPending && endingId === null}
        onConfirm={endAll}
      />
    </>
  );
};
