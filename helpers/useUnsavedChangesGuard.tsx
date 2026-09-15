import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { Button } from "../components/Button";

// Warns before unsaved form changes are lost. The app does not run a React
// Router data router, so useBlocker is unavailable; instead this guards a tab
// close or reload (beforeunload), in-app links (a capture-phase click
// listener that runs before React Router sees the click) and the form's own
// buttons (leave). The browser Back button is not covered.
export function useUnsavedChangesGuard(when: boolean, description?: string) {
  const navigate = useNavigate();
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = `${url.pathname}${url.search}${url.hash}`;
      if (to === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingTo(to);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  const leave = useCallback(
    (to: string) => {
      if (when) setPendingTo(to);
      else navigate(to);
    },
    [when, navigate]
  );

  const dialog = (
    <Dialog open={pendingTo !== null} onOpenChange={(open) => !open && setPendingTo(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            {description ?? "Your changes on this page are not saved yet. If you leave now, they are lost."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingTo(null)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const to = pendingTo;
              setPendingTo(null);
              if (to) navigate(to);
            }}
          >
            Leave page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { leave, dialog };
}
