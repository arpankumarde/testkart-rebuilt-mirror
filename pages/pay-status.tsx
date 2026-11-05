import React from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "../components/Button";
import { paymentFailureReason } from "../helpers/paymentFailureReason";
import styles from "./pay.$token.module.css";

/** Where PayU sends someone who paid through a payment link. It shows no order details. */
const PayStatusPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const failure = paymentFailureReason.parse(searchParams.get("reason"));

  const content =
    status === "success" ? (
      <>
        <CheckCircle size={40} className={styles.okIcon} aria-hidden="true" />
        <h1 className={styles.title}>Payment received</h1>
        <p className={styles.text}>Thank you. The items are now in the student's Testkart account, and they can start using them right away.</p>
      </>
    ) : (
      <>
        <AlertCircle size={40} className={styles.errorIcon} aria-hidden="true" />
        <h1 className={styles.title}>{status === "cancelled" ? "Payment cancelled" : "Payment did not go through"}</h1>
        <p className={styles.text}>
          {failure ? `${failure.payerMessage} ` : ""}No money was taken for this order. Open the payment link again to try once more. If money left your account, it is returned by your bank within 5-7 working days.
        </p>
      </>
    );

  return (
    <>
      <Helmet>
        <title>Payment status | Testkart</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className={styles.page}>
        <div className={styles.card}>
          {content}
          <Button asChild variant="outline" style={{ marginTop: "var(--spacing-5)" }}>
            <Link to="/">Visit Testkart</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default PayStatusPage;
