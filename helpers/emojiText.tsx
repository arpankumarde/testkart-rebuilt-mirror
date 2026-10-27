import { z } from "zod";

// Built from code points so no escape sequence or invisible character sits in the source.
const cp = (...codes: number[]) => String.fromCodePoint(...codes);

// Extended_Pictographic characters that read as typography (trademark, arrows, small shapes), not emoji.
const KEEP = cp(
  0xa9, 0xae, 0x2122, 0x203c, 0x2049, 0x2194, 0x2195, 0x2196, 0x2197, 0x2198, 0x2199, 0x21a9, 0x21aa,
  0x25aa, 0x25ab, 0x25b6, 0x25c0, 0x25fb, 0x25fc, 0x27a1, 0x2934, 0x2935, 0x2b05, 0x2b06, 0x2b07
);
const VARIATION_16 = cp(0xfe0f);
const ZWJ = cp(0x200d);
const KEYCAP = cp(0x20e3);
const TAG_RANGE = `${cp(0xe0020)}-${cp(0xe007f)}`;

const UNIT = `(?:\\p{Regional_Indicator}|(?![${KEEP}])\\p{Extended_Pictographic})${VARIATION_16}?\\p{Emoji_Modifier}?${VARIATION_16}?`;
// ZWJ is only matched inside an emoji sequence: Indic scripts use it on its own.
const EMOJI_SOURCE = `${UNIT}(?:${ZWJ}${UNIT})*|\\p{Emoji_Modifier}|[${VARIATION_16}${KEYCAP}${TAG_RANGE}]`;

const EMOJI_TEST = new RegExp(EMOJI_SOURCE, "u");

export const hasEmoji = (value: string): boolean => EMOJI_TEST.test(value);

/** Removes emojis and tidies the spaces they leave behind. Text without emojis is returned as is. */
export const stripEmoji = (value: string): string => {
  if (!hasEmoji(value)) return value;
  return value
    .replace(new RegExp(EMOJI_SOURCE, "gu"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

/** Strips emojis from a title or name before the field's own rules run, so a title left empty still fails its min length. */
export const noEmoji = <T extends z.ZodString>(field: T) =>
  z.preprocess((value) => (typeof value === "string" ? stripEmoji(value) : value), field);
