import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postSendMobileSignupOtp,
  InputType as SendOtpInput,
} from "../endpoints/auth/mobile-signup/send-otp_POST.schema";
import {
  postVerifyAndRegister,
  InputType as VerifyInput,
} from "../endpoints/auth/mobile-signup/verify-and-register_POST.schema";

export const useSendMobileSignupOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendOtpInput) => postSendMobileSignupOtp(data),
  });
};

export const useVerifyAndRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VerifyInput) => postVerifyAndRegister(data),
    onSuccess: () => {
      // Invalidate any queries that might be affected by a new user,
      // though for signup, this is less critical than for login.
      // A full reset might be too aggressive, but we can invalidate session/auth queries.
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
};