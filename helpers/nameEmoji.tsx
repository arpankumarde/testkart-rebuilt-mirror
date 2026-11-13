/**
 * Emojis are not allowed in user names. The users_strip_display_name_emoji
 * trigger on users removes them from every display_name write (a name left with
 * no letters becomes `User_<id>`); forms use this check to say so up front.
 * The copyright, registered and trade mark signs are allowed.
 */
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/gu;
const ALLOWED_SYMBOLS = new Set([0xa9, 0xae, 0x2122]);

export const NAME_EMOJI_MESSAGE = "Names cannot contain emojis";

export const containsEmoji = (value: string | null | undefined): boolean => {
  if (!value) return false;
  for (const match of value.matchAll(EMOJI_PATTERN)) {
    const codePoint = match[0].codePointAt(0);
    if (codePoint !== undefined && !ALLOWED_SYMBOLS.has(codePoint)) return true;
  }
  return false;
};
