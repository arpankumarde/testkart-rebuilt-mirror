import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth, AUTH_QUERY_KEY } from "../helpers/useAuth";
import { announceSessionChange } from "../helpers/sessionSync";
import { useCloseAccountMutation } from "../helpers/useAccountMutations";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import styles from "./close-account.module.css";

const CloseAccountSkeleton = () => (
  <div className={styles.container}>
    <Skeleton style={{ height: "32px", width: "200px", marginBottom: "var(--spacing-4)" }} />
    <Skeleton style={{ height: "20px", width: "100%", marginBottom: "var(--spacing-2)" }} />
    <Skeleton style={{ height: "20px", width: "90%", marginBottom: "var(--spacing-6)" }} />
    <Skeleton style={{ height: "100px", width: "100%", marginBottom: "var(--spacing-6)" }} />
    <Skeleton style={{ height: "150px", width: "100%", marginBottom: "var(--spacing-6)" }} />
    <Skeleton style={{ height: "40px", width: "150px", marginLeft: "auto" }} />
  </div>
);

const CloseAccountPage: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const closeAccountMutation = useCloseAccountMutation();

  const handleCloseAccount = async () => {
    if (!window.confirm("Are you absolutely sure you want to close your account? This action cannot be undone.")) {
      return;
    }

    try {
      const result = await closeAccountMutation.mutateAsync(reason);
      toast.success(result.message);
      
      // Clear auth state here and in other open tabs, then navigate to home
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      announceSessionChange();
      queryClient.resetQueries();
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close account");
    }
  };

  return (
    <>
      <Helmet>
        <title>Close Account - Testkart</title>
        <meta name="description" content="Request to close your Testkart account and delete your data." />
        <link rel="canonical" href="https://testkart.in/close-account" />
      </Helmet>
      
      <div className={styles.pageWrapper}>
        {authState.type === "loading" ? (
          <CloseAccountSkeleton />
        ) : authState.type === "unauthenticated" ? (
          <div className={styles.container}>
            <h1 className={styles.title}>Close Your Account</h1>
            <div className={styles.unauthenticatedState}>
              <p>You need to be logged in to request an account closure.</p>
              <Button asChild>
                <Link to="/login?redirectTo=/close-account">Log In to Continue</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.container}>
            <h1 className={styles.title}>Close Your Account</h1>
            
            <p className={styles.description}>
              We're sorry to see you go. If you close your account, you will lose access to all your purchased tests, courses, and platform data.
            </p>

            <div className={styles.warningBox}>
              <p>Please note what happens next:</p>
              <ul>
                <li>Your account will be deactivated immediately.</li>
                <li>You will be logged out of all devices.</li>
                <li>All your personal data will be scheduled for permanent deletion.</li>
                <li><strong>This action cannot be undone.</strong></li>
              </ul>
            </div>

            <div className={styles.userInfoCard}>
              <h3>Account Details</h3>
              <div className={styles.userInfoRow}>
                <span className={styles.userInfoLabel}>Name:</span>
                <span className={styles.userInfoValue}>{authState.user.displayName}</span>
              </div>
              <div className={styles.userInfoRow}>
                <span className={styles.userInfoLabel}>Email:</span>
                <span className={styles.userInfoValue}>{authState.user.email || "N/A"}</span>
              </div>
              <div className={styles.userInfoRow}>
                <span className={styles.userInfoLabel}>Role:</span>
                <span className={styles.userInfoValue} style={{ textTransform: 'capitalize' }}>
                  {authState.user.role}
                </span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="reason" className={styles.label}>
                Reason for leaving (Optional)
              </label>
              <Textarea
                id="reason"
                className={styles.textarea}
                placeholder="Please tell us why you are closing your account to help us improve."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={closeAccountMutation.isPending}
                rows={4}
              />
            </div>

            <div className={styles.actions}>
              <Button asChild variant="outline" disabled={closeAccountMutation.isPending}>
                <Link to="/">Cancel</Link>
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCloseAccount}
                disabled={closeAccountMutation.isPending}
              >
                {closeAccountMutation.isPending ? "Closing Account..." : "Close My Account"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CloseAccountPage;