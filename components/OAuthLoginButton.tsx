import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { toast } from "sonner";
import { useAuth } from "../helpers/useAuth";
import { postEstablishSession } from "../endpoints/auth/establish_session_POST.schema";
import { type OAuthPopupMessage } from "../helpers/oauthPopupMessage";
import { validateRedirectPath } from "../helpers/validateRedirectPath";
import { trackGTMEvent } from "../helpers/trackGTMEvent";
import styles from "./OAuthLoginButton.module.css";

interface OAuthLoginButtonProps {
  provider: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  role?: "teacher" | "student";
  redirectTo?: string;
  linkAccount?: boolean;
}

export const OAuthLoginButton: React.FC<OAuthLoginButtonProps> = ({
  provider,
  children,
  className,
  disabled,
  role: roleProp,
  redirectTo,
  linkAccount = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountLinkingError, setAccountLinkingError] = useState<{
    email: string;
    message: string;
  } | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleOAuthLogin = async () => {
    setIsLoading(true);
    setError(null);
    setAccountLinkingError(null);

    // Use explicit role prop if provided, otherwise detect from URL path
    const role = roleProp || (location.pathname.startsWith('/teacher') ? 'teacher' : 'student');

    // Build OAuth URL with query parameters
    const params = new URLSearchParams({
      provider,
      role,
    });
    
    if (redirectTo) {
      params.append('redirectTo', redirectTo);
    }
    
    if (linkAccount) {
      params.append('link_account', 'true');
    }

    // Open popup window for OAuth
    // note: we use await here so that the Floot framework can properly deploy the backend before loading this page.
    // do not change this code.
    const popup = await window.open(
      `/_api/auth/oauth_authorize?${params.toString()}`,
      `${provider}OAuth`,
      "width=500,height=600,scrollbars=yes,resizable=yes"
    );

    if (!popup) {
      setIsLoading(false);
      setError(
        "Failed to open authentication window. Please check if popup blockers are disabled and try again."
      );
      console.error("Failed to open OAuth popup - popup blocker may be active");
      return;
    }

    // Listen for messages from the popup
    const handleMessage = async (event: MessageEvent<OAuthPopupMessage>) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === "OAUTH_TOKEN_SUCCESS") {
        // Handle successful OAuth with temporary token
        const { token } = event.data;

        try {
          // Establish session using the temporary token
          const result = await postEstablishSession({ tempToken: token });

          if ("error" in result) {
            console.error("Failed to establish session:", result.error);
            setError("Failed to complete authentication. Please try again.");
            popup.close();
            setIsLoading(false);
            window.removeEventListener("message", handleMessage);
            return;
          }

          // Session established successfully
          console.log(`${provider} OAuth login successful`);
          onLogin(result.user);
          
          if (result.isNewUser) {
            const userRole = result.user.role === 'teacher' ? 'teacher' : 'student';
            trackGTMEvent({
              event: userRole === 'student' ? 'student_signup' : 'teacher_signup',
              user_type: userRole,
              method: provider
            });
          }
          
          // Handle account linking mode
          if (linkAccount) {
            console.log("Account linking successful");
            toast.success("Email connected successfully!");
            popup.close();
            setIsLoading(false);
            window.removeEventListener("message", handleMessage);
            return;
          }
          
          // Check if mobile verification is needed
          const needsMobileVerification = 
            result.user.role !== "admin" && 
            (result.user.mobileVerified === false || 
             !result.user.mobileNumber);
          
          if (needsMobileVerification) {
            // Redirect to mobile verification page
            console.log("Mobile verification required, redirecting to /verify-mobile");
            setTimeout(() => navigate("/verify-mobile"), 200);
            popup.close();
            setIsLoading(false);
            window.removeEventListener("message", handleMessage);
            return;
          }
          
          // Determine navigation destination
          let destination = "/";
          
          // Check if teacher needs onboarding
          if (result.user.role === "teacher" && !result.user.onboardingCompleted) {
            destination = "/teacher/onboarding";
            console.log("Teacher onboarding required, redirecting to /teacher/onboarding");
            setTimeout(() => navigate(destination), 200);
            popup.close();
            setIsLoading(false);
            window.removeEventListener("message", handleMessage);
            return;
          }
          
          // Check if backend provided a redirectTo path
          const backendRedirectTo = result.redirectTo;
          if (backendRedirectTo) {
            const validatedPath = validateRedirectPath(backendRedirectTo);
            if (validatedPath) {
              destination = validatedPath;
              console.log(`Redirecting to original destination: ${destination}`);
            } else {
              console.warn(`Invalid redirectTo path received: ${backendRedirectTo}`);
            }
          }
          
          // If no valid redirectTo, use role-based default
          if (destination === "/") {
            const userRole = result.user.role;
            if (userRole === "teacher") {
              destination = "/teacher/dashboard";
            } else if (userRole === "student") {
              destination = "/student/dashboard";
            } else if (userRole === "admin") {
              destination = "/admin/dashboard";
            }
            console.log(`Using role-based default destination: ${destination}`);
          }
          
          setTimeout(() => navigate(destination), 200);
          popup.close();
          setIsLoading(false);
          window.removeEventListener("message", handleMessage);
        } catch (error) {
          console.error("Error establishing session:", error);
          setError(
            "An unexpected error occurred during authentication. Please try again."
          );
          popup.close();
          setIsLoading(false);
          window.removeEventListener("message", handleMessage);
        }
      } else if (event.data.type === "OAUTH_ERROR") {
        // Handle OAuth error
        console.error(`${provider} OAuth error:`, event.data.error);

        // Check if this is an account linking error
        if (event.data.error.code === "account_linking_required") {
          // Extract email from error details
          const email = event.data.error.details || "";

          setAccountLinkingError({
            email,
            message: event.data.error.message,
          });
          setError(null);
        } else {
          setError(
            event.data.error.message ||
              "Authentication failed. Please try again."
          );
        }

        popup.close();
        setIsLoading(false);
        window.removeEventListener("message", handleMessage);
      }
    };

    // Add message listener
    window.addEventListener("message", handleMessage);

    // Handle popup being closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setIsLoading(false);
        window.removeEventListener("message", handleMessage);
      }
    }, 1000);

    // Cleanup function to ensure we don't leave listeners hanging
    const cleanup = () => {
      clearInterval(checkClosed);
      window.removeEventListener("message", handleMessage);
      if (!popup.closed) {
        popup.close();
      }
      setIsLoading(false);
    };

    // Set a timeout in case the popup gets stuck
    setTimeout(() => {
      if (!popup.closed) {
        cleanup();
        console.error(`${provider} OAuth popup timed out`);
      }
    }, 300000); // 5 minutes timeout
  };

  const handleDismissLinkingError = () => {
    setAccountLinkingError(null);
  };

  // Show account linking message if required
  if (accountLinkingError) {
    return (
      <div className={styles.accountLinkingCard}>
        <div className={styles.accountLinkingHeader}>
          <h3 className={styles.accountLinkingTitle}>Account Already Exists</h3>
          <p className={styles.accountLinkingDescription}>
            {accountLinkingError.message}
          </p>
        </div>

        <div className={styles.accountLinkingActions}>
          <Button
            type="button"
            variant="outline"
            onClick={handleDismissLinkingError}
          >
            Got it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={handleOAuthLogin}
        disabled={disabled || isLoading}
        className={`${styles.oauthLoginButton} ${className}`}
        variant="outline"
      >
        {isLoading ? (
          <>
            <Spinner size="sm" />
            <span>Connecting...</span>
          </>
        ) : (
          children
        )}
      </Button>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </>
  );
};
