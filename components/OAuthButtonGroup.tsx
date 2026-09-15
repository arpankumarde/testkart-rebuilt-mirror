import React from "react";
import { FcGoogle } from "react-icons/fc";
import { OAuthLoginButton } from "./OAuthLoginButton";
import styles from "./OAuthButtonGroup.module.css";

interface OAuthButtonGroupProps {
  className?: string;
  disabled?: boolean;
  role?: "teacher" | "student";
  redirectTo?: string;
}

export const OAuthButtonGroup: React.FC<OAuthButtonGroupProps> = ({
  className,
  disabled,
  role,
  redirectTo,
}) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <OAuthLoginButton provider="google" disabled={disabled} role={role} redirectTo={redirectTo}>
        <FcGoogle size={20} aria-hidden="true" />
        Continue with Google
      </OAuthLoginButton>
      {/* Add more buttons here for other oauth providers as needed */}
    </div>
  );
};
