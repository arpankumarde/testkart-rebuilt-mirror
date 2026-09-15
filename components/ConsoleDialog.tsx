import React from "react";
import { X } from "lucide-react";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "./Dialog";
import { Button } from "./Button";
import styles from "./ConsoleDialog.module.css";

type ConsoleDialogSize = "sm" | "md" | "lg" | "xl";

const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]';

interface ConsoleDialogContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, "hideCloseButton"> {
  /* sm 28rem, md 36rem, lg 46rem, xl 64rem. */
  size?: ConsoleDialogSize;
}

/*
 * The console modal frame: a sticky header carrying the title and close button,
 * a padded body, and a sticky footer for actions. The frame is the scroll
 * container, so a body and footer wrapped together in a <form> still keep both
 * edges pinned.
 *
 * Use inside the kit's <Dialog>. Yes/no confirmations go through
 * ConsoleConfirmDialog instead.
 */
export const ConsoleDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  ConsoleDialogContentProps
>(({ size = "md", className, onOpenAutoFocus, children, ...props }, ref) => (
  <DialogContent
    ref={ref}
    hideCloseButton
    className={`${styles.content} ${styles[size]} ${className ?? ""}`}
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented) return;
      /* The header's close button comes first in the DOM; open on the first
         visible text field instead so a form is ready to type into. */
      const container = event.currentTarget as HTMLElement | null;
      const field = Array.from(container?.querySelectorAll<HTMLElement>(FIELD_SELECTOR) ?? []).find(
        (el) => el.getClientRects().length > 0
      );
      if (field) {
        event.preventDefault();
        field.focus();
      }
    }}
    {...props}
  >
    {children}
  </DialogContent>
));
ConsoleDialogContent.displayName = "ConsoleDialogContent";

interface ConsoleDialogHeaderProps {
  title: React.ReactNode;
  /* Inline content only - it renders inside a <p>. */
  description?: React.ReactNode;
  /* A lucide icon element, shown in a tile beside the title. */
  icon?: React.ReactNode;
  tone?: "default" | "destructive";
  hideClose?: boolean;
  className?: string;
  /* Extra lines under the title, such as a row of status badges. */
  children?: React.ReactNode;
}

export const ConsoleDialogHeader = ({
  title,
  description,
  icon,
  tone = "default",
  hideClose = false,
  className,
  children,
}: ConsoleDialogHeaderProps) => (
  <div className={`${styles.header} ${icon ? styles.withIcon : ""} ${className ?? ""}`}>
    {icon ? (
      <span
        className={`${styles.icon} ${tone === "destructive" ? styles.iconDestructive : ""}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    ) : null}
    <div className={styles.headings}>
      <DialogTitle className={styles.title}>{title}</DialogTitle>
      {description ? (
        <DialogDescription className={styles.description}>{description}</DialogDescription>
      ) : null}
      {children}
    </div>
    {hideClose ? null : (
      <DialogClose asChild>
        <Button variant="ghost" size="icon" aria-label="Close" className={styles.close}>
          <X size={16} />
        </Button>
      </DialogClose>
    )}
  </div>
);

export const ConsoleDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.body} ${className ?? ""}`} {...props} />
);

export const ConsoleDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.footer} ${className ?? ""}`} {...props} />
);