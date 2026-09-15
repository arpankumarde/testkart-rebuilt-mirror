import React from "react";
import { FcGoogle } from "react-icons/fc";
import { OAuthLoginButton } from "./OAuthLoginButton";

interface FlootLoginButtonProps {
  className?: string;
  disabled?: boolean;
}

export const FlootLoginButton: React.FC<FlootLoginButtonProps> = ({
  className,
  disabled,
}) => {
  return (
    <OAuthLoginButton
      provider="floot"
      className={className}
      disabled={disabled}
    >
      <FcGoogle size={20} aria-hidden="true" />
      <span>Continue with Google</span>
    </OAuthLoginButton>
  );
};
