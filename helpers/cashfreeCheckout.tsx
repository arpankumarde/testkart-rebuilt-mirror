export type CashfreeMode = "sandbox" | "production";

/** What the purchase endpoints hand the browser so it can open Cashfree's payment window. */
export type CashfreeCheckoutSession = {
  orderId: number;
  cashfreeOrderId: string;
  paymentSessionId: string;
  mode: CashfreeMode;
};

/*
 * Cashfree's SDK opens checkout by posting a form to cashfree.com, which the site's Content
 * Security Policy (form-action) blocks on app pages, popup and redirect alike. So the SDK runs
 * on /_api/payment/cashfree/redirect, which is served without that policy: inside a
 * full-screen frame for the one-time popup, or as the whole tab for autopay.
 */
const REDIRECT_PATH = "/_api/payment/cashfree/redirect";

const submitToRedirect = (
  target: string,
  fields: { kind: "order" | "subscription"; sessionId: string; mode: CashfreeMode }
): void => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = REDIRECT_PATH;
  form.target = target;
  form.style.display = "none";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
};

let popupOpen = false;

/**
 * Opens Cashfree's checkout as a popup over the current page. Every one-time live class
 * order returns to the page it started on, so once Cashfree finishes this reloads the page
 * with ?order_id=...&gateway=cashfree and the page's own verify step takes over. Rejects
 * when the popup is closed or fails, so the caller can show the message.
 */
export const startCashfreeCheckout = (session: CashfreeCheckoutSession): Promise<void> => {
  if (typeof window === "undefined") return Promise.reject(new Error("Payments can only start in the browser."));
  if (popupOpen) return Promise.resolve();
  popupOpen = true;

  return new Promise<void>((resolve, reject) => {
    const frameName = `cashfree-popup-${Date.now()}`;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:transparent;";
    const frame = document.createElement("iframe");
    frame.name = frameName;
    frame.title = "Secure payment";
    frame.allow = "payment; clipboard-write";
    frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal;";
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      overlay.remove();
      document.documentElement.style.overflow = previousOverflow;
      popupOpen = false;
    };

    const goToResult = (href?: string) => {
      window.removeEventListener("message", onMessage);
      const url = href ?? `${window.location.pathname}?order_id=${session.orderId}&gateway=cashfree`;
      window.location.assign(url);
      resolve();
    };

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string; status?: string; message?: string } | null;
      if (!data || data.type !== "testkart-cashfree") return;
      if (data.status === "done") return goToResult();
      cleanup();
      reject(new Error(data.message || "The payment was not completed."));
    }
    window.addEventListener("message", onMessage);

    // If Cashfree finishes by redirecting (bank pages, some UPI flows), the frame lands on
    // the order's return URL on this site: move the whole tab there.
    frame.addEventListener("load", () => {
      let href: string | null = null;
      try {
        href = frame.contentWindow?.location.href ?? null;
      } catch {
        href = null;
      }
      if (!href || href === "about:blank") return;
      const url = new URL(href);
      if (url.origin === window.location.origin && !url.pathname.startsWith(REDIRECT_PATH)) goToResult(url.href);
    });

    submitToRedirect(frameName, { kind: "order", sessionId: session.paymentSessionId, mode: session.mode });
  });
};

/** Opens Cashfree's autopay (mandate) page in this tab; it returns to the subscription's return URL. */
export const startCashfreeSubscriptionCheckout = async (session: { subsSessionId: string; mode: CashfreeMode }): Promise<void> => {
  if (typeof window === "undefined") throw new Error("Payments can only start in the browser.");
  submitToRedirect("_self", { kind: "subscription", sessionId: session.subsSessionId, mode: session.mode });
};
