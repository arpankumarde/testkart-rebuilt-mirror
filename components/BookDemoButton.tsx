import React from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "./Button";
import { useBookDemoDialog } from "../helpers/useBookDemoDialog";

type BookDemoButtonProps = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Defaults to "Book a demo" — override only when the surrounding copy needs it. */
  children?: React.ReactNode;
  /** Set false on dense rows where the icon would crowd the label. */
  withIcon?: boolean;
};

/**
 * Opens the shared demo modal from anywhere on the page. Used across the /sell
 * landing pages, which suppress the corner teaser in favour of inline CTAs.
 */
export const BookDemoButton = ({
  className,
  variant = "outline",
  size = "lg",
  children = "Book a demo",
  withIcon = true,
}: BookDemoButtonProps) => {
  const { open } = useBookDemoDialog();

  return (
    <Button variant={variant} size={size} className={className} onClick={open}>
      {withIcon && <CalendarCheck size={18} />}
      {children}
    </Button>
  );
};
