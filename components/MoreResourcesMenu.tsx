import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { MORE_RESOURCES, isMoreResourcePath } from "../helpers/moreResources";
import styles from "./MoreResourcesMenu.module.css";

/* Long enough to cross the gap between the trigger and the menu. */
const HOVER_CLOSE_MS = 150;

interface MoreResourcesMenuProps {
  /** The control that opens the menu. It must forward its ref and props to a button. */
  trigger: React.ReactElement;
  /** Also opens on mouse hover, for the navbar. Clicking still works, and touch and keyboard are unaffected. */
  openOnHover?: boolean;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}

/** Current Affairs, Exam News, Glossary and Blogs, as a dropdown of ordinary links. */
export const MoreResourcesMenu: React.FC<MoreResourcesMenuProps> = ({ trigger, openOnHover = false, side = "bottom", align = "start" }) => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closedByMouse = useRef(false);

  const cancelClose = () => clearTimeout(closeTimer.current);
  useEffect(() => cancelClose, []);

  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  };

  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closedByMouse.current = true;
      setOpen(false);
    }, HOVER_CLOSE_MS);
  };

  const hoverProps = openOnHover ? { onPointerEnter, onPointerLeave } : {};

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        ref={triggerRef}
        asChild
        {...hoverProps}
        // The menu is already open under the mouse by the time it clicks, so that click must not shut it.
        onPointerDown={(event) => {
          if (openOnHover && open && event.pointerType === "mouse") event.preventDefault();
        }}
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className={styles.menu}
        {...hoverProps}
        onInteractOutside={(event) => {
          if (openOnHover && triggerRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          // Hand focus back to the trigger for keyboard users only, so hovering past it leaves no ring.
          if (closedByMouse.current) event.preventDefault();
          closedByMouse.current = false;
        }}
      >
        {MORE_RESOURCES.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild className={styles.item}>
            <Link to={href} aria-current={isMoreResourcePath(pathname, href) ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden="true" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};