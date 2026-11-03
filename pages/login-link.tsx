import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../helpers/useAuth";
import { announceSessionChange } from "../helpers/sessionSync";
import { getRoleHomePath } from "../helpers/roleHomePath";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { formatIstDateTime } from "../helpers/accountStatus";
import { BrandFavicons } from "../helpers/BrandFavicons";
import { getSession } from "../endpoints/auth/session_GET.schema";
import { postLoginLinkInspect, OutputType as InspectResult } from "../endpoints/auth/login-link/inspect_POST.schema";
import { postLoginLinkRedeem } from "../endpoints/auth/login-link/redeem_POST.schema";
import styles from "./login-link.module.css";

type State =
  | { type: "checking" }
  | { type: "ready"; link: Extract<InspectResult, { valid: true }> }
  | { type: "refused"; message: string };

const readTokenOnce = (() => {
  let token: string | null = null;
  return () => {
    if (token === null && typeof window !== "undefined") {
      token = window.location.hash.replace(/^#/, "");
      if (token) window.history.replaceState(null, "", window.location.pathname);
    }
    return token ?? "";
  };
})();

/*
 * Opened from an admin-made sign-in link (/login-link#<token>). The token sits in the fragment
 * so it never reaches server logs, and is cleared from the address bar on load. Signing in
 * needs a click, so link previews in chat apps cannot use up a one-time link.
 */
const LoginLinkPage: React.FC = () => {
  const { authState } = useAuth();
  const [token] = useState(readTokenOnce);
  const [state, setState] = useState<State>({ type: "checking" });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({
        type: "refused",
        message: "This sign-in link is incomplete. Open the full link you were sent, or ask Testkart support for a new one.",
      });
      return;
    }
    let cancelled = false;
    postLoginLinkInspect({ token })
      .then((result) => {
        if (cancelled) return;
        setState(result.valid ? { type: "ready", link: result } : { type: "refused", message: result.message });
      })
      .catch((err) => {
        if (!cancelled) setState({ type: "refused", message: parseErrorMessage(err) || "Could not check this link." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await postLoginLinkRedeem({ token });
      announceSessionChange();
      const session = await getSession();
      const destination = "error" in session ? "/" : getRoleHomePath(session.user);
      window.location.replace(destination);
    } catch (err) {
      setError(parseErrorMessage(err) || "Could not sign you in. Try again.");
      setSigningIn(false);
    }
  };

  const signedInAs = authState.type === "authenticated" ? authState.user.displayName : null;

  return (
    <>
      <Helmet>
        <title>Sign in | Testkart</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <BrandFavicons />
      <div className={styles.page}>
        <div className={styles.card}>
          {state.type === "checking" && (
            <div className={styles.body} aria-busy="true">
              <Skeleton style={{ height: "2rem", width: "70%", margin: "0 auto" }} />
              <Skeleton style={{ height: "1rem", width: "90%", margin: "0 auto" }} />
              <Skeleton style={{ height: "2.75rem", width: "100%" }} />
            </div>
          )}

          {state.type === "refused" && (
            <div className={styles.body}>
              <span className={`${styles.icon} ${styles.iconError}`} aria-hidden="true">
                <AlertCircle size={24} />
              </span>
              <h1 className={styles.title}>This link does not work</h1>
              <p className={styles.text}>{state.message}</p>
              <Button asChild variant="outline" className={styles.action}>
                <Link to="/login">Go to the sign-in page</Link>
              </Button>
            </div>
          )}

          {state.type === "ready" && (
            <div className={styles.body}>
              <span className={styles.icon} aria-hidden="true">
                <LogIn size={24} />
              </span>
              <h1 className={styles.title}>Sign in as {state.link.displayName}</h1>
              <p className={styles.text}>
                The Testkart team made this link for your {state.link.role} account. It works until{" "}
                {formatIstDateTime(state.link.expiresAt)}.
              </p>
              {signedInAs && signedInAs !== state.link.displayName && (
                <p className={styles.notice}>
                  This browser is signed in as {signedInAs}. Continuing signs it in as {state.link.displayName} instead.
                </p>
              )}
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <Button variant="primary" className={styles.action} onClick={signIn} disabled={signingIn}>
                {signingIn ? "Signing in..." : "Continue"}
              </Button>
              <p className={styles.small}>Not you? Close this page and do not share the link.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LoginLinkPage;