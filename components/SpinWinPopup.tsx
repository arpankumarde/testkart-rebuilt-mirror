import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgePercent, BookOpen, Check, Copy, Gift, LogIn, ShoppingBag, Ticket, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./Dialog";
import { SpinWinWheel, rotationForSlice } from "./SpinWinWheel";
import { Diya, Hanger, Mandala, Sparkle, diwaliPaletteClass } from "./DiwaliOrnaments";
import { useClaimSpinReward, useSpinWheel, friendlySpinError, shopPathFor } from "../helpers/useSpinWin";
import { useReducedMotion } from "../helpers/useReducedMotion";
import { discountLabel, SPIN_CATEGORY_LABELS, type SpinCategory } from "../helpers/spinWinRules";
import { spinDateTime } from "../helpers/spinWinFormat";
import type { OutputType as CampaignView } from "../endpoints/spin-win/campaign_GET.schema";
import type { SpinViewState } from "../helpers/spinWinViewer";
import styles from "./SpinWinPopup.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: CampaignView;
  /** Set when the student came back from login to claim; the popup claims once on open. */
  autoClaim?: boolean;
  onAutoClaimDone?: () => void;
};

type Screen = "play" | "terms";

/* Six turns over 7s: at least a turn a second for the first 3s, then a slowdown that can be followed. */
const SPIN_MS = 7000;
const SPIN_TURNS = 6;
/* Reduced motion still gets a short, slow spin rather than a jump to the result. */
const REDUCED_SPIN_MS = 3500;
const REDUCED_SPIN_TURNS = 2;

const SPARKLES = [
  { size: 10, duration: 3.4, delay: 0.2, motion: "twinkle" as const, top: "12%", left: "10%" },
  { size: 7, duration: 2.8, delay: 1.1, motion: "twinkle" as const, top: "22%", left: "86%" },
  { size: 9, duration: 3.9, delay: 0.6, motion: "twinkle" as const, top: "78%", left: "8%" },
  { size: 6, duration: 3.1, delay: 1.8, motion: "twinkle" as const, top: "70%", left: "90%" },
];

const CONFETTI_COLORS = ["#E9B957", "#E9DFF7", "#F9DDE9", "#D5F0E4", "#DCEBFA", "#FFF0BE"];

const categoryList = (categories: string[]) => categories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ");

const BENEFIT_NAMES: Record<string, string> = { courses: "Courses", test_series: "Test Series", study_notes: "Notes" };

