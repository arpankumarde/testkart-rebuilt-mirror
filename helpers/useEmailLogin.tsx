import { useMutation } from "@tanstack/react-query";
import {
  postSendEmailLoginOtp,
  InputType as SendOtpInput,
} from "../endpoints/auth/email-login/send-otp_POST.schema";
import {
  postVerifyEmailLoginOtp,
  InputType as VerifyOtpInput,
  OutputType as VerifyOtpOutput,
} from "../endpoints/auth/email-login/verify-otp_POST.schema";

export const useSendEmailLoginOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendOtpInput) => postSendEmailLoginOtp(data),
  });
};

export const useVerifyEmailLoginOtpMutation = () => {
  return useMutation<VerifyOtpOutput, Error, VerifyOtpInput>({
    mutationFn: (data: VerifyOtpInput) => postVerifyEmailLoginOtp(data),
  });
};