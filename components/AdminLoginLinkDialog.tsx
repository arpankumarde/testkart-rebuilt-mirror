import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import {
  useAdminLoginLinksQuery,
  useCreateLoginLinkMutation,
  useRevokeLoginLinkMutation,
} from "../helpers/useAdminLoginLinks";
import {
  buildLoginLinkUrl,
  DEFAULT_LOGIN_LINK_EXPIRY_MINUTES,
  LOGIN_LINK_EXPIRY_OPTIONS,
  type LoginLinkStatus,
  type LoginLinkView,
} from "../helpers/loginLinks";
import { formatIstDateTime } from "../helpers/accountStatus";
import styles from "./AdminLoginLinkDialog.module.css";

export interface LoginLinkTarget {
  id: number;
  name: string;
  role: "student" | "teacher";
}

interface Props {
  target: LoginLinkTarget | null;
  onClose: () => void;
}

const STATUS_BADGE: Record<LoginLinkStatus, { label: string; variant: "success" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "success" },
  used: { label: "Used", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  revoked: { label: "Cancelled", variant: "destructive" },
};

const usesText = (link: LoginLinkView) => {
  if (link.useCount === 0) return "Not opened yet";
  const times = link.useCount === 1 ? "once" : `${link.useCount} times`;
  return `Used ${times}, last ${formatIstDateTime(link.lastUsedAt ?? link.createdAt)}`;
};

/*
 * Creates a temporary sign-in link for a student or teacher, for when they cannot sign in
 * themselves. The link is shown once; the list below keeps the record and lets an admin cancel
 * a link that is still active.
 */
export const AdminLoginLinkDialog: React.FC<Props> = ({ target, onClose }) => {
  const [expiry, setExpiry] = useState(String(DEFAULT_LOGIN_LINK_EXPIRY_MINUTES));
  const [singleUse, setSingleUse] = useState(true);
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{ url: string; link: LoginLinkView } | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  const linksQuery = useAdminLoginLinksQuery(target?.id ?? null);
  const createMutation = useCreateLoginLinkMutation();
  const revokeMutation = useRevokeLoginLinkMutation(target?.id ?? null);

  useEffect(() => {
    if (!target) return;
    setExpiry(String(DEFAULT_LOGIN_LINK_EXPIRY_MINUTES));
    setSingleUse(true);
    setNote("");
    setCreated(null);
    setCopied(false);
  }, [target?.id]);

  const pending = createMutation.isPending;
  const roleWord = target?.role === "teacher" ? "teacher" : "student";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || pending) return;
    createMutation.mutate(
      {
        userId: target.id,
        expiresInMinutes: Number(expiry),
        singleUse,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setCreated({ url: buildLoginLinkUrl(window.location.origin, data.token), link: data.link });
          setCopied(false);
        },
      }
    );
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      toast.success("Link copied.");
    } catch {
      urlRef.current?.select();
      toast.error("Could not copy. The link is selected, so press Ctrl+C.");
    }
  };

  const links = linksQuery.data?.links ?? [];

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <div className={styles.header}>
            <span className={styles.icon} aria-hidden="true">
              <Link2 size={20} />
            </span>
            <div className={styles.headings}>
              <DialogTitle className={styles.title}>Sign-in link for {target?.name}</DialogTitle>
              <DialogDescription className={styles.description}>
                Whoever opens this link is signed in as this {roleWord}, with no OTP. Send it only to the account
                owner.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {created ? (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-link-url">
                Link (shown only now)
              </label>
              <div className={styles.urlRow}>
                <Input
                  id="login-link-url"
                  ref={urlRef}
                  readOnly
                  value={created.url}
                  className={styles.urlInput}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="primary" onClick={copy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className={styles.hint}>
                Works until {formatIstDateTime(created.link.expiresAt)}
                {created.link.singleUse ? ", for one sign-in." : ", as many times as it is opened."} Testkart does
                not keep a copy, so make a new link if this one is lost.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreated(null)}>
                Make another link
              </Button>
              <Button type="button" variant="primary" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-link-expiry">
                Link expires after
              </label>
              <Select value={expiry} onValueChange={setExpiry} disabled={pending}>
                <SelectTrigger id="login-link-expiry" className={styles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGIN_LINK_EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.minutes} value={String(option.minutes)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.field}>
              <span className={styles.label} id="login-link-uses">
                Can be used
              </span>
              <div className={styles.modes} role="radiogroup" aria-labelledby="login-link-uses">
                <button
                  type="button"
                  role="radio"
                  aria-checked={singleUse}
                  className={styles.mode}
                  onClick={() => setSingleUse(true)}
                  disabled={pending}
                >
                  <span className={styles.modeTitle}>Once</span>
                  <span className={styles.modeText}>Stops working after the first sign-in</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!singleUse}
                  className={styles.mode}
                  onClick={() => setSingleUse(false)}
                  disabled={pending}
                >
                  <span className={styles.modeTitle}>Until it expires</span>
                  <span className={styles.modeText}>For signing in on more than one device</span>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-link-note">
                Note for the record (optional)
              </label>
              <Input
                id="login-link-note"
                value={note}
                maxLength={300}
                placeholder="For example: OTP not arriving, ticket from 13-11-2026"
                onChange={(e) => setNote(e.target.value)}
                disabled={pending}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                <Link2 size={16} />
                {pending ? "Creating..." : "Create link"}
              </Button>
            </DialogFooter>
          </form>
        )}

        <section className={styles.recent} aria-labelledby="login-link-recent">
          <h3 className={styles.recentTitle} id="login-link-recent">
            Recent links
          </h3>
          {linksQuery.isLoading ? (
            <div className={styles.recentList}>
              <Skeleton style={{ height: "3rem", width: "100%" }} />
              <Skeleton style={{ height: "3rem", width: "100%" }} />
            </div>
          ) : linksQuery.isError ? (
            <p className={styles.hint}>Could not load the earlier links.</p>
          ) : links.length === 0 ? (
            <p className={styles.hint}>No links made for this account yet.</p>
          ) : (
            <ul className={styles.recentList}>
              {links.map((link) => {
                const badge = STATUS_BADGE[link.status];
                return (
                  <li key={link.id} className={styles.recentItem}>
                    <div className={styles.recentMain}>
                      <div className={styles.recentLine}>
                        <Badge variant={badge.variant} className={styles.badge}>
                          {badge.label}
                        </Badge>
                        <span className={styles.recentMeta}>
                          {link.singleUse ? "One sign-in" : "Reusable"}, by {link.createdBy},{" "}
                          {formatIstDateTime(link.createdAt)}
                        </span>
                      </div>
                      <span className={styles.recentDetail}>
                        {link.status === "revoked"
                          ? `Cancelled${link.revokedBy ? ` by ${link.revokedBy}` : ""}${link.revokedAt ? `, ${formatIstDateTime(link.revokedAt)}` : ""}`
                          : `${link.status === "expired" ? "Expired" : "Expires"} ${formatIstDateTime(link.expiresAt)}`}
                        {". "}
                        {usesText(link)}.
                      </span>
                      {link.note && <span className={styles.recentNote}>{link.note}</span>}
                    </div>
                    {link.status === "active" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={styles.revoke}
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate({ id: link.id })}
                      >
                        Cancel link
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};