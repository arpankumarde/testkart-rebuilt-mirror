import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";
import styles from "./PasswordInput.module.css";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Password field with a show/hide toggle. Every prop lands on the input itself, so FormControl's
 * id, aria attributes and error class reach the field rather than the wrapper.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className={styles.wrapper}>
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={`${styles.input} ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={styles.toggle}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";