import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postSendEmailSignupOtp,
  InputType as SendOtpInput,
} from "../endpoints/auth/email-signup/send-otp_POST.schema";
import {
  postVerifyEmailSignupAndRegister,
  InputType as VerifyInput,
} from "../endpoints/auth/email-signup/verify-and-register_POST.schema";

export const useSendEmailSignupOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendOtpInput) => postSendEmailSignupOtp(data),
  });
};

export const useVerifyEmailSignupAndRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VerifyInput) => postVerifyEmailSignupAndRegister(data),
    onSuccess: () => {
      // Invalidate auth session queries on successful registration
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
};