import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { SpinWinPopup } from "./SpinWinPopup";
import { useActiveSpinCampaign } from "../helpers/useSpinWin";
import { useAuth } from "../helpers/useAuth";
import styles from "./SpinWinLauncher.module.css";

/* Pages where the popup and the launcher pill never appear: checkout, payment and sign-in flows. */
const QUIET_PATHS = [/^\/cart/, /^\/payment/, /^\/order\//, /^\/checkout/, /^\/login/, /^\/signup/, /^\/verify-mobile/, /^\/portal\//, /^\/live-portal\//, /^\/teacher/, /^\/admin/];

const seenKey = (slug: string) => `tk_spin_popup_seen_${slug}`;

function readSeen(slug: string): boolean {
  try {
    return window.sessionStorage.getItem(seenKey(slug)) === "1";
  } catch {
    return false;
  }
}

function markSeen(slug: string) {
  try {
    window.sessionStorage.setItem(seenKey(slug), "1");
  } catch {
    // Storage unavailable: the popup may show again on the next page load, which is harmless.
  }
}

/*
 * Mounted once in the public layout. The pill and the automatic popup appear only while the
 * backend says this visitor may still spin: never after a spin, and never for teachers or admins
 * (the backend returns no campaign to them). ?spin=open and ?spin=claim (the return from login)
 * still open the popup on an earlier spin. Browser storage only spares visitors a repeat popup.
 */
export const SpinWinLauncher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const authReady = authState.type !== "loading";
  const userId = authState.type === "authenticated" ? authState.user.id : null;
  const quiet = QUIET_PATHS.some((re) => re.test(location.pathname));
  const { data, refetch } = useActiveSpinCampaign(authReady);
  const [open, setOpen] = useState(false);
  const [autoClaim, setAutoClaim] = useState(false);

  const view = data?.active ?? null;
  const spinParam = new URLSearchParams(location.search).get("spin");

  // A login or logout changes who the backend sees, so reload the viewer's spin.
  useEffect(() => {
    if (authReady) refetch();
  }, [userId, authReady, refetch]);

  useEffect(() => {
    if (!view || quiet || !spinParam) return;
    setAutoClaim(spinParam === "claim");
    setOpen(true);
    markSeen(view.campaign.slug);
    const params = new URLSearchParams(location.search);
    params.delete("spin");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }, [view, quiet, spinParam, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!view || quiet || open || !view.campaign.popupEnabled || !view.viewer.canSpin) return;
    if (readSeen(view.campaign.slug)) return;
    const id = window.setTimeout(() => {
      markSeen(view.campaign.slug);
      setOpen(true);
    }, view.campaign.popupDelaySeconds * 1000);
    return () => window.clearTimeout(id);
  }, [view, quiet, open]);

  if (!view || quiet || view.campaign.phase !== "active") return null;

  return (
    <>
      {!open && view.viewer.canSpin ? (
        <button type="button" className={styles.pill} onClick={() => setOpen(true)}>
          <Gift size={18} aria-hidden="true" />
          <span>Spin &amp; Win</span>
        </button>
      ) : null}
      <SpinWinPopup open={open} onOpenChange={setOpen} view={view} autoClaim={autoClaim} onAutoClaimDone={() => setAutoClaim(false)} />
    </>
  );
};
