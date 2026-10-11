import React from "react";
import { Button } from "./Button";
import styles from "./PlayfulButton.module.css";

export type PlayfulTone = "primary" | "soft";
export type PlayfulSize = "xs" | "sm" | "md" | "lg";

/**
 * Class string of the playful skin, for controls that are not a kit Button
 * (a bare <button> inside another component, a tab, a link-styled action).
 */
export const playfulButtonClass = (
  tone: PlayfulTone = "primary",
  size: PlayfulSize = "md",
  extra?: string,
) => `${styles.btn} ${styles[tone]} ${styles[size]} ${extra ?? ""}`.trim();

interface PlayfulButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "variant" | "size"> {
  tone?: PlayfulTone;
  size?: PlayfulSize;
}

/** The kit Button wearing the playful skin; behaviour is the Button's own. */
export const PlayfulButton = React.forwardRef<HTMLButtonElement, PlayfulButtonProps>(
  ({ tone = "primary", size = "md", className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="md"
      className={playfulButtonClass(tone, size, className)}
      {...props}
    />
  ),
);

PlayfulButton.displayName = "PlayfulButton";
