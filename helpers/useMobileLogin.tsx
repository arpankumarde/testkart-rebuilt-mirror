import { useMutation } from "@tanstack/react-query";
import {
  postSendMobileOtp,
  InputType as SendOtpInput,
} from "../endpoints/auth/mobile-login/send-otp_POST.schema";
import {
  postVerifyMobileOtp,
  InputType as VerifyOtpInput,
  OutputType as VerifyOtpOutput,
} from "../endpoints/auth/mobile-login/verify-otp_POST.schema";

export const useSendMobileOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendOtpInput) => postSendMobileOtp(data),
  });
};

export const useVerifyMobileOtpMutation = () => {
  return useMutation<VerifyOtpOutput, Error, VerifyOtpInput>({
    mutationFn: (data: VerifyOtpInput) => postVerifyMobileOtp(data),
  });
};