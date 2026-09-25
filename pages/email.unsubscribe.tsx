import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { postEmailUnsubscribe } from "../endpoints/email/unsubscribe_POST.schema";
import styles from "./email.unsubscribe.module.css";

// Lists a link can name. The server checks the list and the signed token again.
const LISTS: Record<string, { title: string; description: string }> = {
  teacher_onboarding: {
    title: "Stop teacher tips?",
    description:
      "You will stop getting our onboarding emails for teachers: setup guides, feature tips and teacher stories.",
  },
};

const KEPT = "Emails about your account, sales and payouts still arrive.";

const EmailUnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const list = searchParams.get("list") ?? "";
  const token = searchParams.get("t") ?? "";
  const copy = LISTS[list];

  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleUnsubscribe = async () => {
    setError(null);
    setState("saving");
    try {
      await postEmailUnsubscribe({ list, token });
      setState("done");
    } catch (err) {
      setError(parseErrorMessage(err));
      setState("idle");
    }
  };

  const renderBody = () => {
    if (!copy || !token) {
      return (
        <>
          <h1 className={styles.title}>This link is not complete</h1>
          <p className={styles.description}>
            Open the unsubscribe link from the latest email we sent you, or write to{" "}
            <a className={styles.inlineLink} href="mailto:support@testkart.in">
              support@testkart.in
            </a>{" "}
            and we will do it for you.
          </p>
        </>
      );
    }

    if (state === "done") {
      return (
        <>
          <h1 className={styles.title}>You are unsubscribed</h1>
          <p className={styles.description}>You will not get these emails again. {KEPT}</p>
          <Link className={styles.link} to="/">
            Go to Testkart
          </Link>
        </>
      );
    }

    return (
      <>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>
          {copy.description} {KEPT}
        </p>
        {error && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}
        <Button className={styles.button} onClick={handleUnsubscribe} disabled={state === "saving"}>
          {state === "saving" ? (
            <span className={styles.loading}>
              <Spinner size="sm" />
              Unsubscribing...
            </span>
          ) : (
            "Unsubscribe"
          )}
        </Button>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Unsubscribe - Testkart</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className={styles.page}>
        <div className={styles.card}>{renderBody()}</div>
      </div>
    </>
  );
};

export default EmailUnsubscribePage;