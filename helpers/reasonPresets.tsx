/*
 * Ready-made reasons a dialog offers as pills above its note box. A preset's
 * text can carry [bracketed] blanks the admin must fill in before sending.
 */
export interface ReasonPreset {
  label: string;
  text: string;
}

const BLANK = /\[[^\]\n]+\]/g;
const PARAGRAPH_BREAK = /\n\s*\n/;

/* The longest fixed stretch of a preset's text. It survives the blanks being
   filled in, so it tells whether that reason is still in the box. */
function anchorOf(preset: ReasonPreset): string {
  return preset.text
    .split(BLANK)
    .map((part) => part.trim())
    .reduce((longest, part) => (part.length > longest.length ? part : longest), "");
}

export function isPresetInUse(value: string, preset: ReasonPreset): boolean {
  const anchor = anchorOf(preset);
  return anchor !== "" && value.includes(anchor);
}

/* Blanks from the presets still sitting unfilled in the text, in text order. */
export function unfilledBlanks(value: string, presets: ReasonPreset[]): string[] {
  const blanks = new Set(presets.flatMap((preset) => preset.text.match(BLANK) ?? []));
  return [...blanks]
    .filter((blank) => value.includes(blank))
    .sort((a, b) => value.indexOf(a) - value.indexOf(b));
}

/*
 * Clicking a pill. An empty box, or one holding an untouched preset, is
 * replaced; edited text gets the reason added as a new paragraph; a reason
 * already in the box has its paragraph removed. `insertedAt` is where the new
 * text starts, or -1 when the pill took text out.
 */
export function togglePreset(
  value: string,
  preset: ReasonPreset,
  presets: ReasonPreset[]
): { value: string; insertedAt: number } {
  if (isPresetInUse(value, preset)) {
    const anchor = anchorOf(preset);
    const kept = value
      .split(PARAGRAPH_BREAK)
      .filter((paragraph) => !paragraph.includes(anchor))
      .join("\n\n");
    return { value: kept, insertedAt: -1 };
  }

  const current = value.trim();
  if (current === "" || presets.some((p) => p.text === current)) {
    return { value: preset.text, insertedAt: 0 };
  }

  const head = `${value.trimEnd()}\n\n`;
  return { value: head + preset.text, insertedAt: head.length };
}

/* The first blank at or after `from`, as a selection range. */
export function nextBlank(value: string, from: number): [number, number] | null {
  const pattern = new RegExp(BLANK.source, "g");
  pattern.lastIndex = Math.max(0, from);
  const match = pattern.exec(value);
  return match ? [match.index, match.index + match[0].length] : null;
}