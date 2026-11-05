import React, { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, MessageCircle } from "lucide-react";
import { Button } from "./Button";
import { useCreatePayLink } from "../helpers/usePayLink";
import { formatOfferInr } from "../helpers/courseCouponOffer";
import styles from "./PayLinkShare.module.css";

/** On the cart: make a link a parent or friend can pay from their own phone. */
export const PayLinkShare: React.FC<{ className?: string }> = ({ className }) => {
  const createLink = useCreatePayLink();
  const [copied, setCopied] = useState(false);
  const link = createLink.data;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Press and hold the link to copy it.");
    }
  };

  const expires = link
    ? new Date(link.expiresAt).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-")
    : null;

  return (
    <section className={`${styles.card} ${className ?? ""}`} aria-labelledby="pay-link-heading">
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <Link2 size={18} />
        </span>
        <div>
          <h2 id="pay-link-heading" className={styles.title}>
            Someone else paying?
          </h2>
          <p className={styles.text}>
            Send a payment link to a parent or friend. They pay on testkart.in from their own phone, and the items come to your account.
          </p>
        </div>
      </div>

      {link ? (
        <div className={styles.result}>
          <p className={styles.linkLine}>
            <span className={styles.amount}>{formatOfferInr(link.amount)}</span> for {link.itemCount} item{link.itemCount === 1 ? "" : "s"}. Valid till {expires}.
          </p>
          <code className={styles.url}>{link.url}</code>
          <div className={styles.actions}>
            <Button asChild className={styles.whatsapp}>
              <a href={`https://wa.me/?text=${encodeURIComponent(link.shareText)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> Send on WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={copy}>
              <Copy size={16} /> {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className={styles.note}>The link is for the items in your cart now. If you change the cart, make a new link.</p>
        </div>
      ) : (
        <Button
          variant="outline"
          className={styles.create}
          disabled={createLink.isPending}
          onClick={() =>
            createLink.mutate(undefined, {
              onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the link"),
            })
          }
        >
          {createLink.isPending ? "Creating link..." : "Create payment link"}
        </Button>
      )}
    </section>
  );
};
