import { z } from "zod";
import superjson from "superjson";
import {
  CONTENT_REPORT_CATEGORY_VALUES,
  COPYRIGHT_CATEGORY,
  COPYRIGHT_MATERIAL_VALUES,
  isValidReportPhone,
} from "../../helpers/contentReportTypes";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const schema = z
  .object({
    category: z.enum(CONTENT_REPORT_CATEGORY_VALUES, {
      errorMap: () => ({ message: "Choose what the issue is" }),
    }),
    description: z
      .string()
      .trim()
      .min(10, "Please describe the issue in at least 10 characters")
      .max(4000, "Please keep the description under 4000 characters"),
    locationHint: optionalText(500),
    suggestedCorrection: optionalText(4000),
    email: z
      .string({ required_error: "Your email address is required" })
      .trim()
      .min(1, "Your email address is required")
      .email("Enter a valid email address")
      .max(255),
    phone: z
      .string({ required_error: "Your phone number is required" })
      .trim()
      .min(1, "Your phone number is required")
      .max(20, "Enter a valid phone number")
      .refine(isValidReportPhone, "Enter a valid phone number"),
    /** Copyright reports only. */
    reporterName: optionalText(150),
    copyrightMaterialType: z.enum(COPYRIGHT_MATERIAL_VALUES).optional(),
    copyrightMaterialLocation: optionalText(2000),
    copyrightOriginalSource: optionalText(2000),
    pageUrl: z.string().trim().min(1).max(2000),
    pageTitle: optionalText(300),
    detectedSection: optionalText(300),
    selectedText: optionalText(1000),
    /** One per opened form, so a double submit or a retry stores a single report. */
    clientToken: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    /** How long the form was open before submitting, in milliseconds. */
    fillMs: z.number().int().min(0),
    /** Honeypot. Hidden from people; a bot that fills it is dropped silently. */
    website: z.string().max(500).optional(),
    /** Cloudflare Turnstile token. Checked with Cloudflare on every submission. */
    turnstileToken: z.string().max(4096).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category !== COPYRIGHT_CATEGORY) return;
    if (!value.copyrightMaterialType) {
      ctx.addIssue({ code: "custom", path: ["copyrightMaterialType"], message: "Choose the type of copyrighted material" });
    }
    if (!value.copyrightMaterialLocation) {
      ctx.addIssue({ code: "custom", path: ["copyrightMaterialLocation"], message: "Tell us where the material appears" });
    }
  });

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  reportId: number | null;
  duplicate: boolean;
};

/** Set on refusals caused by the security check, so the form knows to run it again. */
export type CaptchaErrorCode = "captcha_missing" | "captcha_expired" | "captcha_failed" | "captcha_unavailable";

export class ContentReportError extends Error {
  constructor(message: string, readonly code?: CaptchaErrorCode) {
    super(message);
    this.name = "ContentReportError";
  }
}

export const postContentReport = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/content-reports/submit`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error?: string; code?: CaptchaErrorCode };
    throw new ContentReportError(
      errorObject.error || "We could not submit your report. Please try again.",
      errorObject.code
    );
  }

  return responseJson as OutputType;
};
