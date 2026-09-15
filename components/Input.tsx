import React, { forwardRef, InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, onWheel, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${styles.input} ${className || ""}`}
        // Number inputs silently change value when the cursor sits over
        // them while the page is scrolled with a mouse wheel/trackpad —
        // surprising and easy to trigger by accident (e.g. scrolling past a
        // price or duration field). Blurring on wheel makes the scroll just
        // scroll the page instead, same as most modern apps handle this.
        // Composes with any onWheel a caller passes rather than replacing it.
        onWheel={(e) => {
          if (props.type === "number") {
            e.currentTarget.blur();
          }
          onWheel?.(e);
        }}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