/* "Courses, Test Series & Notes", in that order, from the campaign's eligible categories. */
function benefitCategories(categories: string[]): string {
  const names = ["courses", "test_series", "study_notes"].filter((c) => categories.includes(c)).map((c) => BENEFIT_NAMES[c]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function claimRedirect(page: "login" | "signup", pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set("spin", "claim");
  return `/${page}?redirectTo=${encodeURIComponent(`${pathname}?${params.toString()}`)}`;
}

const Confetti: React.FC = () => (
  <div className={styles.confetti} aria-hidden="true">
    {Array.from({ length: 28 }, (_, i) => (
      <span
        key={i}
        className={styles.piece}
        style={
          {
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            "--fall-delay": `${(i % 7) * 0.08}s`,
            "--fall-x": `${((i % 5) - 2) * 18}px`,
            "--fall-rot": `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);

export const SpinWinPopup: React.FC<Props> = ({ open, onOpenChange, view, autoClaim, onAutoClaimDone }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const spinMutation = useSpinWheel();
  const claimMutation = useClaimSpinReward();
  const [screen, setScreen] = useState<Screen>("play");
  const [rotation, setRotation] = useState(0);
  const [spinMs, setSpinMs] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [localSpin, setLocalSpin] = useState<SpinViewState | null>(null);
  const claimStarted = useRef(false);
  const timer = useRef<number | null>(null);

  const { campaign, segments, viewer } = view;
  const spin = isSpinning ? null : localSpin ?? viewer.spin;
  const wheelSegments = segments.map((s) => ({ key: s.rewardId, label: s.label, color: s.color }));

  // Opening on an earlier spin shows the wheel resting on that reward.
  useEffect(() => {
    if (!open) return;
    setScreen("play");
    setError(null);
    const existing = localSpin ?? viewer.spin;
    if (existing && existing.wheelIndex >= 0 && !isSpinning) {
      setSpinMs(0);
      setRotation(rotationForSlice(existing.wheelIndex, segments.length, 0, 0, 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const runClaim = () => {
    setError(null);
    claimMutation.mutate(campaign.slug, {
      onSuccess: (result) => {
        if (result.spin) setLocalSpin(result.spin);
        if (result.forfeited) {
          setMessage(result.message ?? "This account has already used its spin for this campaign.");
        } else {
          setMessage(null);
          setCelebrate(true);
          toast.success("Your coupon is saved under My Coupons.");
        }
      },
      onError: (err) => setError(friendlySpinError(err)),
    });
  };

  useEffect(() => {
    if (!open || !autoClaim || claimStarted.current || !viewer.loggedIn) return;
    claimStarted.current = true;
    if (viewer.spin?.requiresLogin) runClaim();
    onAutoClaimDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoClaim, viewer.loggedIn]);

  const startSpin = () => {
    if (isSpinning || spinMutation.isPending) return;
    setError(null);
    setMessage(null);
    setCelebrate(false);
    spinMutation.mutate(campaign.slug, {
      onSuccess: (result) => {
        const index = result.spin.wheelIndex >= 0 ? result.spin.wheelIndex : 0;
        if (result.alreadySpun) {
          setSpinMs(0);
          setRotation(rotationForSlice(index, segments.length, 0, 0, 0));
          setLocalSpin(result.spin);
          setMessage(result.message ?? "You have already spun this campaign. Here is your reward.");
          return;
        }
        const duration = reducedMotion ? REDUCED_SPIN_MS : SPIN_MS;
        setIsSpinning(true);
        setSpinMs(duration);
        setRotation((from) => rotationForSlice(index, segments.length, from, reducedMotion ? REDUCED_SPIN_TURNS : SPIN_TURNS));
        timer.current = window.setTimeout(() => {
          setIsSpinning(false);
          setLocalSpin(result.spin);
          setCelebrate(true);
          setMessage(result.message);
        }, duration + 150);
      },
      onError: (err) => setError(friendlySpinError(err)),
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select the code and copy it instead.");
    }
  };

  const goTo = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const canSpin = viewer.canSpin && !spin;
  const centerButton = canSpin ? (
    <button type="button" className={styles.hubButton} onClick={startSpin} disabled={isSpinning || spinMutation.isPending} aria-label="Spin the wheel">
      SPIN
    </button>
  ) : (
    <span className={styles.hubStatic} aria-hidden="true">
      <Gift size={18} />
    </span>
  );

  const renderAction = () => {
    if (isSpinning || spinMutation.isPending) {
      return <p className={styles.status} role="status">Spinning… good luck!</p>;
    }
    if (spin) {
      const label = spin.discountType ? discountLabel(spin.discountType, spin.discountValue).toUpperCase() : spin.rewardName;
      return (
        <div className={styles.result}>
          <p className={styles.eyebrowWin}>{spin.claimStatus === "forfeited" ? "Spin already used" : "Congratulations! You've Won!"}</p>
          <div className={styles.prizeCard}>
            <span className={styles.prizeLabel}>Reward won</span>
            <p className={styles.prize}>{label}</p>
            <p className={styles.sub}>Your Diwali surprise is ready!</p>
          </div>
          {message ? (
            <p className={styles.notice} role="status">
              {message}
            </p>
          ) : null}
          {!spin.discountType && spin.claimStatus !== "claimed" ? (
            <p className={styles.note}>Our team will contact you about this prize after you claim it.</p>
          ) : null}

          {spin.coupon ? (
            <>
              <div className={styles.ticket}>
                <span className={styles.ticketLabel}>Your coupon code</span>
                <code className={styles.code}>{spin.coupon.code}</code>
                <button type="button" onClick={() => copyCode(spin.coupon!.code)} className={styles.copy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy Code"}
                </button>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => goTo(shopPathFor(spin.eligibleCategories))} className={styles.primary}>
                  <ShoppingBag size={16} /> Shop Now
                </button>
                <button type="button" className={styles.secondary} onClick={() => goTo("/student/coupons")}>
                  My Coupons
                </button>
              </div>
              <p className={styles.fine}>Minimum order, maximum discount and expiry for this coupon are under My Coupons.</p>
            </>
          ) : spin.requiresLogin ? (
            <div className={styles.claimActions}>
              {viewer.loggedIn ? (
                <button type="button" onClick={runClaim} disabled={claimMutation.isPending} className={`${styles.primary} ${styles.claimButton}`}>
                  {claimMutation.isPending ? "Claiming…" : "Claim My Coupon"}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => goTo(claimRedirect("signup", location.pathname, location.search))} className={`${styles.primary} ${styles.claimButton}`}>
                    <UserPlus size={16} aria-hidden="true" /> Sign Up to Claim
                  </button>
                  <button type="button" onClick={() => goTo(claimRedirect("login", location.pathname, location.search))} className={`${styles.secondary} ${styles.claimButton}`}>
                    <LogIn size={16} aria-hidden="true" /> I have an account - Log In
                  </button>
                </>
              )}
              <button type="button" className={styles.claimTerms} onClick={() => setScreen("terms")}>
                View Terms & Conditions
              </button>
              <p className={styles.fine}>
                {viewer.loggedIn
                  ? "Claim it to see your coupon and its details under My Coupons."
                  : "Your reward is saved for this browser session. Once you sign up or log in, your coupon and its details appear under My Coupons."}
              </p>
            </div>
          ) : spin.claimStatus === "claimed" && !spin.discountType ? (
            <p className={styles.note}>Claimed. Our team will be in touch.</p>
          ) : null}
        </div>
      );
    }
    if (viewer.canSpin) {
      return (
        <>
          <ul className={styles.benefits} aria-label="What you get">
            <li>
              <span className={`${styles.benefitIcon} ${styles.benefitPink}`} aria-hidden="true">
                <Gift size={16} />
              </span>
              Guaranteed Reward
            </li>
            <li>
              <span className={`${styles.benefitIcon} ${styles.benefitMint}`} aria-hidden="true">
                <BookOpen size={16} />
              </span>
              Available on {benefitCategories(campaign.eligibleCategories)}
            </li>
            <li>
              <span className={`${styles.benefitIcon} ${styles.benefitYellow}`} aria-hidden="true">
                <BadgePercent size={16} />
              </span>
              Up to {campaign.maxDiscountPercent}% OFF
            </li>
          </ul>
          <div className={styles.actions}>
            <button type="button" onClick={startSpin} className={`${styles.primary} ${styles.cta}`}>
              <Ticket size={18} aria-hidden="true" /> Spin the Wheel
            </button>
          </div>
          <p className={styles.fine}>One spin. One guaranteed reward. Use your coupon on eligible Testkart products.</p>
        </>
      );
    }
    if (viewer.reason === "Log in to spin.") {
      return (
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => goTo(`/login?redirectTo=${encodeURIComponent(`${location.pathname}?spin=open`)}`)}
            className={styles.primary}
          >
            Log in to spin
          </button>
        </div>
      );
    }
    return <p className={styles.note}>{viewer.reason ?? "Spin & Win is not available right now."}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSpinning && onOpenChange(next)}>
      <DialogContent hideCloseButton className={`${styles.content} ${diwaliPaletteClass}`}>
        <button type="button" className={styles.close} onClick={() => !isSpinning && onOpenChange(false)} aria-label="Close" disabled={isSpinning}>
          <X size={18} />
        </button>
        <div className={styles.layout}>
          <section className={styles.stage} aria-label="Prize wheel">
            <Mandala className={styles.rangoli} />
            <Hanger kind="lantern" len={18} duration={6.4} delay={0.4} className={styles.lanternLeft} />
            <Hanger kind="diya" len={34} duration={7.2} delay={1.6} className={styles.lanternRight} />
            {SPARKLES.map((s, i) => (
              <Sparkle key={i} spec={s} style={{ top: s.top, left: s.left }} />
            ))}
            <Diya className={styles.diyaLeft} floating />
            <Diya className={styles.diyaRight} floating delay={1.4} />
            <SpinWinWheel segments={wheelSegments} size={360} rotation={rotation} spinMs={spinMs} center={centerButton} className={styles.wheel} tone="festive" />
            {celebrate && !reducedMotion ? <Confetti /> : null}
          </section>

          <section className={styles.panel}>
            {screen === "terms" ? (
              <div className={styles.terms}>
                <button type="button" className={styles.back} onClick={() => setScreen("play")}>
                  <ArrowLeft size={14} /> Back
                </button>
                <DialogTitle className={styles.termsTitle}>Terms & Conditions</DialogTitle>
                <DialogDescription className={styles.srOnly}>Spin & Win coupon terms</DialogDescription>
                <ul className={styles.rules}>
                  <li>Coupons are valid until {spinDateTime(campaign.couponExpiresAt)} and expire automatically when the campaign ends.</li>
                  <li>Valid only on {categoryList(campaign.eligibleCategories).toLowerCase()}.</li>
                  <li>
                    Every coupon needs a minimum eligible purchase, shown on the coupon under My Coupons. The discount never exceeds{" "}
                    {campaign.maxDiscountPercent}% of the eligible items.
                  </li>
                  <li>One coupon per order. Spin & Win coupons cannot be combined with other promo codes.</li>
                  <li>Log in to claim. Coupons are linked to your account and cannot be shared or transferred.</li>
                  <li>Each coupon can be used once. It is used when payment succeeds; if a payment fails or is cancelled, the coupon stays available until it expires.</li>
                  <li>One spin per account for the whole campaign, or one per browser session when logged out. Refreshing does not give another spin.</li>
                  <li>Testkart may withdraw coupons obtained through misuse.</li>
                </ul>
              </div>
            ) : (
              <>
                <p className={styles.eyebrow}>{campaign.name}</p>
                <DialogTitle className={spin ? styles.srOnly : styles.title}>Diwali Special! Spin & Win</DialogTitle>
                <DialogDescription className={spin ? styles.srOnly : styles.lede}>
                  Your preparation deserves a little extra happiness. Spin the wheel and unlock exciting discounts on Testkart!
                </DialogDescription>
                {renderAction()}
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                {screen === "play" ? (
                  <div className={styles.links}>
                    {spin?.requiresLogin && !spin.coupon ? null : (
                      <button type="button" className={styles.termsLink} onClick={() => setScreen("terms")}>
                        Terms & Conditions
                      </button>
                    )}
                    {spin?.coupon || (spin?.requiresLogin && !viewer.loggedIn) ? null : (
                      <Link to="/student/coupons" className={styles.termsLink} onClick={() => onOpenChange(false)}>
                        See My Coupons
                      </Link>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
