import { DEFAULT_WHATSAPP_TEMPLATE_NAMES, resolveTemplate, templateVariableCount } from "./autopilotWhatsAppTemplates";

describe("autopilot WhatsApp template choice", () => {
  const defaults = DEFAULT_WHATSAPP_TEMPLATE_NAMES;
  const all = new Set([
    "tk_payment_failed_v2",
    "tk_payment_offer_v2",
    "tk_cart_reminder_v2",
    "tk_cart_offer_v2",
    "tk_free_mock_start_v2",
    "tk_free_mock_nudge_v2",
    "tk_full_series_v2",
    "tk_series_offer_v2",
    "tk_more_practice_v2",
  ]);

  it("defaults each playbook to its first-message template", () => {
    expect(defaults.failed_payment).toBe("tk_payment_failed_v2");
    expect(defaults.cart_abandoned).toBe("tk_cart_reminder_v2");
    expect(defaults.onboarding).toBe("tk_free_mock_start_v2");
    expect(defaults.free_to_paid).toBe("tk_full_series_v2");
    expect(defaults.repeat_purchase).toBe("tk_more_practice_v2");
  });

  it("picks the template for each slot", () => {
    expect(resolveTemplate("failed_payment", "first", all, defaults)).toBe("tk_payment_failed_v2");
    expect(resolveTemplate("failed_payment", "followup", all, defaults)).toBe("tk_payment_failed_v2");
    expect(resolveTemplate("failed_payment", "offer", all, defaults)).toBe("tk_payment_offer_v2");
    expect(resolveTemplate("onboarding", "followup", all, defaults)).toBe("tk_free_mock_nudge_v2");
    expect(resolveTemplate("free_to_paid", "offer", all, defaults)).toBe("tk_series_offer_v2");
  });

  it("uses an offer template only when Meta approved it", () => {
    expect(resolveTemplate("cart_abandoned", "offer", new Set(["tk_cart_reminder_v2"]), defaults)).toBeNull();
  });

  it("falls back from a follow-up to the first-message template", () => {
    expect(resolveTemplate("onboarding", "followup", new Set(["tk_free_mock_start_v2"]), defaults)).toBe("tk_free_mock_start_v2");
  });

  it("trusts only configured first-message names when Waplify cannot be reached", () => {
    expect(resolveTemplate("cart_abandoned", "first", null, defaults)).toBe("tk_cart_reminder_v2");
    expect(resolveTemplate("cart_abandoned", "offer", null, defaults)).toBeNull();
  });

  it("puts a hand-set override first", () => {
    const overrides = { ...defaults, cart_abandoned: "tk_custom_cart" };
    expect(resolveTemplate("cart_abandoned", "first", new Set(["tk_custom_cart", ...all]), overrides)).toBe("tk_custom_cart");
  });

  it("counts body variables so WhatsApp gets exactly what the template takes", () => {
    expect(templateVariableCount("tk_cart_reminder_v2")).toBe(2);
    expect(templateVariableCount("tk_cart_offer_v2")).toBe(4);
    expect(templateVariableCount("unknown_name")).toBe(2);
  });
});
