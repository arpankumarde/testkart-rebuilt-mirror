import { courseDiscountPrice, courseEffectivePrice } from "./coursePricing";

/*
 * Live tests follow the course pricing rule: the discount only counts when it
 * sits strictly between 0 and the list price, otherwise the list price applies.
 */
export const liveTestDiscountPrice = courseDiscountPrice;
export const liveTestEffectivePrice = courseEffectivePrice;