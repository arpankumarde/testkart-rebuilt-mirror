import React, { useState, useEffect, forwardRef } from "react";
import { Input } from "./Input";
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import styles from "./PhoneNumberInput.module.css";

interface PhoneNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /**
   * Hint text to display below the input. Useful for showing format examples or requirements.
   */
  hint?: string;
}

export const PhoneNumberInput = forwardRef<
  HTMLInputElement,
  PhoneNumberInputProps
>(({ value, onChange, error, hint, className, ...props }, ref) => {
  // Internal state to handle the display value which includes formatting
  const [displayValue, setDisplayValue] = useState("");

  // Sync internal display value when external value changes
  useEffect(() => {
    if (!value) {
      setDisplayValue("");
      return;
    }

    // Extract sanitized core 10-digit number
    const coreNumber = sanitizeMobileInput(value);

    // Format: XXXXX XXXXX (space after 5 digits)
    let formatted = "";
    if (coreNumber.length > 0) {
      if (coreNumber.length <= 5) {
        formatted = coreNumber;
      } else {
        formatted = coreNumber.slice(0, 5) + " " + coreNumber.slice(5, 10);
      }
    }
    
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // If user is deleting everything, clear it
    if (inputValue === "") {
      onChange("");
      return;
    }

    // Extract sanitized core 10-digit number
    const coreNumber = sanitizeMobileInput(inputValue);

    onChange(coreNumber);
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Input
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder="98765 43210"
        className={`${styles.input} ${error ? styles.error : ""}`}
        maxLength={11} // 5 digits + space (1) + 5 digits = 11 chars
        {...props}
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
});

PhoneNumberInput.displayName = "PhoneNumberInput";