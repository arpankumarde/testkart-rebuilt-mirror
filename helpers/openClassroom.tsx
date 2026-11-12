import type React from "react";
import { toast } from "sonner";

/*
 * Opens a live classroom in its own tab so the dashboard stays open behind it. Only the
 * classroom path travels: the classroom page asks the join endpoint for its own short-lived
 * Daily token after the lobby, so no token or room URL is ever put in a link.
 *
 * The new tab is cut off from this one (opener cleared). When the browser blocks the tab, the
 * classroom opens here instead, so a click never does nothing.
 */
export function openClassroom(path: string) {
  const win = window.open(path, "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      // Some browsers already detach it; nothing to do.
    }
    return;
  }
  toast.info("Your browser blocked the new tab, so the classroom is opening here.");
  window.location.assign(path);
}

/**
 * Click handler for a classroom link rendered as <a href={path}>: a plain click opens the new
 * tab through openClassroom; modified clicks (Ctrl, Cmd, Shift, middle button) are left to the
 * browser.
 */
export function handleClassroomLinkClick(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openClassroom(path);
}
