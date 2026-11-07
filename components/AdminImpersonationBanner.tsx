import React from "react";
import { toast } from "sonner";
import { Undo2, UserCheck } from "lucide-react";
import { Button } from "./Button";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useStopImpersonatingAdmin } from "../helpers/useAdminSessions";
import styles from "./AdminImpersonationBanner.module.css";

/*
 * Shown across the admin panel while a super admin is signed in as another admin, so it is never
 * unclear whose account is being used, with the way back to their own.
 */
export const AdminImpersonationBanner = () => {
  const { authState } = useAdminAuth();
  const stop = useStopImpersonatingAdmin();
  const admin = authState.type === "authenticated" ? authState.admin : null;

  if (!admin?.impersonator) return null;

  const goBack = () => {
    stop.mutate(undefined, {
      // The cookie now belongs to a different admin; reload rather than patch every cached query.
      onSuccess: ({ restored }) => window.location.assign(restored ? "/admin/settings" : "/admin/login"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not return to your account."),
    });
  };

  return (
    <div className={styles.banner} role="status">
      <span className={styles.mark} aria-hidden="true">
        <UserCheck />
      </span>
      <p className={styles.text}>
        <strong>You are signed in as {admin.fullName}.</strong> Anything you change is saved as them.
      </p>
      <Button className={styles.action} onClick={goBack} disabled={stop.isPending || stop.isSuccess}>
        <Undo2 size={14} aria-hidden="true" />
        {stop.isPending || stop.isSuccess ? "Returning..." : `Return to ${admin.impersonator.fullName}`}
      </Button>
    </div>
  );
};
