import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { usePayLinkInfo } from "../helpers/usePayLink";
import { formatOfferInr } from "../helpers/courseCouponOffer";
import { payLinkRedirectPath } from "../endpoints/pay-link/redirect_GET.schema";
import styles from "./pay.$token.module.css";

const KIND_LABEL = { test: "Test series", course: "Course", digitalProduct: "Study notes" } as const;

const formatDateTime = (value: Date) =>
  new Date(value)
    .toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(/\//g, "-");

const PayLinkPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error } = usePayLinkInfo(token);
  const [starting, setStarting] = useState(false);

  const body = (() => {
    if (isLoading) {
      return (
        <div className={styles.card}>
          <Skeleton style={{ width: "60%", height: "28px" }} />
          <Skeleton style={{ width: "100%", height: "120px", marginTop: "var(--spacing-4)" }} />
        </div>
      );
    }
    if (isError || !data) {
      return (
        <div className={styles.card}>
          <AlertCircle size={40} className={styles.errorIcon} aria-hidden="true" />
          <h1 className={styles.title}>Link not valid</h1>
          <p className={styles.text}>{error instanceof Error ? error.message : "This payment link is not valid. Ask for a new one."}</p>
        </div>
      );
    }
    if (data.status === "paid") {
      return (
        <div className={styles.card}>
          <CheckCircle size={40} className={styles.okIcon} aria-hidden="true" />
          <h1 className={styles.title}>Already paid</h1>
          <p className={styles.text}>This order for {data.studentName} has been paid. Thank you.</p>
        </div>
      );
    }
    if (data.status === "expired") {
      return (
        <div className={styles.card}>
          <Clock size={40} className={styles.mutedIcon} aria-hidden="true" />
          <h1 className={styles.title}>Link expired</h1>
          <p className={styles.text}>This payment link expired on {formatDateTime(data.expiresAt)}. Ask {data.studentName} to send a new one.</p>
        </div>
      );
    }
    if (data.status === "nothing_to_pay") {
      return (
        <div className={styles.card}>
          <CheckCircle size={40} className={styles.okIcon} aria-hidden="true" />
          <h1 className={styles.title}>Nothing to pay</h1>
          <p className={styles.text}>{data.studentName} already has everything on this link.</p>
        </div>
      );
    }

    return (
      <div className={styles.card}>
        <p className={styles.eyebrow}>Payment request</p>
        <h1 className={styles.title}>Pay for {data.studentName}'s Testkart order</h1>
        <p className={styles.text}>
          {data.studentName}
          {data.maskedPhone ? ` (mobile ${data.maskedPhone})` : ""} asked you to pay for these. They get the items in their own account as soon as you pay.
        </p>

        <ul className={styles.items}>
          {data.items.map((item, index) => (
            <li key={`${item.kind}-${index}`} className={styles.item}>
              <span className={styles.itemText}>
                <span className={styles.itemKind}>{KIND_LABEL[item.kind]}</span>
                <span className={styles.itemTitle}>{item.title}</span>
              </span>
              <span className={styles.itemPrice}>{formatOfferInr(item.price)}</span>
            </li>
          ))}
        </ul>

        <dl className={styles.totals}>
          {data.discount > 0 ? (
            <div className={styles.totalRow}>
              <dt>Teacher offer</dt>
              <dd>-{formatOfferInr(data.discount)}</dd>
            </div>
          ) : null}
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <dt>To pay</dt>
            <dd>{formatOfferInr(data.amount)}</dd>
          </div>
        </dl>

        <Button
          size="lg"
          className={styles.payButton}
          disabled={starting || !token}
          onClick={() => {
            if (!token) return;
            setStarting(true);
            window.location.href = payLinkRedirectPath(token);
          }}
        >
          {starting ? "Opening PayU..." : `Pay ${formatOfferInr(data.amount)}`}
        </Button>

        <div className={styles.safety}>
          <ShieldCheck size={18} aria-hidden="true" className={styles.safetyIcon} />
          <p>
            Pay only if {data.studentName} asked you to. The payment goes through PayU on testkart.in. Testkart never asks for money on any other website, and paying here does not sign you in to their account. Valid till {formatDateTime(data.expiresAt)}.
          </p>
        </div>
      </div>
    );
  })();

  return (
    <>
      <Helmet>
        <title>Pay for a Testkart order</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className={styles.page}>
        {body}
        <p className={styles.footerNote}>
          Questions? <Link to="/contact">Contact Testkart support</Link>.
        </p>
      </div>
    </>
  );
};

export default PayLinkPage;
