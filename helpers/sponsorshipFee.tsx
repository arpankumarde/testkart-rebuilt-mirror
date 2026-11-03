/**
 * Teacher-sponsored enrollments carry no platform fee: the teacher pays nothing and the
 * student is enrolled at once. Rows created this way are stored with this payment method.
 * Older rows keep balance_deduction, online_payment or online_pending.
 */
export const SPONSORSHIP_FEE_WAIVED_METHOD = "fee_waived";

export const SPONSORSHIP_FEE_WAIVED_NOTE = "Platform fee waived for sponsored enrollments";
